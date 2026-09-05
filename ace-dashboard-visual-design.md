# ACE Dashboard Visual Design

## Design thesis

The dashboard should feel like a modern night-race timing screen derived from the existing PDF report, not a generic administrative dashboard.

The PDF remains the visual reference, but the web version should turn its one-page composition into a responsive working surface with session selection, richer details, and room for future historical analysis.

## Visual language

- Near-black navy page background
- Slightly lighter navy panels
- Cyan for best and active values
- Blue for ordinary lap data
- Orange and red only for impacts, warnings, and exceptional conditions
- Large condensed headings
- Monospaced, tabular numerals for lap times and measured values
- Subtle grid lines and track-map-inspired geometry
- Rounded panels without excessive pill-shaped styling
- No decorative car photography; the data should carry the interface

The overall impression should be precise, fast, and instrument-like.

## First viewport

The application should open directly on the latest completed session. It should not place a marketing hero, introduction, or other obstruction before the useful data.

```text
┌─────────────────────────────────────────────────────────────────┐
│ ACE SESSION ANALYTICS       Sessions  Drivers  Tracks   ● Ready │
 ├─────────────────────────────────────────────────────────────────┤
 │ NÜRBURGRING                         Sep 4, 2026  [Session ▾]     │
 │ Touristenfahrten / Practice                                    │
 ├──────────────┬──────────────┬──────────────┬────────────────────┤
 │ BEST LAP     │ LAPS         │ IMPROVEMENT  │ LEADER GAP         │
 │ 6:49.500     │ 3            │ 7.335 s      │ 47.610 s           │
 ├─────────────────────────┬───────────────────────────────────────┤
 │ LEADERBOARD             │ COMPLETED LAPS                        │
 │                         │                                       │
 │ 1  morphy      6:49.500 │ morphy L2   ███                       │
 │ 2  luke        7:37.110 │ morphy L1   █████                     │
 │ —  skivet             — │ luke L1     ███████████████████       │
 │                         ├───────────────────────────────────────┤
 │                         │ PACE SUMMARY                          │
 └─────────────────────────┴───────────────────────────────────────┘
```

## Primary navigation

Use compact top navigation rather than a permanent sidebar:

- **Sessions** — individual reports and session history
- **Drivers** — performance across sessions
- **Tracks** — best laps grouped by circuit and layout

The first release only needs the Sessions experience. The interface should not display dead or nonfunctional navigation solely to imply future features.

## Session header

The session header should communicate context at a glance:

- Track name as the dominant heading
- Layout and session type beneath it
- Session date and time
- Compact session selector
- Import or application status only when it communicates meaningful state

The session selector label should be human-readable:

```text
Sep 4 · 15:37 · Practice
```

Opening it can show sessions grouped by date:

```text
TODAY
15:37  Practice  Nürburgring  1 driver
01:40  Practice  Nürburgring  3 drivers
```

When a new result is imported, it should become available without forcing the viewer away from the session currently being inspected.

## KPI strip

The primary metrics should appear immediately beneath the session header:

1. Best lap
2. Completed laps
3. Largest lap improvement
4. Leader gap

The leader gap is the time difference between P1 and P2, calculated from normalized entry best laps. It should not be derived from `time_standings`. When fewer than two entries have completed laps, display an em dash with the detail text "Need two classified entries."

Each KPI card should include:

- A compact uppercase label
- One prominent value
- A short associated detail, such as driver name or "P1 to P2"
- Consistent number alignment

On desktop, show four cards in one row. On smaller screens, use a two-by-two grid or a horizontally scrollable row when that preserves readability better.

## Leaderboard

The leaderboard should behave visually like a timing tower:

- Position number is prominent.
- Driver nickname is the primary label.
- Car model is secondary.
- Best lap is right-aligned using tabular digits.
- The fastest classified driver receives a cyan accent.
- Drivers without completed laps remain visible below classified drivers.
- Repeated drivers in different cars remain separate entries.

Future row interaction can open a driver/session detail panel, but this is not required in the first visual slice.

## Completed-lap chart

The lap chart should preserve the PDF's horizontal comparison. A truncated time axis is acceptable because it makes small differences legible, but the baseline must be clearly labeled so the chart is not misleading.

Potential controls for later versions:

- **Fastest** versus **Chronological** sorting
- Driver filter
- Personal-best highlighting
- Valid, invalid, or unknown-flag state

Until the meaning of ACE's lap flags is verified, the interface should display the raw value or an explicitly unknown state rather than labeling a lap valid or invalid.

Hovering or focusing a lap could eventually show:

```text
morphy · Lap 2
6:49.500
Improvement: 7.335 seconds
Flags: 2 — meaning not yet verified
```

Every hover interaction must also be available through keyboard focus or touch.

## Pace summary

The pace summary replaces the contact summary as the primary analytical panel beneath the lap chart. It presents one row per driver/car entry:

| Column | Content |
| --- | --- |
| DRIVER / CAR | Driver nickname (primary), car model (secondary, muted) |
| LAPS | Completed lap count |
| BEST | Best lap time |
| GAP | Gap to session best; `LEADER` or em dash for the session leader, `+x.xxx s` for others |
| AVG | Average completed-lap time |
| RANGE | Slowest minus fastest lap; em dash when fewer than two laps |

The session leader row receives a restrained cyan accent. Slower entries remain white or muted; do not color them red. Entries with zero laps are visible but subdued.

On desktop, render as a compact row-based table with clear column labels. On tablet and mobile, convert each row into a compact card:

