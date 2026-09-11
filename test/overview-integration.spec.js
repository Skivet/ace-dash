import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { SessionStore } from '../server/session-store.js';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalize } from '../server/normalizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'data', 'results');
const PORT = 9123;

let server;
let store;

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
        sessionId: s.id,
        importedAt: s.source?.importedAt || '',
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
          carId: e.car.id, carModel: e.car.model, bestLapMs: e.bestValidLapMs,
          driverId: e.driver.id, driverName: e.driver.nickname, sessionId: s.id,
          importedAt: s.source?.importedAt || '', validLapCount: e.validLapCount || 0, sessionCount: 1,
        });
      } else {
        const existing = carMap.get(key);
        if (e.bestValidLapMs < existing.bestLapMs) {
          Object.assign(existing, {
            bestLapMs: e.bestValidLapMs, driverId: e.driver.id, driverName: e.driver.nickname,
            sessionId: s.id, importedAt: s.source?.importedAt || '', validLapCount: e.validLapCount || 0,
          });
        }
        existing.sessionCount++;
      }
    }
  }
  const records = [...carMap.values()];
  records.sort((a, b) => a.bestLapMs - b.bestLapMs);
  const outrightBest = records.length > 0 ? records[0].bestLapMs : null;
  for (const r of records) {
    r.gapToOutrightMs = outrightBest !== null ? r.bestLapMs - outrightBest : null;
    r.isOutrightRecord = r.bestLapMs === outrightBest;
  }
  return records;
}

