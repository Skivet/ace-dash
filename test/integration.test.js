import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { normalize, isValidLap, VALID_LAP_FLAG } from '../server/normalizer.js';
import { SessionStore } from '../server/session-store.js';
import { createHash } from 'node:crypto';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'data', 'results');
const NORMALIZED_DIR = join(__dirname, '..', 'data', 'normalized');
const TEST_DATA_DIR = join(NORMALIZED_DIR, '..', 'test-integration-data');

function trackId(name, layout) {
  return `${encodeURIComponent(name)}|${encodeURIComponent(layout)}`;
}

function computeClubStats(sessions) {
  const driverSet = new Set();
  const carSet = new Set();
  const trackSet = new Set();
  let totalValidLaps = 0;
  let totalInvalidLaps = 0;
  let totalSessions = sessions.length;
  let mostRecentSession = null;

  for (const s of sessions) {
    for (const e of s.entries || []) {
      driverSet.add(e.driver.id);
      carSet.add(e.car.model);
    }
    const tid = trackId(s.track.name, s.track.layout);
    trackSet.add(tid);
    totalValidLaps += s.validLapCount || 0;
    totalInvalidLaps += s.invalidLapCount || 0;
    if (!mostRecentSession || (s.source?.importedAt || '') > (mostRecentSession?.source?.importedAt || '')) {
      mostRecentSession = s;
    }
  }

  return {
    totalValidLaps,
    totalInvalidLaps,
    activeDrivers: driverSet.size,
    carsDriven: carSet.size,
    tracksRepresented: trackSet.size,
    totalSessions,
    mostRecentSession: mostRecentSession ? {
      id: mostRecentSession.id,
      track: mostRecentSession.track,
      session: mostRecentSession.session,
      importedAt: mostRecentSession.source?.importedAt,
    } : null,
  };
}

function computeOverallRecords(sessions, trackName, layoutName) {
  const records = [];
  for (const s of sessions) {
    if (s.track.name !== trackName || s.track.layout !== layoutName) continue;
    for (const e of s.entries || []) {
      if (e.bestValidLapMs === null) continue;
      records.push({
        driverId: e.driver.id,
        driverName: e.driver.nickname,
        carId: e.car.id,
        carModel: e.car.model,
        bestLapMs: e.bestValidLapMs,
        gapToLeaderMs: e.gapToLeaderMs,
        sessionId: s.id,
        sessionName: s.session.name,
        sessionType: s.session.type,
        importedAt: s.source?.importedAt || '',
        validLapCount: e.validLapCount || 0,
      });
    }
  }

  records.sort((a, b) => a.bestLapMs - b.bestLapMs);

  const outrightBest = records.length > 0 ? records[0].bestLapMs : null;
  let tiedCount = 1;
  for (let i = 1; i <= records.length; i++) {
    if (i < records.length && records[i].bestLapMs === records[i - 1].bestLapMs) {
      tiedCount++;
    } else {
      for (let j = i - tiedCount; j < i; j++) {
        records[j].rank = i - tiedCount + 1;
        records[j].isTied = tiedCount > 1;
      }
      tiedCount = 1;
    }
  }

  for (const r of records) {
    r.gapToOutrightMs = outrightBest !== null ? r.bestLapMs - outrightBest : null;
    r.isOutrightRecord = r.bestLapMs === outrightBest;
  }

  return records;
}

function computeCarRecords(sessions, trackName, layoutName) {
  const carMap = new Map();

  for (const s of sessions) {
    if (s.track.name !== trackName || s.track.layout !== layoutName) continue;
    for (const e of s.entries || []) {
      if (e.bestValidLapMs === null) continue;
      const key = e.car.model;
      if (!carMap.has(key)) {
        carMap.set(key, {
          carId: e.car.id,
          carModel: e.car.model,
          bestLapMs: e.bestValidLapMs,
          driverId: e.driver.id,
          driverName: e.driver.nickname,
          sessionId: s.id,
          sessionName: s.session.name,
          sessionType: s.session.type,
          importedAt: s.source?.importedAt || '',
          validLapCount: e.validLapCount || 0,
          totalLaps: e.completedLapCount || 0,
          sessionCount: 1,
        });
      } else {
        const existing = carMap.get(key);
        if (e.bestValidLapMs < existing.bestLapMs) {
          existing.bestLapMs = e.bestValidLapMs;
          existing.driverId = e.driver.id;
          existing.driverName = e.driver.nickname;
          existing.sessionId = s.id;
          existing.sessionName = s.session.name;
          existing.sessionType = s.session.type;
          existing.importedAt = s.source?.importedAt || '';
          existing.validLapCount = e.validLapCount || 0;
          existing.totalLaps = e.completedLapCount || 0;
        } else {
          existing.totalLaps += e.completedLapCount || 0;
          existing.validLapCount += e.validLapCount || 0;
        }
        existing.sessionCount++;
      }
    }
  }

  const records = [...carMap.values()];
  records.sort((a, b) => a.bestLapMs - b.bestLapMs);

  const outrightBest = records.length > 0 ? records[0].bestLapMs : null;
  let tiedCount = 1;
  for (let i = 1; i <= records.length; i++) {
    if (i < records.length && records[i].bestLapMs === records[i - 1].bestLapMs) {
      tiedCount++;
    } else {
      for (let j = i - tiedCount; j < i; j++) {
        records[j].rank = i - tiedCount + 1;
        records[j].isTied = tiedCount > 1;
      }
      tiedCount = 1;
    }
  }

  for (const r of records) {
    r.gapToOutrightMs = outrightBest !== null ? r.bestLapMs - outrightBest : null;
    r.isOutrightRecord = r.bestLapMs === outrightBest;
  }

  return records;
}

