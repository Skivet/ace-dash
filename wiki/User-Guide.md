# User Guide

## Club overview

The root route, `#/`, opens the club overview. It summarizes:

- Valid and invalid lap totals.
- Distinct drivers and car models.
- Track/layout combinations.
- Imported session count.
- Track-specific outright records.
- Track-specific records grouped by car model.
- Session history for the selected track and layout.

Choose a track and layout to load its records. Record tables use laps classified as valid by the normalizer.

## Session view

Open a session from the history or navigate to `#/session/<session-id>`. The session page contains:

- Session and track details.
- Summary KPI cards.
- Driver/car leaderboard.
- Per-lap timing chart.
- Pace summary.
- Session history.
- Expandable contacts and penalties.

The session ID is the SHA-256 content hash of the imported source file.

## Track, car, and driver views

The frontend recognizes these deep links:

| View | Hash route |
| --- | --- |
| Club overview | `#/` |
| Session | `#/session/<session-id>` |
| Track | `#/tracks/<encoded-track-id>` |
| Car | `#/cars/<encoded-model>` |
| Driver | `#/drivers/<encoded-driver-id>` |

Track IDs combine the encoded track and layout with `|`. Car and driver drill-down routes are supported, though not every current table links to them directly.

Unknown hashes fall back to the club overview.

## Metric definitions

| Metric | Current meaning |
| --- | --- |
| Completed laps | Laps associated with a standing entry and having a positive normalized time |
| Valid laps | Completed laps whose raw `flags` value is exactly `2` |
| Invalid laps | Completed laps that do not satisfy the valid-lap rule |
| Best valid lap | Fastest valid lap for an entry |
| Best lap | Fastest positive-time lap, regardless of validity |
| Average lap | Mean of all positive-time laps for an entry |
| Lap range | Slowest positive-time lap minus fastest positive-time lap |
| Gap to leader | Entry best lap minus the fastest entry best lap |
| Leader gap | Second-fastest entry best lap minus the fastest entry best lap |
| Improvement | Largest slowest-to-fastest range among entries; this is not chronological improvement |
| Contact samples | Number of raw collision samples for a car, not unique incidents |
| Maximum impact | Highest `relative_impact_kmh` collision sample |

Club record tables use `bestValidLapMs`. The session leaderboard, best-lap KPI, average, range, pace summary, and leader gaps currently use all positive-time laps. This distinction is important when comparing screens.

## Data refresh

The server detects new source files through scans, but the browser does not receive push updates. Reload the page to see newly imported sessions.

Imported content is immutable from the UI. There are no create, edit, or delete controls.

## Empty and error states

The interface provides loading, empty, and request-error views. If a newly added result is absent after a reload, check the server log and follow [Troubleshooting](Troubleshooting.md).
