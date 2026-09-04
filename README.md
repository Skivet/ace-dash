# ACE Session Analytics

A responsive dashboard for completed Assetto Corsa EVO dedicated-server session results.

## What this does

ACE produces a JSON results file when each session ends. This dashboard:

- Watches an ACE results directory for new session files
- Normalizes the raw ACE export into a stable internal model
- Deduplicates imports using SHA-256 content hashes
- Serves a responsive night-race-themed dashboard in the browser
- Exposes a small JSON API for session data

The dashboard handles **completed-session results only**. It does not connect to live telemetry.

## Architecture

```
ACE results folder  →  File importer  →  Normalized sessions  →  JSON API  →  Vanilla JS dashboard
```

- **Node.js service** — file watcher, normalizer, JSON store, HTTP server
- **Browser frontend** — vanilla HTML / CSS / JS, no framework, no build step
- **Storage** — plain JSON files; no database in v1

## Project structure

```
ace-dash/
├── Dockerfile
├── compose.yaml
├── package.json
├── README.md
├── .gitignore
├── server/
│   ├── server.js          # HTTP server, routing, static-file serving
│   ├── importer.js        # File discovery, stability checks, SHA-256 dedup
│   ├── normalizer.js      # ACE raw → dashboard model
│   └── session-store.js   # JSON file index and per-session persistence
├── public/
│   ├── index.html
│   ├── assets/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       ├── api.js
│       ├── formatters.js
│       └── components/
│           ├── session-header.js
│           ├── kpi-cards.js
│           ├── leaderboard.js
│           ├── lap-chart.js
│           ├── contact-summary.js
│           └── session-history.js
├── data/
│   ├── results/           # ACE result files (read-only mount in Docker)
│   └── normalized/        # Normalized sessions and index (writable volume)
└── test/
    ├── normalizer.test.js
    └── session-store.test.js
```

## Local development

```bash
# Install dependencies (none required — uses Node built-ins only)
npm install

# Copy ACE result files into data/results/
cp /path/to/results.json data/results/

# Start the server
npm start
# or
node server/server.js
```

Then open http://localhost:8080.

## Docker Compose

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The compose configuration:

- Builds from the local `Dockerfile`
- Exposes port 8080
- Mounts `./data/results` read-only for ACE output files
- Uses a named volume `ace-dash-data` for normalized session data
- Runs as a non-root user
- Includes a health check
- Restarts unless stopped

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `ACE_PORT` | `8080` | HTTP listen port |
| `ACE_RESULTS_DIR` | `./data/results` | Directory to watch for ACE result files |
| `ACE_NORMALIZED_DIR` | `./data/normalized` | Directory for normalized session data |
| `ACE_SCAN_INTERVAL_MS` | `10000` | Periodic rescan interval in milliseconds |

## Expected ACE results mount

Mount your ACE results directory (or a symlink to it) read-only:

```yaml
volumes:
  - /path/to/ace/results:/app/data/results:ro
```

The importer treats result files as immutable snapshots. It never modifies the source files.

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check; returns imported session count |
| `GET` | `/api/sessions` | Lightweight session summaries, newest first |
| `GET` | `/api/sessions/:id` | Full normalized session |
| `GET` | `/api/drivers` | Distinct drivers across all sessions |
| `GET` | `/api/tracks` | Distinct track/layout combinations |

All API errors return JSON. Unknown session IDs return `404`.

## Data and privacy

- Composite IDs (`{a, b}`) are preserved as strings; they are not converted to numbers.
- Sensitive raw fields (`server_ip`, `player_id`, `year_of_birth`, `first_name`, `last_name`) are excluded from normalized output.
- Lap times and rankings are derived from the `laps` array, not from `time_standings`.
- Collision records are treated as sampled contact data points, not unique incidents.
- Lap flag values are displayed as raw integers; their semantics are not assumed.

## Tests

```bash
npm test
```

Tests cover:

- Composite ID handling
- Best-lap calculation from `laps`
- Missing `time_standings` values
- Duplicate drivers and multiple cars
- Sessions with zero laps
- Contact-sample aggregation
- Content-hash deduplication
- Sensitive-field exclusion
- Malformed JSON behavior
- Session store persistence and ordering

## Current limitations

- No user authentication
- No database; cross-session queries are limited
- No live telemetry or WebSockets
- No driver profile pages or track maps
- No editing or deleting source results
- Docker build not verified in this environment (no Docker installed)
- Lap flag semantics (`1`, `2`) are not yet documented by ACE

## Suggested next steps

1. Add cross-session driver and track aggregation views
2. Persist normalized sessions to SQLite when the dataset grows
3. Add a drag-and-drop manual import path
4. Document lap flag semantics from ACE server configuration
5. Add a dark/light theme toggle
6. Export session data as CSV or PDF
