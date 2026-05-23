import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import type {
  BuildResult,
  GroupPath,
  ItemVisual,
  ParsedGroupCell,
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
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        return {
          values: parsed.map(String).filter((v) => v !== ''),
          wasMulti: true,
        }
      }
    } catch {
      // fall through
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
  // vis-timeline DataSet keys items by id. Encode to a stable string.
  return String(value).replace(/\|/g, '\\|')
}

// Encode the first `level + 1` segments of a path as a single string id.
// Used so a parent group and its leaf descendants get distinct, stable ids.
export function pathToGroupId(path: GroupPath, level: number): string {
  return path
    .slice(0, level + 1)
    .map(safeId)
    .join('|')
}

// Given the parsed group cells for a single row (one per hierarchy level),
// produce the list of leaf paths the row contributes to.
//
// Semantics (cartesian product):
//   - Each level contributes its values independently.
//   - The row appears once in every combination of (level-0 value, level-1
//     value, …, level-k value) — i.e. the cartesian product across levels.
//   - Single-valued cells contribute one value (so they don't fan out).
//   - If any level's cell is empty, the row contributes no paths.
//
// Example: row with team=['A','B'] and assignee=['alice','bob'] produces
//   four paths: ['A','alice'], ['A','bob'], ['B','alice'], ['B','bob'].
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

export function buildColorByStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  legendData: Record<string, unknown[]> | undefined,
): Map<string, string> {
  const map = new Map<string, string>()
  if (!config || !legendData) return map
  const nameCol = config.statusLegendName
  const colorCol = config.statusLegendColor
  if (!nameCol || !colorCol) return map
  const names = legendData[nameCol] ?? []
  const colors = legendData[colorCol] ?? []
  for (let i = 0; i < names.length; i++) {
    const n = names[i]
    const c = colors[i]
    if (n != null && c != null && String(c).trim() !== '') {
      map.set(String(n), String(c))
    }
  }
  return map
}

// Accept either a single column name (legacy / single-level) or an array
// of column names ordered top-down through the hierarchy.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  data: Record<string, unknown[]> | undefined,
  colorByStatus: Map<string, string>,
): BuildResult {
  const visuals = new Map<string, ItemVisual>()
  const errors: string[] = []

  if (!config || !data) {
    return { items: [], groups: [], visuals, errors }
  }

  const startCol = config.start
  const endCol = config.end
  const labelCol = config.label
  const idCol = config.idColumn
  const statusCol = config.statusColumn
  const pillCol = config.pillLabelColumn

  const groupCols = normalizeGroupCols(config.group)
  if (!startCol || !endCol) {
    return { items: [], groups: [], visuals, errors }
  }
  const ungrouped = groupCols.length === 0

  const starts = data[startCol] ?? []
  const ends = data[endCol] ?? []
  const labels = labelCol ? (data[labelCol] ?? []) : []
  const groupColumnData = groupCols.map((col) => data[col] ?? [])
  const ids = idCol ? (data[idCol] ?? []) : []
  const statuses = statusCol ? (data[statusCol] ?? []) : []
  const pills = pillCol ? (data[pillCol] ?? []) : []

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

    const status = statusCol ? String(statuses[i] ?? '') : ''
    const color = status ? colorByStatus.get(status) : undefined
    const style = color ? `box-shadow: inset 5px 0 0 ${color};` : undefined
    const pill = pillCol ? String(pills[i] ?? '').trim() : ''

    const pushItem = (itemId: string, group?: string) => {
      if (pill || color) {
        visuals.set(itemId, {
          ...(pill ? { pill } : {}),
          ...(color ? { chipColor: color } : {}),
        })
      }
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
      // No group columns configured → one item per row, no `group` field.
      // vis-timeline renders ungrouped items in a single flat lane.
      pushItem(safeId(rowId))
      continue
    }

    const parsed = groupColumnData.map((col) => parseGroupCell(col[i]))
    const paths = buildPathsForRow(parsed)
    if (paths.length === 0) continue

    for (const path of paths) {
      registerPath(path)
      const leafGroupId = pathToGroupId(path, path.length - 1)
      pushItem(`${safeId(rowId)}|${leafGroupId}`, leafGroupId)
    }
  }

  // Emit DataGroups. Parents carry their nestedGroups list (sorted by child
  // content so siblings appear in alpha order). vis-timeline auto-computes
  // indentation from the parent/child structure, so we don't emit treeLevel.
  //
  // vis-timeline applies `.vis-nesting-group` only to the LABEL side of a
  // parent group, not to the body — but `data.className` is propagated to
  // both, so we use a custom `ts-parent-group` class to style both halves.
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

  // Stable order for tests and debugging: parents before children, then alpha.
  // vis-timeline renders using `groupOrder` + per-parent `nestedGroups`, so
  // DataSet order itself doesn't drive layout.
  groups.sort((a, b) => {
    const la = groupTree.get(a.id as string)?.treeLevel ?? 0
    const lb = groupTree.get(b.id as string)?.treeLevel ?? 0
    if (la !== lb) return la - lb
    return String(a.content).localeCompare(String(b.content))
  })

  return { items, groups, visuals, errors }
}
