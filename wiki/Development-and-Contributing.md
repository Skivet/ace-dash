# Development and Contributing

## Repository layout

```text
ace-dash/
├── server/                  Node server, importer, normalizer, and store
├── public/                  Browser application and static assets
│   ├── assets/styles.css
│   └── js/components/
├── test/                    Node test suite and tracked fixtures
├── screenshots/             Responsive visual references
├── wiki/                    Project wiki source
├── Dockerfile
├── compose.yaml
└── package.json
```

The `data/` directory is ignored runtime state. Do not assume locally present files beneath it are available in a clean clone.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the lockfile-resolved dependencies |
| `npm start` | Run `server/server.js` |
| `npm run dev` | Run the same command as `npm start`; there is no reload watcher |
| `npm test` | Run all `node:test` files |

There are currently no lint, format, type-check, coverage, or build scripts. Playwright is installed, but no Playwright configuration or browser test suite is present.

## Coding style

Follow the patterns in the surrounding code:

- Native ES modules.
- Two-space indentation.
- Single-quoted JavaScript strings.
- Semicolons.
- Small browser component functions that return DOM nodes.
- Browser-provided APIs instead of adding dependencies without a clear need.
- CSS custom properties and existing component class naming.
- `textContent` for imported values wherever possible.

Preserve the no-build-step architecture unless a broader change is intentional.

## Backend changes

When changing imports or normalization:

- Keep source result files immutable.
- Preserve composite identifiers as strings.
- Treat normalized output as a privacy boundary.
- Test malformed, missing, empty, duplicate, and large numeric inputs.
- Define whether a metric uses all completed laps or valid laps.
- Consider how existing normalized data will be rebuilt or migrated.

When changing API aggregations, test production functions directly where possible. The current `test/server-compute.test.js` duplicates aggregation logic, which can diverge from `server/server.js`.

## Frontend changes

- Preserve loading, empty, and request-error states.
- Test desktop, tablet, and mobile layouts.
- Preserve keyboard focus visibility and reduced-motion behavior.
- URL-encode dynamic track, car, driver, and session identifiers.
- Remember that browser state is not persisted and new imports require a reload.

The tracked screenshots at 1440x900, 768x1024, and 390x844 provide useful viewport references, though they should be checked against the current UI before being treated as baselines.

## Tests

Tracked tests cover normalization, importer helpers and validation, store behavior, and aggregation logic.

```bash
npm test
```

Notable gaps include:

- End-to-end importer scans and watcher behavior.
- HTTP integration tests against the actual server routes.
- Browser and component tests.
- Direct tests of production aggregation functions.
- Docker build and runtime tests.

Use synthetic fixtures. Do not commit private ACE exports containing personal or server information.

## Documentation changes

The root README is a concise entry point. The `wiki/` pages are the detailed operational reference. Update both when a change affects setup, supported features, or the public API.

Wiki pages use relative Markdown links so they are readable in the repository and can also be copied into a GitHub Wiki repository.

## Before submitting a change

1. Run `npm test`.
2. Start the service with representative synthetic result files.
3. Check `GET /api/health` and any changed endpoints.
4. Manually verify affected views at desktop and mobile widths.
5. Confirm normalized/API output does not add sensitive raw fields.
6. Document any required normalized-data reset or migration.

No CI, branch policy, commit convention, release process, or license is currently defined in the repository.
