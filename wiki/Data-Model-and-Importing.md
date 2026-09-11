# Data Model and Importing

## Import lifecycle

For each lowercase `.json` file in the configured results directory, the importer:

1. Skips known non-result names.
2. Waits until size and modification time remain stable.
3. Computes a SHA-256 hash from the raw bytes.
4. Skips the file when that hash already exists.
5. Parses JSON and validates the minimum ACE shape.
6. Normalizes the result and computes metrics.
7. Writes the normalized session and index.

Malformed or structurally invalid files are not marked as processed, so later scans retry them. Source files are never modified.

## Minimum accepted shape

An import must be an object containing:

| Field | Requirement |
| --- | --- |
| `track_name` | Non-empty string |
| `session_type` | String |
| `drivers` | Array |
| `cars` | Array |
| `driver_standings` | Array |
| `car_standings` | Array |

The validator does not currently require `is_completed` to be true. Despite the product's completed-results focus, incomplete snapshots that satisfy the shape can be imported.

## Identity and deduplication

### Session IDs

The SHA-256 hash of the exact source bytes is used as the session ID. Therefore:

- Renaming an unchanged file does not create another session.
- Whitespace or content changes produce a different session ID.
- Replacing a source file does not update the old normalized session; changed bytes create another session.

### Composite IDs

ACE IDs shaped like `{ "a": "...", "b": "..." }` are serialized as `a:b` strings. They must not be converted to JavaScript numbers because their components may exceed safe integer precision.

Driver and car standings are paired by array position. An entry is retained only when both IDs resolve to known driver and car records.

## Normalized session model

The main structure is:

```text
session
├── id
├── source
├── track
├── session
├── entries[]
│   ├── driver
│   ├── car
│   ├── laps[]
│   ├── lap metrics
│   ├── contacts
│   └── penalties[]
├── paceSummary[]
└── aggregate metrics
```

Times are normalized to rounded integer milliseconds. Missing, nonnumeric, zero, and negative lap times do not become completed laps.

Laps retain source order and receive sequential display numbers during normalization.

## Lap validity

The implementation currently defines a lap as valid when:

```js
lap.flags === 2 && Number.isFinite(lap.timeMs) && lap.timeMs > 0
```

This rule drives:

- `isValid` on normalized laps.
- Valid and invalid lap counts.
- `bestValidLapMs`.
- Outright club records.
- Per-car club records.

Other session-level timing metrics currently use all positive-time laps. See the [User Guide](User-Guide.md#metric-definitions) for the distinction.

## Contacts and penalties

Collision rows are grouped by car. The normalized contact summary contains:

- Raw sample count.
- Count of samples marked as damaging.
- Maximum relative impact in km/h.

A sustained collision may generate multiple rows, so the count is intentionally called a sample count rather than an incident count.

Cleared session penalties are associated by car ID. The normalized data preserves penalty type, time, investigation value, and given/cleared timing fields.

## Privacy boundary

Normalization copies an allowlist rather than exposing complete ACE objects. Normalized output includes public-facing values such as nickname, nation, car model, race number, timings, contacts, and penalties.

It excludes raw fields such as:

- `server_ip`
- `player_id`
- `year_of_birth`
- `first_name`
- `last_name`

If a nickname is absent, `first_name` may currently be used as the normalized nickname fallback. Avoid adding raw fields to normalized output or API responses without reviewing their privacy implications.

## Source metadata

The persisted index records:

```json
{
  "filename": "results.json",
  "importedAt": "2026-09-10T12:00:00.000Z",
  "fileModifiedAt": "2026-09-10T12:00:00.000Z"
}
```

Both timestamps are currently generated at import time. `parseTimestampFromFilename()` exists and is tested, but the importer does not currently use it or the filesystem modification timestamp.

## Schema changes and reimporting

There is no schema version or migration system. Once a content hash exists in `sessions.json`, the source file is skipped even if normalization code changes.

To rebuild normalized data after an intentional schema or metric change:

1. Stop the service.
2. Back up normalized data if it may be needed.
3. Remove or relocate the configured normalized directory or Docker volume.
4. Restart the service and allow it to reimport all source files.

Do not remove source result files as part of this procedure.
