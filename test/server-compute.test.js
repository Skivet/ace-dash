import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalize, isValidLap } from '../server/normalizer.js';

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

function makeSession(id, trackName, trackLayout, entries) {
  return {
    id,
    track: { name: trackName, layout: trackLayout },
    session: { name: 'Practice', type: 'Practice', completed: true, durationMs: 3600000 },
    entries,
    bestLapMs: entries?.length > 0 ? Math.min(...entries.filter(e => e.bestLapMs !== null).map(e => e.bestLapMs)) : null,
    completedLapCount: entries?.reduce((sum, e) => sum + (e.completedLapCount || 0), 0) || 0,
    validLapCount: entries?.reduce((sum, e) => sum + (e.validLapCount || 0), 0) || 0,
    invalidLapCount: entries?.reduce((sum, e) => sum + (e.invalidLapCount || 0), 0) || 0,
    leaderGapMs: null,
    source: { importedAt: '2026-01-01T00:00:00Z' },
  };
}

// Simulate the server-side compute functions
function computeOverallRecords(sessions, trackName, layoutName) {
  const records = [];
  for (const s of sessions) {
    if (s.track.name !== trackName || s.track.layout !== layoutName) continue;
    for (const e of s.entries || []) {
      if (e.bestLapMs === null) continue;
      records.push({
        driverId: e.driver.id,
        driverName: e.driver.nickname,
        carId: e.car.id,
        carModel: e.car.model,
        bestLapMs: e.bestLapMs,
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
      if (e.bestLapMs === null) continue;
      const key = e.car.model;
      if (!carMap.has(key)) {
        carMap.set(key, {
          carId: e.car.id,
          carModel: e.car.model,
          bestLapMs: e.bestLapMs,
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
        if (e.bestLapMs < existing.bestLapMs) {
          existing.bestLapMs = e.bestLapMs;
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

describe('computeOverallRecords', () => {
  it('handles exact ties with TIED LEADER', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, gapToLeaderMs: 0, validLapCount: 1 },
        { id: 'd2:c1', driver: { id: 'd2', nickname: 'Bob' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, gapToLeaderMs: 0, validLapCount: 1 },
      ]),
    ];
    const records = computeOverallRecords(sessions, 'Track A', 'Layout 1');
    assert.equal(records.length, 2);
    assert.equal(records[0].rank, 1);
    assert.equal(records[1].rank, 1);
    assert.equal(records[0].isTied, true);
    assert.equal(records[1].isTied, true);
    assert.equal(records[0].isOutrightRecord, true);
    assert.equal(records[1].isOutrightRecord, true);
    assert.equal(records[0].gapToOutrightMs, 0);
    assert.equal(records[1].gapToOutrightMs, 0);
  });

  it('does not cross track-layout boundaries', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, gapToLeaderMs: 0, validLapCount: 1 },
      ]),
      makeSession('s2', 'Track B', 'Layout 2', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 350000, gapToLeaderMs: 0, validLapCount: 1 },
      ]),
    ];
    const recordsA = computeOverallRecords(sessions, 'Track A', 'Layout 1');
    const recordsB = computeOverallRecords(sessions, 'Track B', 'Layout 2');
    assert.equal(recordsA.length, 1);
    assert.equal(recordsB.length, 1);
    assert.equal(recordsA[0].bestLapMs, 400000);
    assert.equal(recordsB[0].bestLapMs, 350000);
  });

  it('returns empty array when no matching sessions', () => {
    const sessions = [makeSession('s1', 'Track A', 'Layout 1', [])];
    const records = computeOverallRecords(sessions, 'Track B', 'Layout 2');
    assert.equal(records.length, 0);
  });

  it('excludes entries with null bestLapMs', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: null, validLapCount: 0 },
        { id: 'd2:c1', driver: { id: 'd2', nickname: 'Bob' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, validLapCount: 1 },
      ]),
    ];
    const records = computeOverallRecords(sessions, 'Track A', 'Layout 1');
    assert.equal(records.length, 1);
    assert.equal(records[0].driverName, 'Bob');
  });
});

