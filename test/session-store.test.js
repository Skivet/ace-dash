import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { SessionStore } from '../server/session-store.js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, '..', 'data', 'normalized-test');

function makeSession(id, track, laps) {
  return {
    id,
    track: { name: track, layout: 'Layout' },
    session: { name: 'Practice', type: 'Practice', completed: true, durationMs: 3600000 },
    entries: [
      {
        id: 'd:c',
        driver: { id: 'd', nickname: 'test', nation: 'USA' },
        car: { id: 'c', model: 'Test Car', number: 1 },
        laps,
        bestLapMs: laps.length > 0 ? Math.min(...laps.map(l => l.timeMs)) : null,
        contacts: { sampleCount: 0, damagingSampleCount: 0, maximumImpactKmh: 0 },
        penalties: [],
      },
    ],
    bestLapMs: laps.length > 0 ? Math.min(...laps.map(l => l.timeMs)) : null,
    completedLapCount: laps.length,
    largestImprovementMs: null,
    maxImpactKmh: 0,
  };
}

describe('SessionStore', () => {
  let store;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(join(testDir, 'sessions'), { recursive: true });
    store = new SessionStore(testDir);
    await store.init();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('starts empty', () => {
    assert.equal(store.list().length, 0);
    assert.equal(store.get('any-id'), null);
  });

  it('adds a session and returns true', async () => {
    const session = makeSession('sess-1', 'Track A', [{ timeMs: 400000 }]);
    const added = await store.add(session, { filename: 'test.json', importedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() });
    assert.equal(added, true);
    assert.equal(store.list().length, 1);
  });

  it('rejects duplicate sessions by id', async () => {
    const session = makeSession('sess-1', 'Track A', [{ timeMs: 400000 }]);
    const first = await store.add(session, { filename: 'a.json', importedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() });
    const second = await store.add(session, { filename: 'b.json', importedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() });
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(store.list().length, 1);
  });

  it('returns sessions ordered newest first', async () => {
    const s1 = makeSession('sess-1', 'Track A', [{ timeMs: 400000 }]);
    const s2 = makeSession('sess-2', 'Track B', [{ timeMs: 390000 }]);
    await store.add(s1, { filename: 'a.json', importedAt: '2026-01-01T00:00:00Z', fileModifiedAt: '2026-01-01T00:00:00Z' });
    await store.add(s2, { filename: 'b.json', importedAt: '2026-01-02T00:00:00Z', fileModifiedAt: '2026-01-02T00:00:00Z' });
    const list = store.list();
    assert.equal(list[0].id, 'sess-2');
    assert.equal(list[1].id, 'sess-1');
  });

  it('persists and reloads sessions', async () => {
    const session = makeSession('sess-1', 'Track A', [{ timeMs: 400000 }]);
    await store.add(session, { filename: 'a.json', importedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() });
    const id = session.id;

    const fresh = new SessionStore(testDir);
    await fresh.init();
    const loaded = fresh.get(id);
    assert.ok(loaded);
    assert.equal(loaded.track.name, 'Track A');
  });

  it('removes a session', async () => {
    const session = makeSession('sess-1', 'Track A', [{ timeMs: 400000 }]);
    await store.add(session, { filename: 'a.json', importedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() });
    const removed = await store.remove('sess-1');
    assert.equal(removed, true);
    assert.equal(store.list().length, 0);
  });
});
