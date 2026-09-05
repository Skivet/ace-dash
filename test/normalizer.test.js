import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { normalize, compositeId } from '../server/normalizer.js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

async function loadFixture(name) {
  const raw = await readFile(join(fixturesDir, name), 'utf8');
  return JSON.parse(raw);
}

describe('compositeId', () => {
  it('returns a string for valid {a,b} objects', () => {
    const id = compositeId({ a: '123', b: '456' });
    assert.equal(id, '123:456');
  });

  it('returns null for null input', () => {
    assert.equal(compositeId(null), null);
  });

  it('returns null for missing fields', () => {
    assert.equal(compositeId({ a: '123' }), null);
    assert.equal(compositeId({ b: '456' }), null);
    assert.equal(compositeId({}), null);
  });
});

describe('normalize - session 1 (practice with laps)', () => {
  let raw;
  let session;

  before(async () => {
    raw = await loadFixture('session1.json');
    session = normalize(raw);
  });

  it('has a stable id placeholder (set externally)', () => {
    assert.ok(typeof session.id === 'string' || session.id === null);
  });

  it('normalizes track info', () => {
    assert.equal(session.track.name, 'Nurburgring');
    assert.equal(session.track.layout, 'Touristenfahrten');
  });

  it('normalizes session metadata', () => {
    assert.equal(session.session.name, 'Practice');
    assert.equal(session.session.type, 'Practice');
    assert.equal(session.session.completed, true);
    assert.equal(session.session.durationMs, 10800000);
  });

  it('preserves composite IDs as strings, not numbers', () => {
    for (const entry of session.entries) {
      assert.ok(typeof entry.driver.id === 'string', `driver.id should be string: ${entry.driver.id}`);
      assert.ok(typeof entry.car.id === 'string', `car.id should be string: ${entry.car.id}`);
    }
  });

  it('derives best lap from laps array, not time_standings', () => {
    const allLaps = session.entries.flatMap(e => e.laps);
    const best = Math.min(...allLaps.map(l => l.timeMs));
    assert.equal(session.bestLapMs, 409500);
    assert.equal(best, 409500);
  });

  it('includes luke\'s lap even though time_standings omits it', () => {
    const lukeEntries = session.entries.filter(e => e.driver.nickname === 'lukeyeldukey');
    assert.ok(lukeEntries.length > 0, 'luke should have at least one entry');
    const lukeWithLap = lukeEntries.find(e => e.laps.length > 0);
    assert.ok(lukeWithLap, 'luke should have an entry with laps');
    const lapTimes = lukeWithLap.laps.map(l => l.timeMs);
    assert.ok(lapTimes.includes(457110), 'luke\'s 7:37.110 lap should be present');
  });

  it('handles duplicate driver entries (luke appears twice)', () => {
    const lukeEntries = session.entries.filter(e => e.driver.nickname === 'lukeyeldukey');
    assert.ok(lukeEntries.length >= 1, 'luke should appear as entries');
  });

  it('computes completed lap count correctly', () => {
    assert.equal(session.completedLapCount, 3);
  });

  it('computes largest improvement', () => {
    assert.ok(session.largestImprovementMs !== null, 'should have an improvement');
    assert.equal(session.largestImprovementMs, 7335);
  });

  it('computes max impact from collisions', () => {
    assert.ok(session.maxImpactKmh > 0, 'should have max impact');
    assert.ok(Math.abs(session.maxImpactKmh - 146.48381) < 0.01, `max impact should be ~146.48, got ${session.maxImpactKmh}`);
  });

  it('groups contacts by car_id', () => {
    const contactsByCar = {};
    for (const entry of session.entries) {
      contactsByCar[entry.car.model] = entry.contacts;
    }
    const gt3r = Object.values(contactsByCar).find(c => c.sampleCount === 289);
    assert.ok(gt3r, 'should find car with 289 samples');
    assert.ok(Math.abs(gt3r.maximumImpactKmh - 146.48381) < 0.01, `max impact should be ~146.48, got ${gt3r.maximumImpactKmh}`);
  });

  it('normalizes penalties from penalty_collection', () => {
    const penalties = session.entries.flatMap(e => e.penalties);
    assert.ok(penalties.length > 0, 'should have penalties');
  });

  it('does not leak server_ip, player_id, or year_of_birth', () => {
    const json = JSON.stringify(session);
    assert.ok(!json.includes('server_ip'), 'should not leak server_ip');
    assert.ok(!json.includes('player_id'), 'should not leak player_id');
    assert.ok(!json.includes('year_of_birth'), 'should not leak year_of_birth');
    assert.ok(!json.includes('first_name'), 'should not leak first_name');
    assert.ok(!json.includes('last_name'), 'should not leak last_name');
  });

  it('sorts entries by best lap (fastest first)', () => {
    const bestLaps = session.entries.map(e => e.bestLapMs);
    const nonNull = bestLaps.filter(t => t !== null);
    for (let i = 1; i < nonNull.length; i++) {
      assert.ok(nonNull[i - 1] <= nonNull[i], 'entries should be sorted by best lap ascending');
    }
  });
});

