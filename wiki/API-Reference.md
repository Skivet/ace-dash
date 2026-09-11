# API Reference

## Conventions

- The API is served from the same origin as the dashboard.
- Responses are JSON with `Content-Type: application/json; charset=utf-8`.
- Error responses have the shape `{ "error": "message" }`.
- There is no authentication, API version prefix, pagination, CORS configuration, or rate limiting.
- Routes are intended for reads, but the server does not currently enforce the HTTP method.
- Dynamic path values and query values should be URL encoded.

## Health

### `GET /api/health`

Returns service status and the number of sessions loaded from normalized storage.

```json
{
  "status": "ok",
  "imported": 12
}
```

## Sessions

### `GET /api/sessions`

Returns session summaries newest-first. Each item includes identity, track, session metadata, lap counts, best lap, entry count, best driver nickname, and source metadata.

```json
[
  {
    "id": "<sha256>",
    "track": { "name": "Track", "layout": "Layout" },
    "session": { "name": "Practice", "type": "practice", "completed": true, "durationMs": 3600000 },
    "completedLapCount": 42,
    "validLapCount": 38,
    "invalidLapCount": 4,
    "bestLapMs": 91234,
    "entriesCount": 6,
    "bestDriverNickname": "Driver",
    "source": { "filename": "results.json", "importedAt": "...", "fileModifiedAt": "..." }
  }
]
```

### `GET /api/sessions/:id`

Returns the complete normalized session stored in the in-memory index. Unknown IDs return `404` with `{ "error": "Session not found" }`.

### `GET /api/club/recent-sessions`

Returns up to ten newest session summaries under a `sessions` property.

## Club statistics and records

### `GET /api/club/stats`

Returns valid and invalid lap totals, distinct driver/car/track counts, total sessions, and a summary of the most recently imported session.

```json
{
  "totalValidLaps": 100,
  "totalInvalidLaps": 8,
  "activeDrivers": 12,
  "carsDriven": 5,
  "tracksRepresented": 3,
  "totalSessions": 9,
  "mostRecentSession": {}
}
```

### `GET /api/club/records?track=:track&layout=:layout`

Returns all entries with a valid lap at the exact track and layout, sorted by best valid lap. Records include competition rank, tie status, gap to the outright record, session metadata, and valid-lap count.

Both query parameters are required. Missing values return `400`.

```bash
curl 'http://localhost:8080/api/club/records?track=Track%20Name&layout=Layout%20Name'
```

### `GET /api/club/car-records?track=:track&layout=:layout`

Returns the best valid result for each car model at the exact track and layout. Results are sorted by lap time and include rank and outright-gap fields.

Both query parameters are required. Missing values return `400`.

## Drivers

### `GET /api/drivers`

Returns distinct normalized drivers:

```json
{
  "drivers": [
    { "id": "a:b", "nickname": "Driver", "nation": "GB" }
  ]
}
```

### `GET /api/drivers/:id`

Returns valid-lap entries for the driver and a count of sessions containing that driver.

Current limitation: entry-level normalized objects do not contain session metadata, so `sessionId`, `sessionName`, and `importedAt` in this response may be absent. Returned `bestLapMs` also uses the all-lap best after filtering entries by the presence of a valid lap.

## Tracks

### `GET /api/tracks`

Returns distinct exact track/layout combinations and their imported session counts.

```json
{
  "tracks": [
    { "name": "Track", "layout": "Layout", "sessionCount": 4 }
  ]
}
```

### `GET /api/tracks/:trackId`

Returns the session count, outright records, and car records for one track/layout pair.

The path identifier is built from separately encoded names joined by `|`:

```text
encodeURIComponent(track) + "|" + encodeURIComponent(layout)
```

An identifier without `|` returns `400`.

## Cars

### `GET /api/cars/:model`

Returns valid-lap entries for the exact decoded car model and a count of sessions containing that model.

Current limitation: as with driver drill-downs, session metadata fields may be absent and displayed `bestLapMs` uses the all-lap best after valid-lap eligibility filtering.

## Unknown routes

Unknown `/api/*` paths ultimately pass through static-file handling and normally return a JSON `404` response. The message is `{ "error": "Not found" }`.
