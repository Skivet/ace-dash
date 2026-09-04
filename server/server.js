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
