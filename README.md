# sigma-timeline-view-plugin

A Sigma plugin that renders worksheet rows as a Gantt-style timeline using
[vis-timeline](https://visjs.github.io/vis-timeline/). Built to be embedded
twice in the same workbook — once grouped by assignee (per-person load), once
grouped by project (per-project state).

## Dev

```bash
npm install
npm run dev
```

Then in Sigma, drop a "Plugin Dev Playground" element on a workbook page and
point it at `http://localhost:3030`. The plugin renders inside the element
and exposes its config slots in Sigma's editor panel.

## What it does

- One swimlane per unique value in the configured **Group by** column(s).
  Pick multiple columns to build a nested hierarchy (e.g. Region → Team →
  Assignee) — vis-timeline renders each parent level as a collapsible header
  above its children.
- Multi-value group cells (JSON array, comma list, or Sigma variant) produce
  one item per value, each in its own swimlane. With multiple group columns
  and several multi-value cells on the same row, the values are paired by
  index, not cartesian-producted — see [Multi-level grouping](#multi-level-grouping).
- Drag an item horizontally to change its start/end; the new times round-
  trip to the source row via the Sigma Action API as a single JSON payload.
  Lane reassignment and double-click-to-create are not yet wired.
- Select an item to fire a Sigma Action with the row's pass-through columns as a
  JSON payload — e.g. to populate a detail form for the record with no
  per-column lookups, since the values ride along in the payload.
- Optional status color bar on the left edge of each item, plus an optional
  small colored chip and/or text pill inside the item.
- Visible-window range (start + end) is pushed to workbook variables on every
  pan/zoom, so a Sigma-side filter can lazy-load only the rows in view.

## Editor-panel config

### Data (required)

| Slot | Type | Purpose |
|---|---|---|
| `source` | element | The data source (worksheet / table). |
| `startDate` | column (datetime) | Item start. |
| `endDate` | column (datetime) | Item end. |
| `label` | column (text/number) | Text shown on the item bar. |
| `group` | column (multi) | Swimlane assignment. Leave empty to render items flat (no lanes), pick one column for a flat list of lanes, or several in order (top → bottom) for nested groups. Each column may hold single or multi-value cells. |
| `idColumn` | column | Row id. Required if you want to persist edits. |

### Edit existing item (optional)

Wire both slots to enable drag-to-edit on item start/end. On drop, the
plugin writes a JSON payload to the text variable and fires the action.

| Slot | Type | Purpose |
|---|---|---|
| `editPayloadVariable` | variable (text) | Receives `{"id": <rowId>, "startDate": "<ISO>", "endDate": "<ISO>"}`. |
| `editAction` | action-trigger | Fires after the variable is set. |

`idColumn` must also be configured — without it the plugin has no row id
to round-trip and drag stays disabled.

Sigma-side, parse the payload with `JsonExtract` and feed the extracted
fields into your update action. Example formulas:

```
JsonExtract([editPayload], "id")
DateParse(JsonExtract([editPayload], "startDate"))
DateParse(JsonExtract([editPayload], "endDate"))
```

Drag-between-lanes (group reassignment) and double-click-to-create (new
items) are not wired in this build.

### Select an item (optional)

Wire these slots to fire a Sigma Action when an item is selected. On select the
plugin serializes the configured **pass-through columns** for that row into a
JSON string, writes it to the text variable, then fires the action. Sigma-side,
pull out the fields you need with `JsonExtract` — no per-column lookups, since
the values ride along in the payload.

| Slot | Type | Purpose |
|---|---|---|
| `passthroughColumns` | column (multi) | Columns serialized into the JSON payload, keyed by column name. Add every column your detail form needs — the timeline's own mapped columns are **not** included automatically; select all columns here if you want the whole row. |
| `passthroughVariable` | variable (text) | Receives the row's JSON payload. |
| `selectAction` | action-trigger | Fires after the JSON is set. |

The JSON is keyed by **column name**, so a control's value is just
`JsonExtract([<passthroughVariable>], "<Column Name>")`. Re-selecting the same
row produces identical JSON, so the action does not re-fire (matching drag-edits,
which no-op when nothing changed). A reset button can re-run the same populate
sequence to restore the form from the still-current payload.

Only columns bound to the element reach the plugin, which is why extras must be
added to `passthroughColumns` — binding a column there is what makes its data
available to serialize.

### Visual styling (optional)

| Slot | Type | Purpose |
|---|---|---|
| `statusColumn` | column | Enum value per row — looked up in `statusLegend`. |
| `statusLegend` | element | A separate table mapping enum value → color. |
| `statusLegendName` | column | The status-value column on the legend table. |
| `statusLegendColor` | column (text) | The color column on the legend table (e.g. `#3b82f6`). |
| `featureStatusColumn` | column | A second enum column; rendered as a small colored chip inside the item. Uses the same `statusLegend`. |
| `pillLabelColumn` | column | Text shown as a Bootstrap-style pill on the left of the item. |
| `groupSubtitle` | text | Subtitle under each swimlane name (e.g. "Objective", "Assignee"). |

### Multi-level grouping

The **Group by** slot accepts an ordered list of columns. The first column is
the top of the hierarchy; the last is the leaf swimlane where items actually
sit.

Multi-value cells (a row whose group cell holds an array / JSON list / comma
list) are fanned out as the **cartesian product** of every level — the item
shows up in every combination of values:

- All single-valued cells on a row → one path through the hierarchy → the
  item appears once.
- One multi-valued cell on a row → one path per value in that cell.
- Multi-valued cells at two or more levels → every combination. E.g. a row
  with `team = ["Alpha", "Beta"]` and `person = ["Alice", "Bob"]` produces
  four paths: `Alpha > Alice`, `Alpha > Bob`, `Beta > Alice`, `Beta > Bob`.
- Different-length arrays still expand fully: `team = [A, B, C]` and
  `person = [alice, bob]` produces 6 paths (3 × 2).
- A row with any empty group cell is skipped entirely.

This means an item tagged with multiple teams AND multiple people appears in
every team's view of every person — useful when the multi-value cells are
independent "memberships" rather than a paired list.

### Lazy load by visible window (optional)

Wire these to drive a server-side date-range filter. On every pan/zoom
(debounced 300ms), the plugin writes the visible window to the variables;
your Sigma-side filter then refetches only the matching rows.

| Slot | Type | Purpose |
|---|---|---|
| `visibleStartVariable` | variable (date) | Receives the left edge of the visible window. |
| `visibleEndVariable` | variable (date) | Receives the right edge. |

Recommended filter on the data source:

```
startDate <= @visibleEnd AND endDate >= @visibleStart
```

(overlap test, so items that straddle the window are still included.)

**Caveat:** with a date-range filter active, assignees whose items all fall
outside the window will have their swimlane disappear. If you need stable
lanes, drive the lane list from a separate workbook element that's not
filtered — not yet wired into the plugin.

## Defaults

- Time axis is locked to the **week** scale (one tick per Monday); major
  labels roll up to month/year.
- Initial visible window is **today − 1 month → today + 2 months**.
- Items snap to the previous Monday on drag/resize. vis-timeline preserves
  duration natively on whole-bar drags.
- `zoomMin` is 4 weeks, `zoomMax` is 5 years.
- Vertical scroll is on; each swimlane has a minimum 64px height with a
  6px white separator between lanes.

## Stack

- React 19 + Vite 8 + TypeScript
- `@sigmacomputing/plugin` ^1.1.1
- `vis-timeline` ^8.5.1 + `vis-data` ^8.0.4
- `moment` ^2.30.1 (ISO week — Monday start)
- Dev port: 3030