```text
morphy
911 GT3 RS (992)

BEST       GAP
6:49.500   LEADER

AVERAGE    RANGE      LAPS
6:53.168   7.335 s    2
```

All pace metrics are calculated server-side. The frontend formats them for display. Average lap times are rounded to the nearest millisecond before formatting.

## Incidents & Penalties

Contact information and penalties are moved into a secondary accessible disclosure panel below the session history. The panel is collapsed by default when there are no pending or noteworthy items.

The disclosure contains two subsections:

### Penalties

Display actual ACE penalties before collision data because penalties have clearer semantics. Show driver/car entry, investigation type, penalty type, penalty time, lap count when issued, session time when issued, and pending or cleared state. Convert enum-like labels into readable text (e.g., `InvestigationType_Speeding` → "Pit-lane speeding"). Do not expose raw composite IDs.

### Contact data

Retain the existing contact calculations as supporting diagnostics. Show per entry: driver and car, maximum recorded impact, total contact samples, damaging contact samples, wall samples, car samples, and object samples. Sort entries by maximum impact speed descending.

Continue using the language:

> Contact records are sampled data points, not necessarily unique incidents. Sustained contact can produce many samples.

Do not call sample counts crashes or incidents. Do not rank drivers by safety. Do not infer fault. Do not create a collision score. Do not cluster records into inferred incidents.

## Session history

The initial home screen should remain latest-session-first. Session history can appear below the main report as a compact list rather than competing with current-session data in the first viewport.

A history row could show:

- Date and time
- Track and layout
- Session type
- Driver count
- Completed-lap count
- Best lap and driver

## Responsive behavior

### Desktop

- Four KPI cards in one row
- Leaderboard on the left
- Lap chart and pace summary on the right
- Session history below the report
- Incidents & Penalties disclosure below session history

### Tablet

- Two-by-two KPI grid
- Leaderboard above the charts
- Pace summary follows the lap chart
- Session selector retained in the session header

### Mobile

- Horizontally scrollable KPI cards or a two-column grid, depending on available width
- Full-width leaderboard
- Full-width lap chart
- Pace summary entries as compact metric cards
- Stacked penalty and contact fields in the disclosure
- Session selector kept near the top
- No page-level horizontal scrolling

Tables and charts should reflow internally instead of forcing the entire dashboard beyond the viewport.

## Typography

- Use a condensed display face for track and section headings when locally available or safely bundled.
- Use a clean sans-serif for labels and body text.
- Use a monospace face with tabular figures for lap times and measurements.
- Body and interactive text should generally remain at least `16px`.
- Regular labels should generally remain at least `14px`.
- Reserve `12–13px` for secondary metadata.
- Maintain readability at 200% browser text enlargement.

## Color roles

Exact values should be selected during implementation, but colors should have stable semantic roles:

| Role | Suggested direction | Use |
| --- | --- | --- |
| Page background | Near-black navy | Main canvas |
| Panel background | Elevated navy | Cards and chart surfaces |
| Primary text | Cool white | Values and headings |
| Secondary text | Slate blue-gray | Metadata and supporting labels |
| Best/active accent | Bright cyan | Fastest lap, selected state |
| Standard data | Saturated blue | Ordinary lap bars |
| Warning | Orange | Moderate impacts and cautions |
| Critical | Red/magenta | Severe impacts and errors |

Color must not be the only indicator of rank, selection, warning, or status.

## Motion and feedback

Motion should be restrained:

- Panels may fade upward slightly when a session loads.
- Lap bars may animate from the chart baseline.
- A newly established best lap may briefly glow cyan.
- A new-session indicator may pulse once and then become static.
- Loading should use stable skeleton layouts that do not cause content jumps.
- All nonessential animation must respect `prefers-reduced-motion`.

The product should feel responsive rather than cinematic.

## Application states

The design should account for more than the ideal populated session.

### Loading

Preserve the dashboard silhouette with subdued skeleton cards and rows.

### No sessions imported

Show a focused empty state explaining where result files are expected and whether the import directory is reachable. Do not fill the page with fictional data.

### Session with no completed laps

Keep the session header and relevant KPIs visible. Clearly state that no completed laps were recorded while still showing drivers, cars, contacts, and penalties when available.

### Import error

Show a concise, actionable error without exposing a raw stack trace. A malformed file should not prevent previously imported sessions from loading.

### Import ready

Avoid a permanently animated green status light. Display quiet status text or an icon only when it helps the user confirm that ingestion is functioning.

## Accessibility

- All controls must be keyboard accessible.
- Interactive charts require nonvisual text or table equivalents.
- Use visible focus states consistent with the cyan accent.
- Do not communicate information using color alone.
- Maintain sufficient contrast between text, panels, and the page background.
- Touch targets should be comfortably sized on mobile.
- Respect browser font settings and reduced-motion preferences.

## Initial implementation scope

The first visual implementation should include:

1. Compact application header
2. Session context and selector
3. Four KPI cards (best lap, completed laps, best improvement, leader gap)
4. Timing-tower leaderboard
5. Horizontal completed-lap chart
6. Pace summary table/cards
7. Incidents & Penalties disclosure (penalties + contact data)
8. Responsive desktop, tablet, and mobile layouts
9. Loading, empty, and no-completed-laps states

The first version should use the supplied September 4 practice session as representative data. Once the silhouette and responsive behavior feel right, the UI can be connected to the normalizer and API described in `ace-dashboard-data-and-architecture.md`.

## Core visual decision

The dashboard should be **latest-session-first**, with the existing PDF serving as its visual specification. Historical and driver-level analysis should extend that working surface later rather than weakening the clarity of the initial session view.
