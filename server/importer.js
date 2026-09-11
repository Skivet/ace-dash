import { createHash } from 'node:crypto';
import { readFile, stat, watch, readdir, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { normalize, compositeId } from './normalizer.js';
import { SessionStore } from './session-store.js';

const DEFAULT_RESULTS_DIR = join(process.cwd(), 'data', 'results');
const DEFAULT_NORMALIZED_DIR = join(process.cwd(), 'data', 'normalized');
const DEFAULT_SCAN_INTERVAL_MS = 10000;
const STABILITY_CHECK_COUNT = 3;
const STABILITY_CHECK_INTERVAL_MS = 500;

class Importer {
  constructor(store, resultsDir, normalizedDir, scanIntervalMs = DEFAULT_SCAN_INTERVAL_MS) {
    this.store = store;
    this.resultsDir = resultsDir;
    this.normalizedDir = normalizedDir;
    this.scanIntervalMs = scanIntervalMs;
    this.watchedFiles = new Set();
    this.stableHistory = new Map();
    this.running = false;
    this.scanTimer = null;
    this.watchers = [];
    this.onImport = null;
    this.onError = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this._ensureResultsDir();
    await this._scan();
    this._startWatchers();
    this.scanTimer = setInterval(() => this._scan(), this.scanIntervalMs);
  }

  async stop() {
    this.running = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    for (const w of this.watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    this.watchers = [];
  }

  async _ensureResultsDir() {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(this.resultsDir, { recursive: true });
  }

  _startWatchers() {
    this._stopWatchers();
    try {
      const watcher = watch(this.resultsDir, { recursive: false });
      this.watchers.push(watcher);
      watcher.on('change', (_event, filename) => this._onFileChange(filename));
      watcher.on('error', (err) => this._log('watcher error', err));
    } catch {
      // watch may fail on some systems
    }
  }

  _stopWatchers() {
    for (const w of this.watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    this.watchers = [];
  }

  async _onFileChange(filename) {
    if (!filename || extname(filename) !== '.json') return;
    await this._scan();
  }

  async _scan() {
    if (!this.running) return;
    try {
      const files = await readdir(this.resultsDir);
      const jsonFiles = files.filter(f => extname(f) === '.json');
      for (const filename of jsonFiles) {
        await this._processFile(filename);
      }
    } catch (err) {
      this._log('scan error', err);
    }
  }

  async _processFile(filename) {
    if (this.watchedFiles.has(filename)) return;
    if (this._isSkippedFilename(filename)) return;

    const filepath = join(this.resultsDir, filename);
    const stable = await this._waitForStability(filepath);
    if (!stable) return;

    const hash = await this._hashFile(filepath);
    const normalizedId = hash;

    if (this.store.has(normalizedId)) {
      this.watchedFiles.add(filename);
      return;
    }

    try {
      const raw = await readFile(filepath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!this._isValidAceResult(parsed)) {
        this._log(`skipping non-ACE file: ${filename}`);
        return;
      }
      const normalized = normalize(parsed);
      normalized.id = normalizedId;

      const sourceMeta = {
        filename,
        importedAt: new Date().toISOString(),
        fileModifiedAt: new Date().toISOString(),
      };

      const added = await this.store.add(normalized, sourceMeta);
      if (added) {
        this.watchedFiles.add(filename);
        this._log(`imported ${filename} → ${normalizedId.slice(0, 8)}…`);
        if (this.onImport) this.onImport(normalizedId);
      }
    } catch (err) {
      this._log(`failed to import ${filename}: ${err.message}`);
      if (this.onError) this.onError(filename, err);
    }
  }

  async _waitForStability(filepath) {
    let lastStat = null;
    let stableCount = 0;
    const maxChecks = STABILITY_CHECK_COUNT;

    for (let i = 0; i < maxChecks + 5; i++) {
      await new Promise(r => setTimeout(r, STABILITY_CHECK_INTERVAL_MS));
      try {
        const current = await stat(filepath);
        if (lastStat &&
            current.size === lastStat.size &&
            current.mtimeMs === lastStat.mtimeMs) {
          stableCount++;
          if (stableCount >= maxChecks) return true;
        } else {
          stableCount = 0;
        }
        lastStat = current;
      } catch {
        stableCount = 0;
        lastStat = null;
      }
    }
    return false;
  }

  async _hashFile(filepath) {
    const data = await readFile(filepath);
    return createHash('sha256').update(data).digest('hex');
  }

  _isValidAceResult(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    if (typeof parsed.track_name !== 'string' || !parsed.track_name) return false;
    if (typeof parsed.session_type !== 'string') return false;
    if (!Array.isArray(parsed.drivers)) return false;
    if (!Array.isArray(parsed.cars)) return false;
    if (!Array.isArray(parsed.driver_standings)) return false;
    if (!Array.isArray(parsed.car_standings)) return false;
    return true;
  }

  _isSkippedFilename(filename) {
    const skip = ['manifest.json', '.DS_Store'];
    return skip.includes(filename);
  }

  _log(msg, err) {
    const timestamp = new Date().toISOString();
    if (err) {
      console.error(`[${timestamp}] ${msg}: ${err.message}`);
    } else {
      console.log(`[${timestamp}] ${msg}`);
    }
  }
}

export { Importer, DEFAULT_RESULTS_DIR, DEFAULT_NORMALIZED_DIR, DEFAULT_SCAN_INTERVAL_MS };
