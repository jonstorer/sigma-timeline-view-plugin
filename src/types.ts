import type { DataGroup, DataItem } from 'vis-timeline/esnext'

export type GroupValue = string

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
