import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../server/normalizer.js';
import { computeOverallRecords, computeCarRecords } from '../server/club-records.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function key(value) {
  return { a: String(value), b: `${value}-key` };
}

function makeSession(participants, lapSpecs, id = 'session') {
  const raw = {
    track_name: 'Test Track',
    track_layout_name: 'Layout',
    session_name: 'Practice',
    session_type: 'Practice',
    is_completed: true,
    specialization: { base: { session_duration_ms: 3600000 } },
    drivers: participants.map(({ driverId, driverName }) => ({ guid: key(driverId), nickname: driverName })),
    cars: participants.map(({ carId, carName }) => ({ car_id: key(carId), model_displayname: carName })),
    driver_standings: participants.map(({ driverId }) => key(driverId)),
    car_standings: participants.map(({ carId }) => ({ car_id: key(carId) })),
    laps: lapSpecs.map(({ driverId, carId, timeMs, flags }) => ({
      driver_key: key(driverId),
      car_key: key(carId),
      time: timeMs,
      flags,
    })),
    collisions: [],
    penalty_collection: { session_penalties: [] },
  };
  const session = normalize(raw);
  session.id = id;
  session.source = { importedAt: `2026-01-${id === 'session' ? '01' : '02'}T00:00:00Z` };
  return session;
}

describe('canonical valid-lap session metrics', () => {
  it('matches the morphy/lukeyeldukey fixture exactly', async () => {
    const raw = JSON.parse(await readFile(join(__dirname, 'fixtures', 'session1.json'), 'utf8'));
    const session = normalize(raw);
    const morphy = session.driverSummaries.find(driver => driver.driverName === 'morphy');
    const luke = session.driverSummaries.find(driver => driver.driverName === 'lukeyeldukey');

    assert.equal(session.bestValidLapMs, 409500);
    assert.equal(session.rankedDriverCount, 1);
    assert.equal(session.leaderGapMs, null);
    assert.equal(session.largestValidImprovementMs, null);
    assert.equal(morphy.rank, 1);
    assert.equal(morphy.validAverageLapMs, 409500);
    assert.equal(morphy.validLapRangeMs, null);
    assert.equal(luke.rank, null);
    assert.equal(luke.bestValidLapMs, null);
    assert.equal(luke.fastestInvalidLapMs, 457110);
  });

  it('does not compare or bridge across invalid laps for improvement', () => {
    const participants = [{ driverId: 1, driverName: 'Alice', carId: 1, carName: 'Car A' }];
    const invalidThenValid = makeSession(participants, [
      { driverId: 1, carId: 1, timeMs: 416835, flags: 1 },
      { driverId: 1, carId: 1, timeMs: 409500, flags: 2 },
    ]);
    assert.equal(invalidThenValid.largestValidImprovementMs, null);

    const interrupted = makeSession(participants, [
      { driverId: 1, carId: 1, timeMs: 420000, flags: 2 },
      { driverId: 1, carId: 1, timeMs: 415000, flags: 1 },
      { driverId: 1, carId: 1, timeMs: 410000, flags: 2 },
    ]);
    assert.equal(interrupted.largestValidImprovementMs, null);
  });

  it('returns no competitive metrics for an invalid-only session', () => {
    const session = makeSession(
      [{ driverId: 1, driverName: 'Alice', carId: 1, carName: 'Car A' }],
      [{ driverId: 1, carId: 1, timeMs: 3599999, flags: 1 }],
    );
    assert.equal(session.hasValidLap, false);
    assert.equal(session.bestValidLapMs, null);
    assert.equal(session.fastestInvalidLapMs, 3599999);
    assert.equal(session.rankedDriverCount, 0);
    assert.equal(session.leaderGapMs, null);
  });

  it('calculates a valid P1-to-P2 gap', () => {
    const session = makeSession([
      { driverId: 1, driverName: 'Alice', carId: 1, carName: 'Car A' },
      { driverId: 2, driverName: 'Bob', carId: 2, carName: 'Car B' },
    ], [
      { driverId: 1, carId: 1, timeMs: 400000, flags: 2 },
      { driverId: 2, carId: 2, timeMs: 402500, flags: 2 },
    ]);
    assert.equal(session.rankedDriverCount, 2);
    assert.equal(session.leaderGapMs, 2500);
  });

  it('uses competition ranking for tied valid drivers', () => {
    const session = makeSession([
      { driverId: 1, driverName: 'Alice', carId: 1, carName: 'Car A' },
      { driverId: 2, driverName: 'Bob', carId: 2, carName: 'Car B' },
      { driverId: 3, driverName: 'Cara', carId: 3, carName: 'Car C' },
    ], [
      { driverId: 1, carId: 1, timeMs: 400000, flags: 2 },
      { driverId: 2, carId: 2, timeMs: 400000, flags: 2 },
      { driverId: 3, carId: 3, timeMs: 405000, flags: 2 },
    ]);
    assert.deepEqual(session.driverSummaries.map(driver => driver.rank), [1, 1, 3]);
    assert.equal(session.leaderGapMs, 0);
  });

  it('excludes invalid laps from pace average and range', () => {
    const session = makeSession(
      [{ driverId: 1, driverName: 'Alice', carId: 1, carName: 'Car A' }],
      [
        { driverId: 1, carId: 1, timeMs: 390000, flags: 1 },
        { driverId: 1, carId: 1, timeMs: 400000, flags: 2 },
        { driverId: 1, carId: 1, timeMs: 410000, flags: 2 },
      ],
    );
    assert.equal(session.paceSummary[0].validAverageLapMs, 405000);
    assert.equal(session.paceSummary[0].validLapRangeMs, 10000);
  });
});

describe('canonical club records', () => {
  it('emits one overall row per driver and keeps the fastest lap car', () => {
    const session = makeSession([
      { driverId: 1, driverName: 'Alice', carId: 1, carName: 'Porsche 911 GT3 RS (992)' },
      { driverId: 1, driverName: 'Alice', carId: 2, carName: 'Ferrari 296 GT3' },
    ], [
      { driverId: 1, carId: 1, timeMs: 410000, flags: 2 },
      { driverId: 1, carId: 1, timeMs: 405000, flags: 2 },
      { driverId: 1, carId: 2, timeMs: 400000, flags: 2 },
    ]);
    const records = computeOverallRecords([session], 'Test Track', 'Layout');
    assert.equal(records.length, 1);
    assert.equal(records[0].bestLapMs, 400000);
    assert.equal(records[0].carModel, 'Ferrari 296 GT3');
  });

  it('car records ignore a faster invalid lap and count only valid laps', () => {
    const session = makeSession(
      [{ driverId: 1, driverName: 'Alice', carId: 1, carName: 'Mercedes-AMG GT3 EVO' }],
      [
        { driverId: 1, carId: 1, timeMs: 390000, flags: 1 },
        { driverId: 1, carId: 1, timeMs: 400000, flags: 2 },
      ],
    );
    const records = computeCarRecords([session], 'Test Track', 'Layout');
    assert.equal(records.length, 1);
    assert.equal(records[0].bestLapMs, 400000);
    assert.equal(records[0].validLapCount, 1);
    assert.equal(records[0].sessionCount, 1);
  });
});
