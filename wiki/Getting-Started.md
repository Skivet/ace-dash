# Getting Started

## Prerequisites

- Node.js 20 or newer. The container uses Node.js 22.
- npm.
- A modern browser.
- One or more ACE JSON result files, if you want to display real data.
- Docker Engine and Docker Compose are optional.

The application has no compile or bundle step.

## Run locally

From the repository root:

```bash
npm ci
mkdir -p data/results
npm start
```

Open `http://localhost:8080`.

The server creates the configured results and normalized session directories when possible. Creating `data/results` explicitly is useful because it also gives you a destination before the first run.

## Add result files

Copy completed ACE JSON exports into the results directory:

```bash
cp /path/to/results.json data/results/
```

The importer scans once during startup and every 10 seconds by default. A candidate file must keep the same size and modification time for three checks, spaced 500 milliseconds apart, before it is read.

Only direct children with a lowercase `.json` extension are considered. `manifest.json` and `.DS_Store` are ignored.

## Confirm the service is healthy

```bash
curl http://localhost:8080/api/health
```

Example response:

```json
{"status":"ok","imported":3}
```

The `imported` value is the number of sessions loaded from normalized storage.

## Use another results directory

Environment variables can point the service at an ACE server's export directory without copying files:

```bash
ACE_RESULTS_DIR=/path/to/ace/results \
ACE_NORMALIZED_DIR=/path/to/writable/ace-dash-data \
ACE_PORT=8080 \
npm start
```

The process needs read access to `ACE_RESULTS_DIR` and write access to `ACE_NORMALIZED_DIR`.

## Run with Docker Compose

Create the bind-mount source, add result files, then start the service:

```bash
mkdir -p data/results
docker compose up -d --build
docker compose logs -f
```

Compose publishes port `8080`, mounts `./data/results` read-only, and stores normalized output in the `ace-dash-data` named volume.

Stop the service with:

```bash
docker compose down
```

Adding `-v` to `docker compose down` also deletes the normalized-data volume. Do that only when you intentionally want every source result to be reimported.

## Run tests

```bash
npm test
```

The suite uses Node's built-in test runner. There is currently no configured lint, formatting, type-check, or production build command.

## Next steps

- Read the [User Guide](User-Guide.md) to understand the dashboard.
- Read [Data Model and Importing](Data-Model-and-Importing.md) before changing metrics or source fields.
- Use the [API Reference](API-Reference.md) for integrations.
- See [Troubleshooting](Troubleshooting.md) if a result does not appear.
