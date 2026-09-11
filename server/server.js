import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Importer } from './importer.js';
import { SessionStore } from './session-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const RESULTS_DIR = process.env.ACE_RESULTS_DIR || join(process.cwd(), 'data', 'results');
const NORMALIZED_DIR = process.env.ACE_NORMALIZED_DIR || join(process.cwd(), 'data', 'normalized');
const PORT = parseInt(process.env.ACE_PORT || '8080', 10);
const SCAN_INTERVAL = parseInt(process.env.ACE_SCAN_INTERVAL_MS || '10000', 10);

const store = new SessionStore(NORMALIZED_DIR);
const importer = new Importer(store, RESULTS_DIR, NORMALIZED_DIR, SCAN_INTERVAL);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendText(res, code, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': contentType });
  res.end(text);
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendStatic(res, filepath) {
  const normalized = resolve(filepath);
  if (!normalized.startsWith(resolve(PUBLIC_DIR))) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  stat(normalized)
    .then(stats => {
      if (stats.isDirectory()) {
        return readFile(join(normalized, 'index.html'), 'utf8');
      }
      return readFile(normalized, 'utf8');
    })
    .then(content => {
      if (res.headersSent) return;
      const ext = extname(normalized);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      });
      res.end(content);
    })
    .catch(err => {
      if (res.headersSent) return;
      console.error('Static file error:', err.message);
      sendJson(res, 404, { error: 'Not found' });
    });
}

function parseUrl(url) {
  const q = url.indexOf('?');
  return q === -1 ? { path: url, query: {} } : {
    path: url.slice(0, q),
    query: Object.fromEntries(new URLSearchParams(url.slice(q + 1))),
  };
}

function trackId(name, layout) {
  return `${encodeURIComponent(name)}|${encodeURIComponent(layout)}`;
}