describe('normalize - session 2 (no completed laps)', () => {
  let raw;
  let session;

  before(async () => {
    raw = await loadFixture('session2.json');
    session = normalize(raw);
  });

  it('has zero completed laps', () => {
    assert.equal(session.completedLapCount, 0);
    assert.equal(session.bestLapMs, null);
  });

  it('still includes the driver and car entry', () => {
    assert.equal(session.entries.length, 1);
    assert.equal(session.entries[0].driver.nickname, 'skivet');
  });

  it('still aggregates contact samples', () => {
    assert.equal(session.entries[0].contacts.sampleCount, 10);
  });

  it('has null largestImprovementMs when no laps', () => {
    assert.equal(session.largestImprovementMs, null);
  });
});

describe('normalize - time field handling', () => {
  const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
  const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };

  it('handles integer times', () => {
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [{ driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 416835, flags: 1 }],
    }));
    assert.equal(s.entries[0].laps[0].timeMs, 416835);
  });

  it('handles decimal times', () => {
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [{ driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 416835.7, flags: 1 }],
    }));
    assert.equal(s.entries[0].laps[0].timeMs, 416836);
  });

  it('handles numeric-string times', () => {
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [{ driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: '416835', flags: 1 }],
    }));
    assert.equal(s.entries[0].laps[0].timeMs, 416835);
  });
});

describe('normalize - edge cases', () => {
  it('handles empty laps array', () => {
    const s = normalize(buildMinimal({ laps: [] }));
    assert.equal(s.completedLapCount, 0);
    assert.equal(s.bestLapMs, null);
  });

  it('handles session with no drivers', () => {
    const s = normalize(buildMinimal({
      drivers: [],
      cars: [],
      driver_standings: [],
      car_standings: [],
    }));
    assert.equal(s.entries.length, 0);
  });

  it('assigns lap numbers in chronological order, not by fastest time', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'morphy', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 416835, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 409500, flags: 2 },
      ],
    }));
    assert.equal(s.entries[0].laps.length, 2);
    // Lap 1 is the first completed lap (416835), Lap 2 is the second (409500)
    assert.equal(s.entries[0].laps[0].number, 1);
    assert.equal(s.entries[0].laps[0].timeMs, 416835);
    assert.equal(s.entries[0].laps[1].number, 2);
    assert.equal(s.entries[0].laps[1].timeMs, 409500);
    // bestLapMs is still the fastest regardless of order
    assert.equal(s.entries[0].bestLapMs, 409500);
  });

  it('handles unknown lap flags gracefully', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 390000, flags: 2 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 385000, flags: 99 },
      ],
    }));
    assert.equal(s.entries[0].laps.length, 3);
    // Laps are in original chronological order: 400000(flag=1), 390000(flag=2), 385000(flag=99)
    assert.equal(s.entries[0].laps[0].flags, 1);
    assert.equal(s.entries[0].laps[1].flags, 2);
    assert.equal(s.entries[0].laps[2].flags, 99);
    // Lap numbers reflect chronological order
    assert.equal(s.entries[0].laps[0].number, 1);
    assert.equal(s.entries[0].laps[1].number, 2);
    assert.equal(s.entries[0].laps[2].number, 3);
  });

  it('handles driver driving multiple cars', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const carA = { car_id: { a: '3', b: '4' }, model_displayname: 'Car A', race_number: 1 };
    const carB = { car_id: { a: '5', b: '6' }, model_displayname: 'Car B', race_number: 2 };
    const s = normalize(buildMinimal({
      drivers: [driver, driver],
      cars: [carA, carB],
      driver_standings: [{ a: '1', b: '2' }, { a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }, { car_id: { a: '5', b: '6' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '5', b: '6' }, time: 390000, flags: 1 },
      ],
    }));
    assert.equal(s.entries.length, 2, 'should have 2 entries for same driver in different cars');
    const models = s.entries.map(e => e.car.model);
    assert.ok(models.includes('Car A'));
    assert.ok(models.includes('Car B'));
  });
});

function buildMinimal(overrides = {}) {
  return {
    track_name: 'Test Track',
    track_layout_name: 'Layout',
    session_name: 'Practice',
    session_type: 'Practice',
    is_completed: true,
    specialization: { base: { session_duration_ms: 3600000 } },
    drivers: overrides.drivers || [],
    cars: overrides.cars || [],
    driver_standings: overrides.driver_standings || [],
    car_standings: overrides.car_standings || [],
    laps: overrides.laps || [],
    collisions: overrides.collisions || [],
    penalty_collection: overrides.penalty_collection || {},
    ...overrides,
  };
}
