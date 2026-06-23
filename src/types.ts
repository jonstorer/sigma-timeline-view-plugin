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
  statusLegend?: string
  idColumn?: string
  label?: string
  group?: string | string[]
  startDate?: string
  endDate?: string
  pillLabelColumn?: string
  editPayloadVariable?: string
  editAction?: string
  recordIdVariable?: string
  selectAction?: string
  statusColumn?: string
  statusLegendName?: string
  statusLegendColor?: string
}

export type GroupValue = string

export type GroupPath = GroupValue[]

export interface ItemVisual {
  pill?: string
  chipColor?: string
}

export interface BuildResult {
  items: DataItem[]
  groups: DataGroup[]
  visuals: Map<string, ItemVisual>
  rowIdByItemId: Map<string, unknown>
  errors: string[]
}

export interface ParsedGroupCell {
  values: GroupValue[]
  wasMulti: boolean
}