test.describe('club overview - track selector and records', () => {
  test.beforeEach(async () => {
    const dataDir = join(__dirname, '..', 'data', 'normalized');
    store = new SessionStore(dataDir);
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

    const sessions = store.list();
    const trackMap = new Map();
    for (const s of sessions) {
      const key = `${s.track.name}|${s.track.layout}`;
      if (!trackMap.has(key)) trackMap.set(key, { name: s.track.name, layout: s.track.layout, sessionCount: 0 });
      trackMap.get(key).sessionCount++;
    }

    const PUBLIC_DIR = join(__dirname, '..', 'public');
    const MIME_TYPES = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };

    server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const path = url.pathname;

      // API routes
      if (path === '/api/health') {
        return res.end(JSON.stringify({ status: 'ok', imported: sessions.length }));
      }
      if (path === '/api/tracks') {
        return res.end(JSON.stringify({ tracks: [...trackMap.values()] }));
      }
      if (path === '/api/club/stats') {
        const driverSet = new Set(), carSet = new Set(), trackSet = new Set();
        let totalValidLaps = 0, totalInvalidLaps = 0;
        for (const s of sessions) {
          for (const e of s.entries || []) { driverSet.add(e.driver.id); carSet.add(e.car.model); }
          trackSet.add(`${s.track.name}|${s.track.layout}`);
          totalValidLaps += s.validLapCount || 0;
          totalInvalidLaps += s.invalidLapCount || 0;
        }
        return res.end(JSON.stringify({ totalValidLaps, totalInvalidLaps, activeDrivers: driverSet.size, carsDriven: carSet.size, tracksRepresented: trackSet.size, totalSessions: sessions.length }));
      }
      if (path === '/api/club/records') {
        const records = computeOverallRecords(sessions, url.searchParams.get('track') || '', url.searchParams.get('layout') || '');
        return res.end(JSON.stringify({ track: url.searchParams.get('track'), layout: url.searchParams.get('layout'), records }));
      }
      if (path === '/api/club/car-records') {
        const records = computeCarRecords(sessions, url.searchParams.get('track') || '', url.searchParams.get('layout') || '');
        return res.end(JSON.stringify({ track: url.searchParams.get('track'), layout: url.searchParams.get('layout'), records }));
      }
      if (path === '/api/sessions') {
        return res.end(JSON.stringify(sessions.map(s => ({
          id: s.id, track: s.track, session: s.session,
          completedLapCount: s.completedLapCount, validLapCount: s.validLapCount ?? 0,
          invalidLapCount: s.invalidLapCount ?? 0, bestLapMs: s.bestLapMs,
          entriesCount: s.entries?.length ?? 0, source: s.source,
        }))));
      }

      // Static file serving
      const normalized = resolve(join(PUBLIC_DIR, path === '/' ? 'index.html' : path));
      if (!normalized.startsWith(resolve(PUBLIC_DIR))) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      try {
        const stats = await stat(normalized);
        if (stats.isDirectory()) {
          const index = await readFile(join(normalized, 'index.html'), 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(index);
        }
        const ext = extname(normalized);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await readFile(normalized, 'utf8');
        res.writeHead(200, { 'Content-Type': contentType });
        return res.end(content);
      } catch {
        res.writeHead(404);
        return res.end('Not found');
      }
    });

    await new Promise(resolve => server.listen(PORT, resolve));
  });

  test.afterEach(async () => {
    server.close();
  });

  test('one available track is automatically selected and records load', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.club-overview-content', { timeout: 5000 });

    // Selector should be visible
    const selector = page.locator('.track-selector__select');
    await expect(selector).toBeVisible();

    // Should have exactly one option (plus default)
    const options = await selector.locator('option').count();
    expect(options).toBe(2); // default "All tracks" + 1 track

    // First real option should be selected
    const selectedValue = await selector.evaluate(el => el.value);
    expect(selectedValue).toContain('Nurburgring');
    expect(selectedValue).toContain('Touristenfahrten');

    // URL should reflect the selection
    const url = page.url();
    expect(url).toContain('Nurburgring');
    expect(url).toContain('Touristenfahrten');

    // Records panel should be visible (not empty state)
    const recordsPanel = page.locator('.records-panel');
    await expect(recordsPanel).toBeVisible();

    // Records should have data
    const rows = page.locator('.records-table__row');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('selector renders with exactly one option when one track exists', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.track-selector__select', { timeout: 5000 });

    const selector = page.locator('.track-selector__select');
    await expect(selector).toBeVisible();

    const options = await selector.locator('option').count();
    expect(options).toBe(2); // default + 1 track

    const firstTrackOption = selector.locator('option').nth(1);
    const text = await firstTrackOption.textContent();
    expect(text).toContain('Nurburgring');
    expect(text).toContain('Touristenfahrten');
  });

  test('records load for the auto-selected track', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.records-panel', { timeout: 5000 });

    // Overall records should exist
    const overallRows = page.locator('.records-panel .records-table__row');
    expect(await overallRows.count()).toBeGreaterThan(0);

    // First row should be the outright record
    const firstRank = page.locator('.records-panel .records-table__row').first().locator('.records-table__col-rank');
    await expect(firstRank).toHaveText('1');

    // Car records panel should also exist
    const carRecordsPanel = page.locator('.car-records-panel');
    await expect(carRecordsPanel).toBeVisible();

    const carRows = page.locator('.car-records-panel .records-table__row');
    expect(await carRows.count()).toBeGreaterThan(0);
  });

  test('no records request runs before selection initialization', async ({ page }) => {
    const apiCalls = [];

    page.on('request', request => {
      if (request.url().includes('/api/club/records')) {
        apiCalls.push({ url: request.url(), timestamp: Date.now() });
      }
    });

    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.club-overview-content', { timeout: 5000 });

    // Wait a bit for any pending requests
    await page.waitForTimeout(1000);

    // At least one records request should have been made after selection
    expect(apiCalls.length).toBeGreaterThan(0);

    // The request should use the correct canonical track ID
    const recordsUrl = apiCalls[0].url;
    expect(recordsUrl).toContain('track=Nurburgring');
    expect(recordsUrl).toContain('layout=Touristenfahrten');
  });

  test('a session with valid laps produces overall and per-car records', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('.records-panel', { timeout: 5000 });

    // Fetch the API directly to verify record counts
    const statsRes = await page.evaluate(async () => {
      const res = await fetch('/api/club/stats');
      return res.json();
    });
    expect(statsRes.totalValidLaps).toBeGreaterThan(0);

    const recordsRes = await page.evaluate(async () => {
      const res = await fetch('/api/club/records?track=Nurburgring&layout=Touristenfahrten');
      return res.json();
    });
    expect(recordsRes.records.length).toBeGreaterThan(0);

    const carRecordsRes = await page.evaluate(async () => {
      const res = await fetch('/api/club/car-records?track=Nurburgring&layout=Touristenfahrten');
      return res.json();
    });
    expect(carRecordsRes.records.length).toBeGreaterThan(0);

    // Verify the UI reflects this
    const overallRows = page.locator('.records-panel .records-table__row');
    expect(await overallRows.count()).toBeGreaterThan(0);

    const carRows = page.locator('.car-records-panel .records-table__row');
    expect(await carRows.count()).toBeGreaterThan(0);
  });
});
