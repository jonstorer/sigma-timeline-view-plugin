import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import type {
  BuildResult,
  GroupPath,
  GroupValue,
  ItemVisual,
  ParsedGroupCell,
  TimelineConfig,
} from './types'

export function parseGroupCell(raw: unknown): ParsedGroupCell {
  if (raw == null) return { values: [], wasMulti: false }
  if (Array.isArray(raw)) {
    return {
      values: raw.map(String).filter((v) => v !== ''),
      wasMulti: true,
    }
  }
  const s = String(raw).trim()
  if (s === '') return { values: [], wasMulti: false }
  if (s.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(s)
    } catch {
      parsed = null
    }
    if (Array.isArray(parsed)) {
      return {
        values: parsed.map(String).filter((v) => v !== ''),
        wasMulti: true,
      }
    }
  }
  if (s.includes(',')) {
    return {
      values: s
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== ''),
      wasMulti: true,
    }
  }
  return { values: [s], wasMulti: false }
}

export function safeId(value: unknown): string {
  return String(value).replace(/\|/g, '\\|')
}

export function pathToGroupId(path: GroupPath, level: number): string {
  return path
    .slice(0, level + 1)
    .map(safeId)
    .join('|')
}

/**
 * Inverse of `pathToGroupId` / `safeId`: split a group id back into its ordered
 * path segments, honoring the `\|` escaping `safeId` applies. Used to turn the
 * lane an item was dropped onto back into the per-level group values, which map
 * positionally to the configured group columns for write-back.
 */
