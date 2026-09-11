# Architecture

## System overview

ACE Dash is one Node.js process serving both application data and static frontend assets.

```text
results directory
  -> server/importer.js
  -> server/normalizer.js
  -> server/session-store.js
  -> server/server.js
       -> /api/* JSON
       -> public/* static files
  -> public/js/app.js
       -> component modules
       -> browser DOM
```

The backend uses only Node built-ins. The browser uses native ES modules and `fetch`. No application framework, database, bundler, or template engine is involved.

## Backend modules

### `server/server.js`

The process entry point:

- Reads environment configuration.
- Initializes normalized storage.
- starts the importer and initial scan.
- Computes cross-session API responses in memory.
- Routes API requests.
- Serves `public/` assets.
- Handles `SIGINT` and `SIGTERM` shutdown.

API routes are matched by URL path. The implementation does not currently reject non-GET methods explicitly.

### `server/importer.js`

The ingestion coordinator:

- Ensures the results directory exists.
- Scans direct directory children for JSON files.
- Waits for files to stop changing.
- Validates the minimum ACE result shape.
- hashes the original bytes with SHA-256.
- Skips content already present in the store.
- Normalizes and persists new sessions.
- Reports import events and errors.

The periodic scan is the reliable discovery path. The current filesystem watcher uses the promise-based `node:fs/promises` watcher with an event-emitter API, so watcher setup may fail and silently fall back to polling.

### `server/normalizer.js`

The domain boundary between ACE data and application data:

- Converts composite IDs to string keys.
- Joins drivers, cars, standings, and laps.
- Whitelists fields that can enter normalized storage.
- Classifies valid laps.
- Calculates per-entry and per-session statistics.
- Aggregates contact samples and penalties.

### `server/session-store.js`

The JSON persistence layer:

- Loads `sessions.json` into a `Map` and array at startup.
- Rejects duplicate IDs.
- Writes temporary files and renames them for atomic replacement.
- Sorts sessions newest-first by `source.importedAt`.

The index currently contains complete entries and is what API reads use. Per-session files are also written but are not loaded for requests.

## Frontend modules

### `public/js/app.js`

The browser entry point owns module-level application state and hash routing. Initial startup fetches sessions, tracks, and club statistics concurrently. Route-specific requests then load session or record details before replacing the contents of `#app`.

### `public/js/api.js`

A same-origin `fetch` wrapper for API operations. There is no client cache, persistence layer, polling, WebSocket, or server-sent event connection.

### `public/js/components/`

Small functions construct DOM subtrees for the overview, records, session header, KPIs, leaderboard, lap chart, pace summary, history, incidents, and status views.

### `public/assets/styles.css`

Contains the complete responsive visual system. The app has no CSS preprocessor. It uses custom properties, responsive layouts, visible focus handling, and reduced-motion support.

## Startup sequence

1. Create `SessionStore` and `Importer` instances.
2. Create normalized storage directories and load `sessions.json`.
3. Ensure the source results directory exists.
4. Perform the initial import scan.
5. Start periodic scans.
6. Start the HTTP listener.

Because the initial scan finishes before the HTTP listener starts, a large result directory can delay service readiness.

## Request flow

1. The HTTP server parses the path and query string.
2. `/api/*` requests are handled against the store's in-memory session list.
3. Cross-session statistics are recomputed for each relevant request.
4. Other paths are resolved beneath `public/` and served as static files.
5. Browser navigation after page load is handled by `location.hash`.

## Persistence layout

```text
data/normalized/
├── sessions.json
└── sessions/
    └── <sha256-session-id>.json
```

`sessions.json` is authoritative for startup and API reads in the current implementation. Both locations are implementation details and should not be edited while the service is running.

## Scaling characteristics

Every session and its entries are retained in memory. Club, record, driver, car, and track aggregations scan those sessions on request. This design is straightforward for a small club dataset but does not target very large histories or high request volume.
