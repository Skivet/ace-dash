# ACE Dash Wiki

ACE Dash is a self-hosted analytics dashboard for Assetto Corsa EVO (ACE) dedicated-server result files. It imports JSON result snapshots, converts them into a stable internal model, calculates session and club statistics, and serves a responsive browser interface and JSON API.

## At a glance

| Area | Implementation |
| --- | --- |
| Runtime | Node.js ES modules |
| Server | Node's built-in HTTP and filesystem APIs |
| Frontend | Vanilla HTML, CSS, and browser JavaScript |
| Storage | JSON files on disk |
| Import discovery | Startup scan and periodic rescans |
| Deployment | Local Node process or Docker Compose |
| Default URL | `http://localhost:8080` |

There is no database, frontend build step, live telemetry connection, or user authentication.

## How it works

```text
ACE result files
      |
      v
Importer: validate, stabilize, hash
      |
      v
Normalizer: privacy filter and calculate metrics
      |
      v
JSON store: data/normalized
      |
      +-------------------+
      v                   v
JSON API            Browser dashboard
```

The source result files are read-only inputs. A SHA-256 hash of each file's bytes becomes the session ID and prevents the same content from being imported more than once.

## Wiki contents

- [Getting Started](Getting-Started.md): install, configure, and run the app.
- [User Guide](User-Guide.md): dashboard pages, navigation, and metric meanings.
- [Architecture](Architecture.md): modules, request flow, routing, and persistence.
- [Data Model and Importing](Data-Model-and-Importing.md): accepted input, normalization, privacy, and lap validity.
- [API Reference](API-Reference.md): all current HTTP endpoints.
- [Configuration and Deployment](Configuration-and-Deployment.md): environment variables, Docker, health checks, and security.
- [Development and Contributing](Development-and-Contributing.md): code layout, tests, conventions, and change guidance.
- [Troubleshooting](Troubleshooting.md): common import, storage, Docker, and display issues.

## Project boundaries

ACE Dash analyzes result snapshots already written by ACE. It does not provide live timing, edit source results, manage game servers, or authenticate dashboard viewers. Any client that can reach the service can read its UI and API.

## Current behavior worth knowing

- The importer accepts structurally valid result files even when `is_completed` is false.
- Lap flag `2` is treated as valid for club records and valid-lap counts.
- Several session metrics, including the session leaderboard and pace summary, currently use all positive-time laps rather than valid laps only.
- Source `importedAt` and `fileModifiedAt` values are currently both set to import time.
- Normalized files are not regenerated automatically after normalization logic changes.

These statements describe the current implementation, not a future design target.