describe('computeCarRecords', () => {
  it('tracks sessionCount across multiple sessions', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, validLapCount: 2, completedLapCount: 3 },
      ]),
      makeSession('s2', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 410000, validLapCount: 1, completedLapCount: 2 },
      ]),
    ];
    const records = computeCarRecords(sessions, 'Track A', 'Layout 1');
    assert.equal(records.length, 1);
    assert.equal(records[0].sessionCount, 2);
    assert.equal(records[0].validLapCount, 3);
    assert.equal(records[0].totalLaps, 5);
    assert.equal(records[0].bestLapMs, 400000);
  });

  it('uses normalized car model identity', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Porsche 911 GT3 RS' }, bestLapMs: 400000, validLapCount: 1 },
        { id: 'd1:c2', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c2', model: 'Porsche 911 GT3 RS' }, bestLapMs: 390000, validLapCount: 1 },
      ]),
    ];
    const records = computeCarRecords(sessions, 'Track A', 'Layout 1');
    assert.equal(records.length, 1);
    assert.equal(records[0].carModel, 'Porsche 911 GT3 RS');
    assert.equal(records[0].bestLapMs, 390000);
  });

  it('handles ties in car records', () => {
    const sessions = [
      makeSession('s1', 'Track A', 'Layout 1', [
        { id: 'd1:c1', driver: { id: 'd1', nickname: 'Alice' }, car: { id: 'c1', model: 'Car A' }, bestLapMs: 400000, validLapCount: 1 },
        { id: 'd2:c2', driver: { id: 'd2', nickname: 'Bob' }, car: { id: 'c2', model: 'Car B' }, bestLapMs: 400000, validLapCount: 1 },
      ]),
    ];
    const records = computeCarRecords(sessions, 'Track A', 'Layout 1');
    assert.equal(records.length, 2);
    assert.equal(records[0].rank, 1);
    assert.equal(records[1].rank, 1);
    assert.equal(records[0].isTied, true);
    assert.equal(records[1].isTied, true);
  });
});

describe('isValidLap', () => {
  it('returns true for flag 2 with finite positive time', () => {
    assert.equal(isValidLap({ flags: 2, timeMs: 400000 }), true);
  });

  it('returns false for flag 1', () => {
    assert.equal(isValidLap({ flags: 1, timeMs: 400000 }), false);
  });

  it('returns false for null/undefined input', () => {
    assert.equal(isValidLap(null), false);
    assert.equal(isValidLap(undefined), false);
  });

  it('returns false for zero time', () => {
    assert.equal(isValidLap({ flags: 2, timeMs: 0 }), false);
  });

  it('returns false for negative time', () => {
    assert.equal(isValidLap({ flags: 2, timeMs: -1000 }), false);
  });

  it('returns false for NaN time', () => {
    assert.equal(isValidLap({ flags: 2, timeMs: NaN }), false);
  });
});

describe('idempotent import simulation', () => {
  it('same normalized session should not duplicate', () => {
    const driver = { guid: { a: '1', b: '2' }, nickname: 'test', nation: 'USA' };
    const car = { car_id: { a: '3', b: '4' }, model_displayname: 'Car', race_number: 1 };
    const s1 = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [{ driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 2 }],
    }));
    const s2 = normalize(buildMinimal({
      drivers: [driver], cars: [car],
      driver_standings: [{ a: '1', b: '2' }],
      car_standings: [{ car_id: { a: '3', b: '4' } }],
      laps: [{ driver_key: { a: '1', b: '2' }, car_key: { a: '3', b: '4' }, time: 400000, flags: 2 }],
    }));
    assert.equal(s1.id, s2.id);
    assert.equal(s1.completedLapCount, s2.completedLapCount);
    assert.equal(s1.validLapCount, s2.validLapCount);
  });
});
