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
- Drag an item horizontally to change its time; drag it between lanes to
  change its group assignment. Both edits round-trip to the source row via
  the Sigma Action API.
- Drag start/end snap to the previous Monday (week-aligned moves).
- Double-click empty lane area to create a new item; new items are seeded
  with the dropped lane's group value and a 1-week duration.
- Optional status color bar on the left edge of each item, plus an optional
  small colored chip and/or text pill inside the item.
- Visible-window range (start + end) is pushed to workbook variables on every
  pan/zoom, so a Sigma-side filter can lazy-load only the rows in view.

## Editor-panel config

### Data (required)

| Slot | Type | Purpose |
|---|---|---|
| `source` | element | The data source (worksheet / table). |
| `start` | column (datetime) | Item start. |
| `end` | column (datetime) | Item end. |
| `label` | column (text/number) | Text shown on the item bar. |
| `group` | column (multi) | Swimlane assignment. Leave empty to render items flat (no lanes), pick one column for a flat list of lanes, or several in order (top → bottom) for nested groups. Each column may hold single or multi-value cells. |
| `idColumn` | column | Row id. Required if you want to persist edits. |

### Edit existing item (optional)

Wire these to enable drag-to-edit. The plugin writes the new values to
workbook variables and triggers a single Sigma Action.

| Slot | Type | Purpose |
|---|---|---|
| `editIdVariable` | variable (text/number) | Receives the edited row id. |
| `editStartVariable` | variable (date) | Receives the new start. |
| `editEndVariable` | variable (date) | Receives the new end. |
| `editGroupVariable` | variable (text) | New group: bare value if the source cell was a single value, JSON array if the source cell held multiple. |
| `editAction` | action-trigger | Fires after the variables are set. |
| `confirmGroupChange` | checkbox | Prompts a `window.confirm` before reassigning lanes. |

### Add new item (optional)

Wire these to enable double-click-to-create.

| Slot | Type | Purpose |
|---|---|---|
| `addGroupVariable` | variable (text) | The lane the new item was dropped in. |
| `addStartVariable` | variable (date) | Monday-aligned start of the new item. |
| `addEndVariable` | variable (date) | Start + 1 week. |
| `addLabelVariable` | variable (text) | Empty label; your Action can default it. |
| `addAction` | action-trigger | Fires to insert the row. |

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
start <= @visibleEnd AND end >= @visibleStart
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
