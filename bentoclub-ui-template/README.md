# BentoClub UI reference

This is a static HTML/CSS reference for applying the approved visual direction to the existing vanilla-JS dashboard.

## Direction to preserve

- Keep the current session-page composition: large track heading, four KPI cards, leaderboard on the left, lap history and pace summary on the right, session history below, incidents collapsed last.
- Use flat colors only. Do not introduce gradients, glow effects, glassmorphism, decorative shadows, or purple panel backgrounds.
- Near-black/navy surfaces provide structure.
- Cyan is semantic: valid timing, leaders, records, and selected session rows.
- Fuchsia is sparse: focus, status details, and invalid-lap labels. It should never cover a large surface.
- Raw flag numbers are not user-facing. Show `INVALID`, `NO VALID LAPS`, or `NO LAPS`.
- Competitive metrics use valid laps only.

## Integration guidance

Do not replace the existing application architecture or API bindings with this static markup. Treat `index.html` as the target DOM hierarchy and `styles.css` as the visual reference.

Map the styles onto the existing components:

- KPI cards
- leaderboard
- lap chart
- pace summary
- session history
- incidents and penalties

Keep existing accessibility, loading, empty, error, tie, and responsive behavior. Preserve existing component tests and add screenshot or DOM assertions only where useful.

The inline `--bar-width` declarations represent values calculated by the existing lap-chart component; they are demonstration data, not fixed production values.