export function parseGroupId(id: string): GroupPath {
  const segments: string[] = []
  let current = ''
  for (let i = 0; i < id.length; i++) {
    const ch = id[i]
    if (ch === '\\' && id[i + 1] === '|') {
      current += '|'
      i++
    } else if (ch === '|') {
      segments.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  segments.push(current)
  return segments
}

/**
 * Recompute each group column's value set for a row after one of its
 * lane-instances is dragged from `oldPath` to `newPath`. Group columns are
 * independent (no enforced hierarchy), so each column just swaps its old value
 * for the new one — the row's other lane memberships are preserved, which is
 * how a one-row-many-lanes move stays conflict-free. Returns one value array
 * per column, aligned to `currentByColumn`. A column whose value is unchanged
 * (or whose level isn't in the dropped path) is returned as-is; a drop onto a
 * lane the row already occupies dedupes (effectively a merge).
 */
export function applyLaneMove(
  currentByColumn: GroupValue[][],
  oldPath: GroupPath,
  newPath: GroupPath,
): GroupValue[][] {
  return currentByColumn.map((values, col) => {
    const from = oldPath[col]
    const to = newPath[col]
    if (to == null || from === to) return [...values]
    const next: GroupValue[] = []
    let replaced = false
    for (const v of values) {
      if (!replaced && v === from) {
        next.push(to)
        replaced = true
      } else {
        next.push(v)
      }
    }
    if (!replaced) next.push(to)
    return next.filter((v, idx) => next.indexOf(v) === idx)
  })
}

export function buildPathsForRow(parsed: ParsedGroupCell[]): GroupPath[] {
  if (parsed.length === 0) return []
  if (parsed.some((p) => p.values.length === 0)) return []

  let paths: GroupPath[] = [[]]
  for (const cell of parsed) {
    const next: GroupPath[] = []
    for (const prefix of paths) {
      for (const value of cell.values) {
        next.push([...prefix, value])
      }
    }
    paths = next
  }
  return paths
}

function normalizeGroupCols(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter((s) => s !== '')
  if (raw == null || raw === '') return []
  return [String(raw)]
}

interface GroupNode {
  content: string
  treeLevel: number
  nestedGroups: Set<string>
}

export function buildItemsAndGroups(
  config: TimelineConfig | null | undefined,
  data: Record<string, unknown[]> | undefined,
): BuildResult {
  const visuals = new Map<string, ItemVisual>()
  const rowIdByItemId = new Map<string, unknown>()
  const originalPathByItemId = new Map<string, GroupPath>()
  const groupValuesByRowId = new Map<string, GroupValue[][]>()
  const errors: string[] = []

  const empty = (): BuildResult => ({
    items: [],
    groups: [],
    visuals,
    rowIdByItemId,
    groupColumns: [],
    originalPathByItemId,
    groupValuesByRowId,
    errors,
  })

  if (!config || !data) return empty()

  const startCol = config.startDate
  const endCol = config.endDate
  const labelCol = config.label
  const idCol = config.idColumn
  const highlightCol = config.highlightColorColumn
  const pillCol = config.pillLabelColumn
  const pillColorCol = config.pillColorColumn
  const descCol = config.descriptionColumn

  const groupCols = normalizeGroupCols(config.group)
  if (!startCol || !endCol) return empty()
  const ungrouped = groupCols.length === 0

  const starts = data[startCol] ?? []
  const ends = data[endCol] ?? []
  const labels = labelCol ? (data[labelCol] ?? []) : []
  const groupColumnData = groupCols.map((col) => data[col] ?? [])
  const ids = idCol ? (data[idCol] ?? []) : []
  const highlights = highlightCol ? (data[highlightCol] ?? []) : []
  const pills = pillCol ? (data[pillCol] ?? []) : []
  const pillColors = pillColorCol ? (data[pillColorCol] ?? []) : []
  const descriptions = descCol ? (data[descCol] ?? []) : []

  const rowCount = starts.length
  const items: DataItem[] = []
  const groupTree = new Map<string, GroupNode>()

  const registerPath = (path: GroupPath) => {
    for (let level = 0; level < path.length; level++) {
      const id = pathToGroupId(path, level)
      if (!groupTree.has(id)) {
        groupTree.set(id, {
          content: path[level],
          treeLevel: level,
          nestedGroups: new Set(),
        })
      }
      if (level > 0) {
        const parentId = pathToGroupId(path, level - 1)
        groupTree.get(parentId)!.nestedGroups.add(id)
      }
    }
  }

  for (let i = 0; i < rowCount; i++) {
    const rawStart = starts[i]
    const rawEnd = ends[i]
    if (rawStart == null || rawEnd == null) continue

    const rowId = idCol ? ids[i] : `__row_${i}`
    const label = labelCol ? String(labels[i] ?? '') : ''

    const highlightColor = highlightCol ? String(highlights[i] ?? '').trim() : ''
    const style = highlightColor
      ? `box-shadow: inset 6px 0 0 ${highlightColor};`
      : undefined
    const pill = pillCol ? String(pills[i] ?? '').trim() : ''
    const pillColor = pillColorCol ? String(pillColors[i] ?? '').trim() : ''
    const description = descCol ? String(descriptions[i] ?? '').trim() : ''

    const pushItem = (itemId: string, group?: string) => {
      if (pill || pillColor || description) {
        visuals.set(itemId, {
          ...(pill ? { pill } : {}),
          ...(pillColor ? { pillColor } : {}),
          ...(description ? { description } : {}),
        })
      }
      if (idCol) rowIdByItemId.set(itemId, rowId)
      items.push({
        id: itemId,
        ...(group ? { group } : {}),
        content: label,
        start: rawStart as DataItem['start'],
        end: rawEnd as DataItem['end'],
        type: 'range',
        ...(style ? { style } : {}),
      })
    }

    if (ungrouped) {
      pushItem(safeId(rowId))
      continue
    }

    const parsed = groupColumnData.map((col) => parseGroupCell(col[i]))
    const paths = buildPathsForRow(parsed)
    if (paths.length === 0) continue
    groupValuesByRowId.set(
      String(rowId),
      parsed.map((p) => p.values),
    )

    for (const path of paths) {
      registerPath(path)
      const leafGroupId = pathToGroupId(path, path.length - 1)
      const itemId = `${safeId(rowId)}|${leafGroupId}`
      originalPathByItemId.set(itemId, path)
      pushItem(itemId, leafGroupId)
    }
  }

  const groups: DataGroup[] = []
  for (const [id, node] of groupTree) {
    const group: DataGroup = { id, content: node.content }
    if (node.nestedGroups.size > 0) {
      const sortedChildren = Array.from(node.nestedGroups).sort((a, b) => {
        const ca = groupTree.get(a)?.content ?? a
        const cb = groupTree.get(b)?.content ?? b
        return ca.localeCompare(cb)
      })
      group.nestedGroups = sortedChildren
      group.className = 'ts-parent-group'
    }
    groups.push(group)
  }

  groups.sort((a, b) => {
    const la = groupTree.get(a.id as string)?.treeLevel ?? 0
    const lb = groupTree.get(b.id as string)?.treeLevel ?? 0
    if (la !== lb) return la - lb
    return String(a.content).localeCompare(String(b.content))
  })

  return {
    items,
    groups,
    visuals,
    rowIdByItemId,
    groupColumns: groupCols,
    originalPathByItemId,
    groupValuesByRowId,
    errors,
  }
}
