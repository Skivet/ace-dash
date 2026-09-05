import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const INDEX_FILE = 'sessions.json';

class SessionStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.sessions = new Map();
    this.index = [];
  }

  async init() {
    await mkdir(join(this.dataDir, 'sessions'), { recursive: true });
    await this._loadIndex();
  }

  async _loadIndex() {
    try {
      const raw = await readFile(join(this.dataDir, INDEX_FILE), 'utf8');
      const data = JSON.parse(raw);
      this.index = Array.isArray(data) ? data : [];
      for (const entry of this.index) {
        this.sessions.set(entry.id, entry);
      }
    } catch {
      this.index = [];
      this.sessions = new Map();
    }
  }

  async _saveIndex() {
    const sorted = [...this.index].sort((a, b) =>
      (b.source?.importedAt || '').localeCompare(a.source?.importedAt || '')
    );
    const tmp = join(this.dataDir, `${INDEX_FILE}.tmp.${randomBytes(8).toString('hex')}`);
    const final = join(this.dataDir, INDEX_FILE);
    await writeFile(tmp, JSON.stringify(sorted, null, 2), 'utf8');
    await renameFile(tmp, final);
  }

  has(id) {
    return this.sessions.has(id);
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  list() {
    return [...this.index].sort((a, b) => (b.source?.importedAt || '').localeCompare(a.source?.importedAt || ''));
  }

  async add(normalized, sourceMeta) {
    const id = normalized.id;
    if (this.sessions.has(id)) return false;

    const entry = {
      id,
      track: normalized.track,
      session: normalized.session,
      completedLapCount: normalized.completedLapCount,
      bestLapMs: normalized.bestLapMs,
      largestImprovementMs: normalized.largestImprovementMs,
      maxImpactKmh: normalized.maxImpactKmh,
      leaderGapMs: normalized.leaderGapMs,
      paceSummary: normalized.paceSummary,
      entries: normalized.entries,
      source: sourceMeta,
    };

    this.sessions.set(id, entry);
    this.index.push(entry);

    const tmp = join(this.dataDir, 'sessions', `${id}.tmp.${randomBytes(8).toString('hex')}`);
    const final = join(this.dataDir, 'sessions', `${id}.json`);
    await writeFile(tmp, JSON.stringify(normalized, null, 2), 'utf8');
    await renameFile(tmp, final);
    await this._saveIndex();

    return true;
  }

  async remove(id) {
    if (!this.sessions.has(id)) return false;
    this.sessions.delete(id);
    this.index = this.index.filter(e => e.id !== id);
    await this._saveIndex();
    try {
      await access(join(this.dataDir, 'sessions', `${id}.json`));
      await writeFile(join(this.dataDir, 'sessions', `${id}.json`), '', 'utf8');
    } catch {
      // file may already be gone
    }
    return true;
  }
}

function renameFile(src, dest) {
  return import('node:fs/promises').then(fs => fs.rename(src, dest));
}

export { SessionStore };