function parseTrackId(id) {
  const decoded = decodeURIComponent(id);
  const sep = decoded.indexOf('|');
  if (sep === -1) return null;
  return {
    name: decoded.slice(0, sep),
    layout: decoded.slice(sep + 1),
  };
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

async function handleApi(req, res, { path, query }) {
  if (path === '/api/health') {
    return sendJson(res, 200, { status: 'ok', imported: store.list().length });
  }

  if (path === '/api/sessions') {
    const sessions = store.list();
    return sendJson(res, 200, sessions.map(s => {
      const bestEntry = s.entries?.find(e => e.bestLapMs === s.bestLapMs);
      return {
        id: s.id,
        track: s.track,
        session: s.session,
        completedLapCount: s.completedLapCount,
        validLapCount: s.validLapCount ?? 0,
        invalidLapCount: s.invalidLapCount ?? 0,
        bestLapMs: s.bestLapMs,
        entriesCount: s.entries?.length ?? 0,
        bestDriverNickname: bestEntry?.driver?.nickname ?? '',
        source: s.source,
      };
    }));
  }

  if (path.startsWith('/api/sessions/')) {
    const id = path.slice('/api/sessions/'.length);
    const session = store.get(id);
    if (!session) return sendJson(res, 404, { error: 'Session not found' });
    return sendJson(res, 200, session);
  }

  if (path === '/api/drivers') {
    const sessions = store.list();
    const driverMap = new Map();
    for (const s of sessions) {
      for (const e of s.entries || []) {
        const key = e.driver.id;
        if (!driverMap.has(key)) {
          driverMap.set(key, { id: e.driver.id, nickname: e.driver.nickname, nation: e.driver.nation });
        }
      }
    }
    return sendJson(res, 200, { drivers: [...driverMap.values()] });
  }

  if (path === '/api/tracks') {
    const sessions = store.list();
    const trackMap = new Map();
    for (const s of sessions) {
      const key = `${s.track.name}|${s.track.layout}`;
      if (!trackMap.has(key)) {
        trackMap.set(key, { name: s.track.name, layout: s.track.layout, sessionCount: 0 });
      }
      trackMap.get(key).sessionCount++;
    }
    return sendJson(res, 200, { tracks: [...trackMap.values()] });
  }

  if (path === '/api/club/stats') {
    const sessions = store.list();
    return sendJson(res, 200, computeClubStats(sessions));
  }

  if (path === '/api/club/records') {
    const trackName = query.track || '';
    const layout = query.layout || '';
    if (!trackName || !layout) {
      return sendJson(res, 400, { error: 'track and layout query params required' });
    }
    const sessions = store.list();
    const records = computeOverallRecords(sessions, trackName, layout);
    return sendJson(res, 200, { track: trackName, layout, records });
  }

  if (path === '/api/club/car-records') {
    const trackName = query.track || '';
    const layout = query.layout || '';
    if (!trackName || !layout) {
      return sendJson(res, 400, { error: 'track and layout query params required' });
    }
    const sessions = store.list();
    const records = computeCarRecords(sessions, trackName, layout);
    return sendJson(res, 200, { track: trackName, layout, records });
  }

  if (path === '/api/club/recent-sessions') {
    const sessions = store.list();
    const recent = sessions.slice(0, 10).map(s => ({
      id: s.id,
      track: s.track,
      session: s.session,
      validLapCount: s.validLapCount ?? 0,
      invalidLapCount: s.invalidLapCount ?? 0,
      bestLapMs: s.bestLapMs,
      entriesCount: s.entries?.length ?? 0,
      bestDriverNickname: (s.entries?.find(e => e.bestLapMs === s.bestLapMs))?.driver?.nickname || '',
      source: s.source,
    }));
    return sendJson(res, 200, { sessions: recent });
  }

  if (path.startsWith('/api/tracks/')) {
    const trackIdParam = path.slice('/api/tracks/'.length);
    const sessions = store.list();
    const decoded = parseTrackId(trackIdParam);
    if (!decoded) return sendJson(res, 400, { error: 'invalid track id' });
    const trackSessions = sessions.filter(s =>
      s.track.name === decoded.name && s.track.layout === decoded.layout
    );
    const records = computeOverallRecords(trackSessions, decoded.name, decoded.layout);
    const carRecords = computeCarRecords(trackSessions, decoded.name, decoded.layout);
    return sendJson(res, 200, {
      track: decoded.name,
      layout: decoded.layout,
      sessionCount: trackSessions.length,
      records,
      carRecords,
    });
  }

  if (path.startsWith('/api/cars/')) {
    const carModel = decodeURIComponent(path.slice('/api/cars/'.length));
    const sessions = store.list();
    const carSessions = sessions.filter(s =>
      (s.entries || []).some(e => e.car.model === carModel)
    );
    const entries = carSessions.flatMap(s =>
      (s.entries || []).filter(e => e.car.model === carModel && e.bestValidLapMs !== null)
    );
    entries.sort((a, b) => a.bestLapMs - b.bestLapMs);
    const bestLapMs = entries.length > 0 ? entries[0].bestLapMs : null;
    const result = entries.map(e => ({
      driverId: e.driver.id,
      driverName: e.driver.nickname,
      carModel: e.car.model,
      bestLapMs: e.bestLapMs,
      gapToLeaderMs: e.bestLapMs - (bestLapMs || 0),
      sessionId: e.sessionId,
      sessionName: e.sessionName,
      importedAt: e.importedAt,
    }));
    return sendJson(res, 200, { carModel, entries: result, sessionCount: carSessions.length });
  }

  if (path.startsWith('/api/drivers/')) {
    const driverId = decodeURIComponent(path.slice('/api/drivers/'.length));
    const sessions = store.list();
    const driverSessions = sessions.filter(s =>
      (s.entries || []).some(e => e.driver.id === driverId)
    );
    const entries = driverSessions.flatMap(s =>
      (s.entries || []).filter(e => e.driver.id === driverId && e.bestValidLapMs !== null)
    );
    entries.sort((a, b) => a.bestLapMs - b.bestLapMs);
    const bestLapMs = entries.length > 0 ? entries[0].bestLapMs : null;
    const result = entries.map(e => ({
      driverId: e.driver.id,
      driverName: e.driver.nickname,
      carModel: e.car.model,
      bestLapMs: e.bestLapMs,
      gapToLeaderMs: e.bestLapMs - (bestLapMs || 0),
      sessionId: e.sessionId,
      sessionName: e.sessionName,
      importedAt: e.importedAt,
    }));
    return sendJson(res, 200, { driverId, entries: result, sessionCount: driverSessions.length });
  }

  return null;
}

const server = createServer(async (req, res) => {
  const { path } = parseUrl(req.url);

  if (path.startsWith('/api/')) {
    const result = await handleApi(req, res, parseUrl(req.url));
    if (result) return;
  }

  if (path === '/' || path === '/index.html') {
    return sendStatic(res, join(PUBLIC_DIR, 'index.html'));
  }

  return sendStatic(res, join(PUBLIC_DIR, path));
});

async function main() {
  await store.init();
  await importer.start();
  console.log(`ACE Dashboard starting on port ${PORT}`);
  console.log(`Results dir: ${RESULTS_DIR}`);
  console.log(`Normalized dir: ${NORMALIZED_DIR}`);
  console.log(`Sessions imported: ${store.list().length}`);

  importer.onImport = (id) => {
    console.log(`New session imported: ${id.slice(0, 8)}…`);
  };
  importer.onError = (filename, err) => {
    console.error(`Import error for ${filename}: ${err.message}`);
  };

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await importer.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await importer.stop();
  server.close(() => process.exit(0));
});

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
