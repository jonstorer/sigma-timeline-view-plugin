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
  idColumn?: string
  label?: string
  group?: string | string[]
  startDate?: string
  endDate?: string
  highlightColorColumn?: string
  progressColumn?: string
  projectedEndColumn?: string
  pillLabelColumn?: string
  pillColorColumn?: string
  linkColumn?: string
  descriptionColumn?: string
  editPayloadVariable?: string
  editAction?: string
  recordIdVariable?: string
  selectAction?: string
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
  /** The item's style string recomputed with `--progress` rescaled to the
   * widened box — the fill is a % of the item's own (always-visible) width,
   * so widening without rescaling would shrink its absolute position even
   * though the underlying progress value didn't change. Undefined when the
   * item has no progress value (nothing needs to change from the base
   * style — `--projection-ratio` itself is inert until `show-projection` is
   * present, so it doesn't need a toggle-aware variant). */
  style?: string
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
