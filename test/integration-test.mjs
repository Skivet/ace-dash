import { normalize, isValidLap, VALID_LAP_FLAG } from '../server/normalizer.js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionStore } from '../server/session-store.js';
import { createHash } from 'node:crypto';
import { mkdir, readdir, stat } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'data', 'results');
const NORMALIZED_DIR = join(__dirname, '..', 'data', 'normalized');

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

async function importFixture(filename) {
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
  return normalized;
}

async function main() {
  // Clean slate
  const { execSync } = await import('node:child_process');
  try { execSync('rm -rf ' + join(NORMALIZED_DIR, 'sessions') + '/* ' + join(NORMALIZED_DIR, 'sessions.json'), { stdio: 'ignore' }); } catch {}
  await mkdir(join(NORMALIZED_DIR, 'sessions'), { recursive: true });

  const store = new SessionStore(NORMALIZED_DIR);
  await store.init();

  // Import fixtures
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
    const normalized = await importFixture(f);
    await store.add(normalized, normalized.source);
  }

  const sessions = store.list();
  console.log(`Imported ${sessions.length} sessions`);

  console.log('\n=== Club Stats ===');
  const stats = computeClubStats(sessions);
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n=== Overall Records (Nurburgring Touristenfahrten) ===');
  const records = computeOverallRecords(sessions, 'Nurburgring', 'Touristenfahrten');
  console.log(`Records count: ${records.length}`);
  console.log('First 5:', records.slice(0, 5).map(r => `${r.driverName} ${r.bestLapMs}`).join(', '));

  console.log('\n=== Car Records (Nurburgring Touristenfahrten) ===');
  const carRecords = computeCarRecords(sessions, 'Nurburgring', 'Touristenfahrten');
  console.log(`Car records count: ${carRecords.length}`);
  console.log('First 5:', carRecords.slice(0, 5).map(r => `${r.carModel} ${r.bestLapMs}`).join(', '));

  // Test rehydration
  console.log('\n=== Rehydration Test ===');
  const store2 = new SessionStore(NORMALIZED_DIR);
  await store2.init();
  const rehydrated = store2.list();
  console.log(`Rehydrated sessions: ${rehydrated.length}`);
  const rehydratedStats = computeClubStats(rehydrated);
  console.log('Rehydrated valid laps:', rehydratedStats.totalValidLaps);
  console.log('Rehydrated invalid laps:', rehydratedStats.totalInvalidLaps);

  // Assertions
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    console.log(`  ✓ ${msg}`);
  };

  console.log('\n=== Assertions ===');
  assert(sessions.length === 19, '19 fixtures imported (manifest excluded)');
  assert(stats.totalValidLaps > 0, `Valid laps > 0 (got ${stats.totalValidLaps})`);
  assert(stats.totalInvalidLaps > 0, `Invalid laps > 0 (got ${stats.totalInvalidLaps})`);
  assert(records.length > 0, `Records > 0 (got ${records.length})`);
  assert(carRecords.length > 0, `Car records > 0 (got ${carRecords.length})`);

  // All records should be from valid laps only
  for (const r of records) {
    assert(r.bestLapMs !== null, `Record ${r.driverName} has valid bestLapMs`);
  }

  // Rehydration assertions
  assert(rehydrated.length === 19, `Rehydrated 19 sessions (got ${rehydrated.length})`);
  assert(rehydratedStats.totalValidLaps === stats.totalValidLaps, `Rehydrated valid laps match`);
  assert(rehydratedStats.totalInvalidLaps === stats.totalInvalidLaps, `Rehydrated invalid laps match`);

  console.log('\nAll assertions passed!');
}

main().catch(e => { console.error(e); process.exit(1); });
