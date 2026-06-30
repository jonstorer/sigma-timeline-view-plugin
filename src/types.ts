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
  pillLabelColumn?: string
  pillColorColumn?: string
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
  /** Raw value of the configured description column, shown on item hover. */
  description?: string
}

export interface BuildResult {
  items: DataItem[]
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
