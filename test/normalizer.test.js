import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { normalize, compositeId, parseTimestampFromFilename } from '../server/normalizer.js';
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

  it('computes classified driver count as entries with at least one completed lap', () => {
    const classified = session.entries.filter(e => e.bestLapMs !== null);
    assert.equal(classified.length, 2);
  });

  it('computes leaderGapMs as the gap between P1 and P2 best laps', () => {
    assert.equal(session.leaderGapMs, 47610);
  });

  it('computes per-entry pace metrics for morphy', () => {
    const morphy = session.entries.find(e => e.driver.nickname === 'morphy');
    assert.ok(morphy, 'morphy should exist');
    assert.equal(morphy.completedLapCount, 2);
    assert.equal(morphy.bestLapMs, 409500);
    assert.equal(morphy.gapToBestMs, 0);
    assert.equal(morphy.averageLapMs, 413168);
    assert.equal(morphy.lapRangeMs, 7335);
  });

  it('computes per-entry pace metrics for lukeyeldukey', () => {
    const luke = session.entries.find(e => e.driver.nickname === 'lukeyeldukey');
    assert.ok(luke, 'lukeyeldukey should exist');
    assert.equal(luke.completedLapCount, 1);
    assert.equal(luke.bestLapMs, 457110);
    assert.equal(luke.gapToBestMs, 47610);
    assert.equal(luke.averageLapMs, 457110);
    assert.equal(luke.lapRangeMs, null);
  });

  it('sets null pace metrics for entries with zero laps', () => {
    const skivet = session.entries.find(e => e.driver.nickname === 'skivet');
    assert.ok(skivet, 'skivet should exist');
    assert.equal(skivet.completedLapCount, 0);
    assert.equal(skivet.bestLapMs, null);
    assert.equal(skivet.gapToBestMs, null);
    assert.equal(skivet.averageLapMs, null);
    assert.equal(skivet.lapRangeMs, null);
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

  it('has null leaderGapMs when fewer than two classified entries', () => {
    assert.equal(session.leaderGapMs, null);
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
    assert.equal(s.entries[0].laps[0].number, 1);
    assert.equal(s.entries[0].laps[0].timeMs, 416835);
    assert.equal(s.entries[0].laps[1].number, 2);
    assert.equal(s.entries[0].laps[1].timeMs, 409500);
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
    assert.equal(s.entries[0].laps[0].flags, 1);
    assert.equal(s.entries[0].laps[1].flags, 2);
    assert.equal(s.entries[0].laps[2].flags, 99);
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

  it('best lap calculation is independent of lap order', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 450000, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 430000, flags: 1 },
      ],
    }));
    assert.equal(s.entries[0].bestLapMs, 400000);
    assert.equal(s.entries[0].laps[0].number, 1);
    assert.equal(s.entries[0].laps[1].number, 2);
    assert.equal(s.entries[0].laps[2].number, 3);
  });
});

describe('parseTimestampFromFilename', () => {
  it('parses timestamp from filename with prefix', () => {
    const result = parseTimestampFromFilename('results.jsonresults_20260904_014048_practice.json');
    assert.ok(typeof result === 'string');
    const d = new Date(result);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 8);
    assert.equal(d.getUTCDate(), 4);
    assert.equal(d.getUTCHours(), 1);
    assert.equal(d.getUTCMinutes(), 40);
    assert.equal(d.getUTCSeconds(), 48);
  });

  it('parses timestamp from filename with different time', () => {
    const result = parseTimestampFromFilename('results.jsonresults_20260904_153745_practice.json');
    assert.ok(typeof result === 'string');
    const d = new Date(result);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 8);
    assert.equal(d.getUTCDate(), 4);
    assert.equal(d.getUTCHours(), 15);
    assert.equal(d.getUTCMinutes(), 37);
    assert.equal(d.getUTCSeconds(), 45);
  });

  it('parses timestamp from filename without prefix', () => {
    const result = parseTimestampFromFilename('results_20260904_014048_practice.json');
    assert.ok(typeof result === 'string');
    const d = new Date(result);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 8);
    assert.equal(d.getUTCDate(), 4);
    assert.equal(d.getUTCHours(), 1);
    assert.equal(d.getUTCMinutes(), 40);
    assert.equal(d.getUTCSeconds(), 48);
  });

  it('parses with various session types', () => {
    const result = parseTimestampFromFilename('prefix_results_20251231_235959_race.json');
    assert.ok(typeof result === 'string');
    const d = new Date(result);
    assert.equal(d.getUTCFullYear(), 2025);
    assert.equal(d.getUTCMonth(), 11);
    assert.equal(d.getUTCDate(), 31);
    assert.equal(d.getUTCHours(), 23);
    assert.equal(d.getUTCMinutes(), 59);
    assert.equal(d.getUTCSeconds(), 59);
  });

  it('returns null for filenames without timestamp pattern', () => {
    assert.equal(parseTimestampFromFilename('random_file.json'), null);
    assert.equal(parseTimestampFromFilename('results.json'), null);
    assert.equal(parseTimestampFromFilename(''), null);
    assert.equal(parseTimestampFromFilename(null), null);
    assert.equal(parseTimestampFromFilename(undefined), null);
  });

  it('returns null for malformed timestamp patterns', () => {
    assert.equal(parseTimestampFromFilename('results_2026090_014048_practice.json'), null);
    assert.equal(parseTimestampFromFilename('results_20260904_14048_practice.json'), null);
    assert.equal(parseTimestampFromFilename('results_XYZ_123_practice.json'), null);
  });

  it('does not convert through browser timezone', () => {
    const result = parseTimestampFromFilename('results_20260904_014048_practice.json');
    const d = new Date(result);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 8);
    assert.equal(d.getUTCDate(), 4);
    assert.equal(d.getUTCHours(), 1);
    assert.equal(d.getUTCMinutes(), 40);
    assert.equal(d.getUTCSeconds(), 48);
  });
});

