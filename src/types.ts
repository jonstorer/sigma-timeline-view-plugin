import type { DataGroup, DataItem } from 'vis-timeline/esnext'

export type GroupValue = string

// A single ordered tuple of values, top-down through the configured hierarchy.
// e.g. ['NA', 'Team Alpha', 'Alice'] for a region > team > assignee grouping.
export type GroupPath = GroupValue[]

export interface ItemVisual {
  pill?: string
  chipColor?: string
}

export interface BuildResult {
  items: DataItem[]
  groups: DataGroup[]
  visuals: Map<string, ItemVisual>
  errors: string[]
}

export interface ParsedGroupCell {
  values: GroupValue[]
  wasMulti: boolean
}
