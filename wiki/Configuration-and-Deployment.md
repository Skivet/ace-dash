# Configuration and Deployment

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ACE_PORT` | `8080` | HTTP listen port |
| `ACE_RESULTS_DIR` | `<working-directory>/data/results` | Readable ACE result directory |
| `ACE_NORMALIZED_DIR` | `<working-directory>/data/normalized` | Writable normalized-data directory |
| `ACE_SCAN_INTERVAL_MS` | `10000` | Periodic import scan interval in milliseconds |

The app reads variables directly from the process environment. It does not load `.env` files. Numeric values are parsed but not validated, so use positive integer values.

Relative default paths are based on the process working directory, not the location of `server.js`.

## Local service

For a long-running non-container deployment, configure the result and normalized paths explicitly:

```bash
ACE_RESULTS_DIR=/srv/ace/results \
ACE_NORMALIZED_DIR=/var/lib/ace-dash \
ACE_PORT=8080 \
ACE_SCAN_INTERVAL_MS=10000 \
node server/server.js
```

The service handles `SIGINT` and `SIGTERM`, stops importer timers/watchers, and closes the HTTP listener.

## Docker image

The `Dockerfile`:

- Uses `node:22-slim`.
- Installs package dependencies.
- Copies `server/` and `public/`.
- Runs as the non-root `ace` user with UID 1000.
- Exposes port 8080.
- Includes an HTTP health check.

Build and run directly:

```bash
docker build -t ace-dash .
docker run --rm \
  -p 8080:8080 \
  -v /path/to/ace/results:/app/data/results:ro \
  -v ace-dash-data:/app/data/normalized \
  ace-dash
```

The normalized mount must be writable by container UID 1000. Verify volume or host-directory permissions if startup reports `EACCES`.

## Docker Compose

The included `compose.yaml` defines one `dashboard` service:

```bash
mkdir -p data/results
docker compose up -d --build
docker compose ps
docker compose logs -f dashboard
```

It binds `./data/results` read-only and persists normalized data in the `ace-dash-data` named volume.

To use an ACE directory elsewhere on the host, change the bind source in `compose.yaml`:

```yaml
volumes:
  - type: bind
    source: /absolute/path/to/ace/results
    target: /app/data/results
    read_only: true
```

The existing port mapping and container `ACE_PORT` are both fixed at 8080. To publish another host port while retaining the container port, change only the left side, for example `9090:8080`.

## Health and monitoring

Use:

```bash
curl --fail http://localhost:8080/api/health
```

The endpoint confirms that the HTTP server can respond and reports loaded sessions. It does not verify that future scans can read the source directory or write normalized storage.

Server logs include startup paths, session count, imported filenames, shortened session IDs, scan failures, and parse/import errors. There are no configurable log levels or metrics endpoint.

## Persistence and backup

Back up the configured normalized directory or Docker named volume if preserving import metadata matters. All normalized content can otherwise be reconstructed from the original source result files.

The application has no storage migration mechanism. Review [Data Model and Importing](Data-Model-and-Importing.md#schema-changes-and-reimporting) before deploying normalization changes.

## Network security

ACE Dash has no authentication or authorization. All clients that can reach the listener can read dashboard and API data.

For non-local deployments:

- Restrict network access with a firewall, private network, or VPN.
- Put TLS and authentication at a trusted reverse proxy when broader access is required.
- Mount source result data read-only.
- Keep normalized storage writable only by the service account.
- Review normalized fields before exposing the API outside the club.

The app does not provide TLS, CORS policy headers, security headers, compression, or rate limiting itself.