describe('contact sorting', () => {
  it('normalizer preserves all contact data for frontend sorting', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car1 = { car_id: { a: '3', b: '4' }, model_displayname: 'Car A', race_number: 1 };
    const car2 = { car_id: { a: '5', b: '6' }, model_displayname: 'Car B', race_number: 2 };
    const car3 = { car_id: { a: '7', b: '8' }, model_displayname: 'Car C', race_number: 3 };

    const s = normalize(buildMinimal({
      drivers: [driver, driver, driver],
      cars: [car1, car2, car3],
      driver_standings: [{ a: '1', b: '2' }, { a: '1', b: '2' }, { a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }, { car_id: { a: '5', b: '6' } }, { car_id: { a: '7', b: '8' } }],
      collisions: [
        { car_id: { a: '3', b: '4' }, relative_impact_kmh: 50, has_damage: false },
        { car_id: { a: '5', b: '6' }, relative_impact_kmh: 120, has_damage: true },
        { car_id: { a: '7', b: '8' }, relative_impact_kmh: 80, has_damage: false },
      ],
    }));

    // Normalizer sorts by best lap, but preserves all contact data
    const withContacts = s.entries.filter(e => e.contacts.sampleCount > 0);
    assert.equal(withContacts.length, 3);
    // Contact data is preserved for frontend to sort
    const impacts = withContacts.map(e => e.contacts.maximumImpactKmh);
    assert.ok(impacts.includes(120));
    assert.ok(impacts.includes(80));
    assert.ok(impacts.includes(50));
  });
});

describe('normalize - pace metric edge cases', () => {
  it('returns null leaderGapMs when only one classified entry', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 1 },
      ],
    }));
    assert.equal(s.leaderGapMs, null);
    assert.equal(s.entries[0].gapToBestMs, 0);
  });

  it('handles same driver in multiple cars with separate pace metrics', () => {
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
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 410000, flags: 1 },
      ],
    }));
    assert.equal(s.entries.length, 2);
    const carAEntry = s.entries.find(e => e.car.model === 'Car A');
    const carBEntry = s.entries.find(e => e.car.model === 'Car B');
    assert.equal(carAEntry.completedLapCount, 2);
    assert.equal(carAEntry.bestLapMs, 400000);
    assert.equal(carAEntry.averageLapMs, 405000);
    assert.equal(carAEntry.lapRangeMs, 10000);
    assert.equal(carAEntry.gapToBestMs, 10000);
    assert.equal(carBEntry.completedLapCount, 1);
    assert.equal(carBEntry.bestLapMs, 390000);
    assert.equal(carBEntry.gapToBestMs, 0);
    assert.equal(carBEntry.averageLapMs, 390000);
    assert.equal(carBEntry.lapRangeMs, null);
    assert.equal(s.leaderGapMs, 10000);
  });

  it('includes flagged laps in pace calculations', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 390000, flags: 99 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 410000, flags: 2 },
      ],
    }));
    assert.equal(s.entries[0].completedLapCount, 3);
    assert.equal(s.entries[0].bestLapMs, 390000);
    assert.equal(s.entries[0].averageLapMs, 400000);
    assert.equal(s.entries[0].lapRangeMs, 20000);
  });

  it('rounds half-millisecond mean correctly', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400001, flags: 1 },
        { driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400002, flags: 1 },
      ],
    }));
    assert.equal(s.entries[0].averageLapMs, 400002);
  });

  it('handles empty penalties', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [],
      penalty_collection: { session_penalties: [] },
    }));
    assert.equal(s.entries[0].penalties.length, 0);
  });

  it('handles empty contacts', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [],
      collisions: [],
    }));
    assert.equal(s.entries[0].contacts.sampleCount, 0);
    assert.equal(s.entries[0].contacts.maximumImpactKmh, 0);
  });

  it('associates penalties to the correct car entry', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [],
      penalty_collection: {
        session_penalties: [
          {
            car_id: { a: '3', b: '4' },
            cleared_penalties: [
              {
                penalty_data: { type: 'PenaltyType_MP_TeleportToPit', penalty_time_ms: 10000 },
                investigation: 'InvestigationType_Speeding',
                given_lap_count: 3,
                given_session_time_ms: 120000,
                cleared_session_time_ms: 0,
              },
            ],
          },
        ],
      },
    }));
    assert.equal(s.entries[0].penalties.length, 1);
    assert.equal(s.entries[0].penalties[0].type, 'PenaltyType_MP_TeleportToPit');
    assert.equal(s.entries[0].penalties[0].investigation, 'InvestigationType_Speeding');
    assert.equal(s.entries[0].penalties[0].penaltyTimeMs, 10000);
    assert.equal(s.entries[0].penalties[0].givenLapCount, 3);
    assert.equal(s.entries[0].penalties[0].givenSessionTimeMs, 120000);
    assert.equal(s.entries[0].penalties[0].clearedSessionTimeMs, 0);
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
