# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step, no package manager. Open `index.html` directly in a browser:

```
open index.html          # macOS
# or drag index.html into any browser
```

There are no tests, no linter config, and no dev server.

## Cache busting

`index.html` loads `styles.css` and `app.js` with a `?v=` query string (e.g. `?v=20260423-7`). Bump this version string in both `<link>` and `<script>` tags whenever deploying changes, so browsers reload the latest files.

## Architecture

Single-page app — three files, no frameworks:

- **`app.js`** — all logic. One shared `state` object (`events`, `editingId`, `selectedCalendarId`, `listSort`). Every mutation calls `renderAll()`, which re-renders both the list and the calendar from scratch via innerHTML.
- **`styles.css`** — all styles. Calendar bars use CSS custom properties (`--start`, `--span`, `--lane`) set inline from JS.
- **`index.html`** — shell with named mount points (`#eventList`, `#calendarControls`, `#calendarRoot`, `#eventForm`).

### Data model

Each event: `{ id, name, start, end, interview, fill, ink }` where dates are `YYYY-MM-DD` strings, `fill` is the bar background color, and `ink` is the text color. `interview` must fall within `[start, end]`.

Persisted to `localStorage`:
- `schedule-events-v3` — event array (JSON)
- `schedule-list-sort-v2` — `{ key, dir }` sort state

On load, if `localStorage` is empty or invalid, `seedEvents` (hardcoded sample data in `app.js`) is used as the default.

### Calendar rendering

`collectMonths()` determines the range of months to display based on the earliest `start` and latest `end` across visible events, plus one extra month at the end.

`renderMonth()` builds a week-by-week grid. For each week, events that overlap that week become "segments". Segments are stacked vertically by `laneIndex` (their position in `orderedEvents`, sorted by `start` then `name`). Bar positioning uses `--start` (0-based column index within the week) and `--span` (column count). The `week-interview-tag` label is placed at a percentage offset within its bar calculated from the interview date's position relative to the week start.

### List table

`getListRows()` returns events either in natural array order (`key === "none"`) or sorted by `start` or `interview`. Drag-and-drop reorder resets the sort to `"none"` and writes the new order back to `state.events`. Multi-select delete uses checkboxes; clicking a row (not the checkbox) opens it for editing in the form.
