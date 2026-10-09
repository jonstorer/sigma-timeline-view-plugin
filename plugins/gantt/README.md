# gantt

A Sigma plugin that renders worksheet rows as a Gantt-style timeline using
[vis-timeline](https://visjs.github.io/vis-timeline/). Built to be embedded
twice in the same workbook — once grouped by assignee (per-person load), once
grouped by project (per-project state).

One plugin in the [sigma-plugins](../../README.md) monorepo.

## Dev

```bash
npm install                    # from the repo root, once
npm run dev --workspace=gantt  # from the repo root
# or, from this directory:
npm install && npm run dev
```

Then in Sigma, drop a "Plugin Dev Playground" element on a workbook page and
point it at `http://localhost:3030`. The plugin renders inside the element
and exposes its config slots in Sigma's editor panel.

## What it does

- One swimlane per unique value in the configured **Group by** column(s).
  Pick multiple columns to build a nested hierarchy (e.g. Region → Team →
  Assignee) — vis-timeline renders each parent level as a collapsible header
  above its children.
- Multi-value group cells (an array or JSON-array string) produce one item per
  value, each in its own swimlane. A plain string is always one group, even if
  it contains commas (e.g. "Research, Plan, & Execute" stays a single lane).
  With multiple group columns
  and several multi-value cells on the same row, the values are paired by
  index, not cartesian-producted — see [Multi-level grouping](#multi-level-grouping).
- Drag an item horizontally to change its start/end, or onto another swimlane
  to reassign its lane; the new times **and** lane round-trip to the source row
  via the Sigma Action API as a single JSON payload **keyed by your source
  column names** — the id, start, and end columns, plus each **Group by**
  column. The edit action writes each field straight back to its column.
  Double-click-to-create is not yet wired. See
  [Lane reassignment](#lane-reassignment) for details.
- Select an item to fire a Sigma Action with the row's pass-through columns as a
  JSON payload — e.g. to populate a detail form for the record with no
  per-column lookups, since the values ride along in the payload.
- Optional per-row highlight color (a source column holding a `#hex`) shown as
  a left-edge bar on the item, an optional 0–1 **progress** column that fills the
  bar to show percent complete, and an optional text pill that can carry its own
  per-row color — all read straight from source columns (no separate legend
  table or status lookup).
- Visible-window range (start + end) is pushed to workbook variables on every
  pan/zoom, so a Sigma-side filter can lazy-load only the rows in view.

## Editor-panel config

### Data (required)

| Slot | Type | Purpose |
|---|---|---|
| `source` | element | The data source (worksheet / table). |
| `startDate` | column (datetime) | Item start. |
| `endDate` | column (datetime) | Item end. |

A week is the smallest planning unit this Gantt supports, but that's enforced
only when you **edit** an item (drag). Reading a row does not correct its
dates — a row whose stored Start/End aren't Monday/Friday renders exactly as
stored (e.g. a Tue–Sat row draws as a 5-day Tue–Sat bar). Dragging that item
even slightly snaps both edges onto the Mon–Fri grid and writes the corrected
dates back. There's no bulk "fix everything" — each off-grid row is corrected
individually, on its next edit.
| `label` | column (text/number) | Text shown on the item bar. |
| `group` | column (multi) | Swimlane assignment. Leave empty to render items flat (no lanes), pick one column for a flat list of lanes, or several in order (top → bottom) for nested groups. Each column may hold single or multi-value cells. |
| `idColumn` | column | Row id. Required if you want to persist edits. |

### Edit existing item (optional)

Wire both slots to enable drag-to-edit on item start/end. On drop, the
plugin writes a JSON payload to the text variable and fires the action.

| Slot | Type | Purpose |
|---|---|---|
| `editPayloadVariable` | variable (text) | Receives a JSON object **keyed by your source column names**: the id column → `<rowId>`, start/end columns → `"YYYY-MM-DD HH:MM:SS"`, and each **Group by** column → an array of that column's values for the row. |
| `editAction` | action-trigger | Fires after the variable is set. |

`idColumn` must also be configured — without it the plugin has no row id
to round-trip and drag stays disabled.

The payload keys are the **column names** (labels) from the source element, so
the edit action maps each field directly back to its column. For example, with
an id column `ID`, dates `Start`/`End`, and a Group-by column `Assignees`:

```json
{ "ID": "r1", "Start": "2026-05-04 00:00:00", "End": "2026-05-08 00:00:00", "Assignees": ["Carol", "Bob"] }
```

`Start` is always a Monday, `End` is always the **Friday of that same or a
later week** — the inclusive last day of the item, not an exclusive
end-of-next-week.

Sigma-side, parse with `Json()` + dot notation (substitute your own column
names). Dot-notation access returns **variant** data, not text — wrap it in
`Text()` before handing it to `Date()`, or `Date()` receives a variant it
can't parse and silently fails. The date format itself has no `T`, `Z`, or
milliseconds, so plain `Date()` is enough once it's given text — `DateParse`
isn't needed:

```
Text(Json([editPayload]).ID)
Date(Text(Json([editPayload]).Start))
Date(Text(Json([editPayload]).End))
Json([editPayload]).Assignees   // JSON array of the column's new values
```

A field name with spaces needs quotes: `Json([editPayload])."Start Date"`.

#### Lane reassignment

Drag an item onto a different swimlane to reassign it — handled by the same edit
payload/action. Group-by columns are treated **independently** (no enforced
parent→child hierarchy), so each Group-by column key carries the row's **full
value set for that column after the move**: the dragged lane's old value is
swapped for the new one and the row's other memberships are preserved. This is
what makes a one-row-many-lanes move work without collapsing the row.

- **Multi-value rows.** A row whose Group-by cell holds several values shows up
  in several lanes at once. Dragging one instance to a new lane swaps just that
  value (e.g. `["Alice","Bob"]` → `["Carol","Bob"]`); the others stay put.
- **Dropping on a parent lane.** With nested groups you can drop onto a parent
  (non-leaf) row; columns below that level keep their current values.
- **Merge on collision.** Dropping onto a lane the row already occupies dedupes
  that column's values (the two instances merge).
- Lane drag turns on together with start/end editing (same `editAction`). If the
  action doesn't write the Group-by columns, the item snaps back to its original
  lane on the next data refresh.

Double-click-to-create (new items) is not wired in this build.

### Select an item (optional)

Wire these slots to fire a Sigma Action when an item is selected. On select the
plugin serializes the configured **pass-through columns** for that row into a
JSON string, writes it to the text variable, then fires the action. Sigma-side,
pull out the fields you need with `Json()` + dot notation (wrap in `Text()`,
`Number()`, etc. for a typed value) — no per-column lookups, since the values
ride along in the payload.

| Slot | Type | Purpose |
|---|---|---|
| `passthroughColumns` | column (multi) | Columns serialized into the JSON payload, keyed by column name. Add every column your detail form needs — the timeline's own mapped columns are **not** included automatically; select all columns here if you want the whole row. |
| `passthroughVariable` | variable (text) | Receives the row's JSON payload. |
| `selectAction` | action-trigger | Fires after the JSON is set. |

The JSON is keyed by **column name**, so a control's value is just
`Text(Json([<passthroughVariable>])."<Column Name>")`. Re-selecting the same
row produces identical JSON, so the action does not re-fire (matching drag-edits,
which no-op when nothing changed). A reset button can re-run the same populate
sequence to restore the form from the still-current payload.

Only columns bound to the element reach the plugin, which is why extras must be
added to `passthroughColumns` — binding a column there is what makes its data
available to serialize.

### Visual styling (optional)

Colors are read directly from the source table — each color slot is a column
holding a `#hex` string per row. There's no separate legend table or status
lookup; map the color on the source (e.g. a calculated column) and point the
slot at it.

| Slot | Type | Purpose |
|---|---|---|
| `highlightColorColumn` | column (text) | Per-row `#hex` — drives the left-edge highlight bar on the item. Blank rows render un-highlighted. |
| `progressColumn` | column (number) | Per-row **0–1 fraction** — fills the left portion of the bar to show percent complete (0.6 → 60% filled). The fill is a translucent tint of the highlight color (neutral blue when none). Blank/0/non-numeric → no fill. |
| `pillLabelColumn` | column | Text shown as a Bootstrap-style pill on the left of the item. |
| `pillColorColumn` | column (text) | Per-row `#hex` filling the pill background (falls back to the default grey when blank). |
| `linkColumn` | column (url/text) | Per-row URL. When present, a small link glyph sits at the left of the item (before the pill) and opens the URL in a new tab. Left-anchored so it stays visible as a wide item scrolls. Rows with a blank value show no link. |
| `descriptionColumn` | column | Shown in the hover card when the item is hovered. |

### Projected completion (optional)

Wire this slot to show whether an item is tracking ahead of or behind its
stated end date. The plugin doesn't compute the projection itself — that's
deliberate: you own the algorithm in Sigma (a calculated column), and the
plugin only renders whatever date it produces. This keeps the projection
formula a workbook-level decision you can change without a plugin deploy.

| Slot | Type | Purpose |
|---|---|---|
| `projectedEndColumn` | column (datetime) | Per-row projected completion date, computed in Sigma. |

A header checkbox ("Show projected completion") only appears once this slot
is configured, and toggles the overlay on/off. It's a plain UI toggle — it
doesn't persist across reloads and isn't wired to a Sigma variable.

**Visual.** Compares the projected date against the item's own stored end:

- **Projected later** (behind schedule): the bar itself is widened out to the
  projected date, with the real portion solid and the overrun shown as a
  dashed red fill. Widening the actual bar — rather than drawing a separate
  overlay next to it — is what makes vis-timeline's own lane-stacking treat
  the overrun as real estate: a later item in that lane gets bumped onto its
  own row instead of the overrun visually running through it, and the bar
  stays visually contiguous with itself (nothing to misalign). This means
  turning the checkbox on can grow lane heights. The right-edge drag handle
  sits at the projected date while this is showing, but editing still writes
  the item's real end — the plugin compensates automatically.
- **Projected earlier** (ahead of schedule): a thin green marker line inside
  the bar, at the projected date. The bar's own width is unchanged, so it
  never affects lane height.
- **Projected on the same day**: no overlay — on track.

**Example formula** (pace extrapolation — "at the rate you've been going,
you'll finish on this date"):

```
DateAdd("day",
  DateDiff("day", [Start], Today()) / [Progress],
  [Start]
)
```

Undefined when `[Progress]` is 0 (no pace yet) — guard for that in your
formula (e.g. return `[End]` or null) so the column doesn't produce a
divide-by-zero result for not-yet-started items.

### Second source (optional)

For overlaying a second, independently-configured table on the same chart —
e.g. an on-call schedule alongside project tasks — without building a SQL
blend/union of the two tables first.

A full duplicate of the display slots above (`labelB`, `groupB`, `startDateB`,
`endDateB`, `highlightColorColumnB`, `progressColumnB`, `pillLabelColumnB`,
`pillColorColumnB`, `linkColumnB`, `descriptionColumnB`), all sourced from a
second **Second source** element. Rendered on the same chart as the primary
source: a group whose value matches a primary-source group (e.g. the same
person's name) lands on the **same row**, so vis-timeline's own stacking
makes any time overlap between the two sources visible without either one
knowing about the other.

Source B's `startDateB`/`endDateB` render at their **exact instant**, not
floored to the day the way the primary source's dates are — the primary
Gantt is week/day-granular by design, but source B is built for data with
genuine sub-day boundaries (e.g. an on-call shift changing at 4pm). This
isn't configurable; source B always uses exact time.

Source B renders as the same pill shape as a work item, just filled entirely
with its color instead of white-with-a-left-accent, in its own dedicated
band pinned to the **top of every swimlane**. That band reserves its own
vertical space regardless of how many work items stack beneath it in that
row — both are driven by vis-timeline's `subgroup` mechanism:
`subgroupOrder` controls which band renders on top, and `subgroupStack`
forces each subgroup to stack independently rather than only separating
when items happen to collide. Both `work` and `oncall` must be listed in
`subgroupStack` — vis-timeline treats it as a per-subgroup whitelist once
it's an object at all, so leaving one out silently disables *that*
subgroup's own stacking (a real regression caught during development: work
items briefly started rendering directly on top of each other).

Without `highlightColorColumnB` configured, each item gets a consistent
color hashed from its own label (`colorHash.ts`) — the same pattern
Slack/Linear/GitHub use for avatar colors, so distinct on-call people are
visually distinguishable with zero color setup required. This is hashed
from the label, not the group: a group can be shared by many people (e.g.
grouped by team), which would otherwise give everyone on that row the same
color. The hash maps algorithmically onto a hue (0–359) rather than
indexing into a small fixed palette, so it scales to a large roster without
constant collisions — background and text share the hash-chosen hue but
differ in fixed saturation/lightness, so contrast is guaranteed regardless
of which hue a name lands on. An explicit `highlightColorColumnB` value
always overrides the hashed default.

`margin.item.horizontal` is `0` globally (not a per-source setting — vis-
timeline has no per-item-type margin) specifically so two contiguous
source-B items (e.g. back-to-back on-call shifts with zero gap between them)
pack onto one line instead of each getting bumped onto its own row — margin
is pixels, and any positive value forces a stack at a 0px gap
regardless of zoom level.

Source B is strictly read-only — no id/edit/select wiring exists for it, so
its items always render with `editable: false` (dashed outline,
`.ts-source-b`) regardless of the main Edit/Select config.

### Show/hide each source

Two header checkboxes — **Show primary source** and **Show second
source** — let you toggle each source's items on and off independently.
Primary starts checked; second source starts **unchecked**, so it doesn't
crowd the primary source's own items the moment it's configured — check it
on when you actually want to see it overlaid. "Show second source" only
appears once `sourceB` is configured, same as the projected-completion
checkbox only appearing once that slot is configured.

Hiding a source only removes *its own* items — a row that still has the
other source's items in it keeps its place. A row left with nothing in it
at all (every source contributing to it is now hidden, or it only ever had
items from the now-hidden source) disappears entirely rather than lingering
as an empty swimlane. In a multi-level hierarchy this is recursive: a parent
group disappears too once every one of its descendants is empty.

### Multi-level grouping

The **Group by** slot accepts an ordered list of columns. The first column is
the top of the hierarchy; the last is the leaf swimlane where items actually
sit.

Multi-value cells (a row whose group cell holds an array or JSON-array string)
are fanned out as the **cartesian product** of every level — the item shows up
in every combination of values:

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

**Not implemented in this build** — no `visibleStartVariable`/`visibleEndVariable`
slots exist in the editor panel and no debounced writer exists in the code.
Documented here as the intended design; treat this section as aspirational
until it's wired up.

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
- Dragging an item snaps it to a whole Monday→Friday week — the smallest unit
  this Gantt edits in. Each edge snaps independently to its *nearest* week
  boundary (not the boundary it's currently over) — that dead zone is what
  keeps a resize handle from drifting a week on a stray pixel of movement. A
  body drag (grabbing the item, not an edge) moves both edges together, so its
  duration in weeks is preserved. An item can't be shrunk below one week.
  Reading a row applies none of this — see the Data section above.
- `zoomMin` is 4 weeks, `zoomMax` is 2 years.
- Vertical scroll is on; each swimlane has a minimum 64px height with a
  6px white separator between lanes.

## Stack

- React 19 + Vite 8 + TypeScript
- `@sigmacomputing/plugin` ^1.1.1
- `vis-timeline` ^8.5.1 + `vis-data` ^8.0.4
- `moment` ^2.30.1 (ISO week — Monday start)
- Dev port: 3030
