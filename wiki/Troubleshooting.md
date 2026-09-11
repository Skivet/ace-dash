# Troubleshooting

## A result file does not appear

Check these conditions:

- The filename ends with lowercase `.json`.
- The file is directly inside `ACE_RESULTS_DIR`; subdirectories are not scanned.
- The filename is not `manifest.json`.
- The process can read the file and directory.
- The JSON parses successfully.
- Required ACE fields and arrays are present.
- The file has stopped changing for long enough to pass stability checks.
- The scan interval has elapsed and the browser has been reloaded.

Inspect server logs for `skipping non-ACE file`, `failed to import`, or `scan error` messages.

## Renaming a file does not import it again

This is expected. Deduplication uses a SHA-256 hash of file contents rather than the filename. Identical bytes map to the same session ID.

## A normalization change is not reflected

Existing hashes are skipped, and normalized data has no automatic migration. Stop the app and deliberately rebuild the configured normalized directory from source results. See [Schema changes and reimporting](Data-Model-and-Importing.md#schema-changes-and-reimporting).

## Imported dates look wrong

`importedAt` and `fileModifiedAt` currently both represent the time the app imported the file. The implementation does not currently use the result filename's embedded date or the actual filesystem modification time.

## New sessions appear only after a delay

The periodic scan defaults to 10 seconds, and stability checks add at least roughly two seconds per candidate file. Files are processed sequentially. The filesystem notification path may not initialize correctly in the current implementation, so do not rely on immediate watcher events.

Lower `ACE_SCAN_INTERVAL_MS` carefully if faster polling is needed.

## The browser does not update after import

The frontend has no polling or push connection. Reload the page after the server logs a successful import.

## Valid and best lap numbers disagree

Club record views use laps with raw flag `2`. Several session views use all positive-time laps. An invalid lap can therefore be the displayed session best without qualifying for a club record.

## Driver or car drill-down metadata is blank

The current drill-down API obtains session metadata from entry objects, but normalized entries do not carry those fields. Driver/car entry rows can therefore omit session ID, session name, or import date. Track and session endpoints remain the reliable source for session metadata.

## Startup silently loads zero sessions

If `sessions.json` is absent or cannot be parsed, the store initializes an empty in-memory index. Check:

- `ACE_NORMALIZED_DIR` points to the expected location.
- The process has read and write permissions.
- `sessions.json` contains a JSON array.
- The Docker named volume or host mount is the expected one.

Back up a damaged file before resetting normalized storage.

## Docker reports a permission error

The container runs as UID 1000. Ensure `/app/data/normalized` is writable by that UID. For bind mounts, adjust host ownership or permissions according to the host's security requirements. Keep `/app/data/results` read-only.

## Docker starts without source results

Compose binds `./data/results` relative to the repository. Ensure the directory exists before `docker compose up` and that result files are inside it, or edit the bind source to use the ACE server's absolute result path.

## Port 8080 is unavailable

For a local process:

```bash
ACE_PORT=9090 npm start
```

For Compose, publish a different host port, such as `9090:8080`, while keeping the container's `ACE_PORT=8080` unless both settings are deliberately changed.

## API requests return 404

- URL-encode dynamic IDs and names.
- Track detail IDs require `track|layout` with the separator present.
- Club record endpoints require both `track` and `layout` query parameters.
- Session IDs are complete 64-character SHA-256 hashes; shortened log IDs are not accepted.

## Where to look next

- [Getting Started](Getting-Started.md)
- [Data Model and Importing](Data-Model-and-Importing.md)
- [API Reference](API-Reference.md)
- [Configuration and Deployment](Configuration-and-Deployment.md)