async function importFixture(store, filename) {
  const filepath = join(RESULTS_DIR, filename);
  const raw = await readFile(filepath, 'utf8');
  const parsed = JSON.parse(raw);
  const hash = createHash('sha256').update(raw).digest('hex');
  const normalized = normalize(parsed);
  normalized.id = hash;
  normalized.source = {
    filename,
    importedAt: new Date().toISOString(),
    fileModifiedAt: new Date().toISOString(),
  };
  return store.add(normalized, normalized.source);
}

describe('integration - valid lap pipeline', () => {
  let store;
  let sessions;

  before(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(join(TEST_DATA_DIR, 'sessions'), { recursive: true });
    store = new SessionStore(TEST_DATA_DIR);
    await store.init();

    const fixtureFiles = [
      '00-source-shape-compact.json',
      '01-solo-five-laps.json',
      '02-two-drivers-close-gap.json',
      '03-exact-tie.json',
      '04-no-laps.json',
      '05-zero-and-negative-times.json',
      '06-all-flag-values.json',
      '07-duplicate-driver-record.json',
      '08-same-driver-two-cars.json',
      '09-outlier-lap.json',
      '10-single-lap-each.json',
      '11-missing-and-empty-splits.json',
      '12-unicode-and-long-names.json',
      '13-incomplete-live-session.json',
      '14-unsorted-laps.json',
      '15-large-30-drivers-360-laps.json',
      '16-orphan-lap-references.json',
      '17-case-colliding-names.json',
      '18-large-time-values.json',
    ];

    for (const f of fixtureFiles) {
      await importFixture(store, f);
    }

    sessions = store.list();
  });

  after(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('imports 19 fixtures (manifest excluded)', () => {
    assert.equal(sessions.length, 19);
  });

  it('computes correct valid and invalid lap totals', () => {
    const stats = computeClubStats(sessions);
    assert.ok(stats.totalValidLaps > 0, `valid laps should be > 0, got ${stats.totalValidLaps}`);
    assert.ok(stats.totalInvalidLaps > 0, `invalid laps should be > 0, got ${stats.totalInvalidLaps}`);
    assert.equal(stats.totalSessions, 19);
    assert.equal(stats.activeDrivers, 33);
    assert.equal(stats.carsDriven, 6);
  });

  it('computes non-empty overall records', () => {
    const records = computeOverallRecords(sessions, 'Nurburgring', 'Touristenfahrten');
    assert.ok(records.length > 0, `records should be > 0, got ${records.length}`);
    // All records must come from valid laps only
    for (const r of records) {
      assert.ok(r.bestLapMs !== null, `record ${r.driverName} should have valid bestLapMs`);
    }
  });

  it('computes non-empty car records', () => {
    const carRecords = computeCarRecords(sessions, 'Nurburgring', 'Touristenfahrten');
    assert.ok(carRecords.length > 0, `car records should be > 0, got ${carRecords.length}`);
    for (const r of carRecords) {
      assert.ok(r.bestLapMs !== null, `car record ${r.carModel} should have valid bestLapMs`);
    }
  });

  it('rehydrates from persisted store with matching stats', async () => {
    const store2 = new SessionStore(TEST_DATA_DIR);
    await store2.init();
    const rehydrated = store2.list();
    assert.equal(rehydrated.length, 19);

    const stats1 = computeClubStats(sessions);
    const stats2 = computeClubStats(rehydrated);
    assert.equal(stats2.totalValidLaps, stats1.totalValidLaps);
    assert.equal(stats2.totalInvalidLaps, stats1.totalInvalidLaps);

    const records1 = computeOverallRecords(sessions, 'Nurburgring', 'Touristenfahrten');
    const records2 = computeOverallRecords(rehydrated, 'Nurburgring', 'Touristenfahrten');
    assert.equal(records2.length, records1.length);

    const carRecords1 = computeCarRecords(sessions, 'Nurburgring', 'Touristenfahrten');
    const carRecords2 = computeCarRecords(rehydrated, 'Nurburgring', 'Touristenfahrten');
    assert.equal(carRecords2.length, carRecords1.length);
  });

  it('06-all-flag-values has exactly 1 valid lap and 4 invalid', () => {
    const s = sessions.find(s => s.source?.filename === '06-all-flag-values.json');
    assert.ok(s, 'should find 06-all-flag-values session');
    assert.equal(s.validLapCount, 1);
    assert.equal(s.invalidLapCount, 4);
    assert.equal(s.entries[0].validLapCount, 1);
    assert.equal(s.entries[0].invalidLapCount, 2);
    assert.equal(s.entries[1].validLapCount, 0);
    assert.equal(s.entries[1].bestValidLapMs, null);
  });

  it('01-solo-five-laps has 2 valid and 3 invalid', () => {
    const s = sessions.find(s => s.source?.filename === '01-solo-five-laps.json');
    assert.ok(s, 'should find 01-solo-five-laps session');
    assert.equal(s.validLapCount, 2);
    assert.equal(s.invalidLapCount, 3);
  });
});
