import type { DataGroup, DataItem } from 'vis-timeline/esnext'

/**
 * Resolved values for the plugin's editor-panel config. Each field holds the
 * value Sigma resolves for the matching entry in `editorPanelConfig` — element
 * and column entries resolve to ids (`group` to one or many, since it allows
 * multiple), variable/action entries to their control id. All optional: the
 * config arrives partial while the author is still wiring it up.
 */
export interface TimelineConfig {
  source?: string
  /** Optional display name for source A, used only in the plugin's own
   * show/hide menu — never shown in Sigma's editor panel itself. */
  sourceAName?: string
  idColumn?: string
  label?: string
  group?: string | string[]
  startDate?: string
  endDate?: string
  highlightColorColumn?: string
  progressColumn?: string
  projectedEndColumn?: string
  /** First child ticket's actual "in progress" transition time, independent
   * of the planned start above. Both this and projectedActualEndColumn must
   * be set for the actual-dates overlay to render — see buildItems.ts's
   * resolveActualOverlay. */
  actualStartColumn?: string
  /** Projected finish based on the actual start, not the planned start —
   * paired with actualStartColumn. */
  projectedActualEndColumn?: string
  pillLabelColumn?: string
  pillColorColumn?: string
  linkColumn?: string
  descriptionColumn?: string
  editPayloadVariable?: string
  editAction?: string
  recordIdVariable?: string
  selectAction?: string
  sourceB?: string
  /** Optional display name for source B, used only in the plugin's own
   * show/hide menu — never shown in Sigma's editor panel itself. */
  sourceBName?: string
  labelB?: string
  groupB?: string | string[]
  startDateB?: string
  endDateB?: string
  highlightColorColumnB?: string
  progressColumnB?: string
  pillLabelColumnB?: string
  pillColorColumnB?: string
  linkColumnB?: string
  descriptionColumnB?: string
}

export type GroupValue = string

export type GroupPath = GroupValue[]

export interface ItemVisual {
  pill?: string
  /** #hex from the pill color column; fills the pill background. */
  pillColor?: string
  /** URL from the link column; renders a link anchored at the item's right. */
  linkUrl?: string
  /** Raw value of the configured description column, shown on item hover. */
  description?: string
}

export interface WidenedProjection {
  /** The projected display end to substitute for the item's real end. */
  end: Date
  /** The item's base style with `--planned-right` appended (how far the
   * widened box's new right edge sits past the planned bar's own real end —
   * see App.css's overage `::before` strip, which the main card needs to
   * pull back from) and, when there's a progress value, `--progress`
   * rescaled to the widened box — the fill is a % of the item's own
   * (always-visible) width, so widening without rescaling would shrink its
   * absolute position even though the underlying progress value didn't
   * change. */
  style: string
}

export interface WidenedActualOverlay {
  /** Widened start/end to substitute for the item's real start/end while the
   * actual-dates toggle is on — same "widen the rendered box" trick as
   * `WidenedProjection`, so vis-timeline's own stacking treats the overhang
   * (on *either* edge — unlike projection, the actual start can be earlier
   * than the planned start) as part of this item's own footprint. */
  start: Date
  end: Date
  /** The item's base style with the following appended, all percentages of
   * this widened box's own width:
   *   - `--planned-left`/`--planned-right` — where the planned bar sits.
   *   - `--actual-left`/`--actual-right` — where the actual-dates strip sits
   *     (independent of the planned bounds above — see
   *     `resolveActualOverlayWidening`'s doc comment in buildItems.ts for why
   *     each piece needs its own bounds rather than one shared line).
   *   - `--actual-elapsed-ratio` — within the actual strip's OWN width (not
   *     this outer box), how much of it is elapsed as of build time.
   *   - `--progress-point`, when there's a progress value — where the
   *     planned bar's fill ends.
   *   - When composed with a projection, a corrected `--projection-ratio`
   *     (and, for a "behind" projection, `--projection-end-right`) relative
   *     to this same widened box, overriding the stale value baked into the
   *     base style.
   * Consumed by App.css's `has-actual-overlay`/`has-projection-*` rules —
   * see `resolveActualOverlayWidening`'s doc comment in buildItems.ts for why
   * this is CSS on the item itself rather than a DOM wrapper. */
  style: string
}

export interface BuildResult {
  /** Items with their real (unwidened) start/end. */
  items: DataItem[]
  /** Item id → what to substitute while the projection toggle is on, for
   * items with a behind-schedule projection — see `resolveProjection`'s doc
   * comment in buildItems.ts for why widening the item itself (not a
   * sibling) is what makes vis-timeline's stacking correctly treat the
   * overrun as this item's own footprint. `end` is also used to compensate
   * drag write-back math so editing a widened bar still targets the item's
   * real stored end. */
  widenedByItemId: Map<string, WidenedProjection>
  /** Item id → what to substitute while the actual-dates toggle is on AND the
   * projection toggle is off — see `WidenedActualOverlay`. Plain actual-
   * overlay widening only, no projection composed in. */
  widenedByActualId: Map<string, WidenedActualOverlay>
  /** Item id → what to substitute while *both* the actual-dates and
   * projection toggles are on — the same actual-overlay widening, but with
   * the projection (if one resolves for this row) composed into the same
   * union box and its ratio recomputed against it, so both signals render
   * correctly on one bar at once. Equal to `widenedByActualId`'s entry for a
   * row with no projection. */
  widenedByActualAndProjectionId: Map<string, WidenedActualOverlay>
  groups: DataGroup[]
  visuals: Map<string, ItemVisual>
  rowIdByItemId: Map<string, unknown>
  /** Ordered group-column ids (the `data` keys), top → bottom of hierarchy. */
  groupColumns: string[]
  /** Each item's group path (its value in each group column) for write-back. */
  originalPathByItemId: Map<string, GroupPath>
  /** Per row, the current value set of each group column (aligned to groupColumns). */
  groupValuesByRowId: Map<string, GroupValue[][]>
  errors: string[]
}

export interface ParsedGroupCell {
  values: GroupValue[]
  wasMulti: boolean
}
