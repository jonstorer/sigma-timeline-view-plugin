import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import type {
  BuildResult,
  GroupPath,
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
  config: TimelineConfig | null | undefined,
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
  colorByStatus: Map<string, string>,
): BuildResult {
  const visuals = new Map<string, ItemVisual>()
  const rowIdByItemId = new Map<string, unknown>()
  const rowIndexByItemId = new Map<string, number>()
  const errors: string[] = []

  if (!config || !data) {
    return { items: [], groups: [], visuals, rowIdByItemId, rowIndexByItemId, errors }
  }

  const startCol = config.startDate
  const endCol = config.endDate
  const labelCol = config.label
  const idCol = config.idColumn
  const statusCol = config.statusColumn
  const pillCol = config.pillLabelColumn

  const groupCols = normalizeGroupCols(config.group)
  if (!startCol || !endCol) {
    return { items: [], groups: [], visuals, rowIdByItemId, rowIndexByItemId, errors }
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
      if (idCol) rowIdByItemId.set(itemId, rowId)
      rowIndexByItemId.set(itemId, i)
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

    for (const path of paths) {
      registerPath(path)
      const leafGroupId = pathToGroupId(path, path.length - 1)
      pushItem(`${safeId(rowId)}|${leafGroupId}`, leafGroupId)
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

  return { items, groups, visuals, rowIdByItemId, rowIndexByItemId, errors }
}

/**
 * Sigma hands variant / multi-value columns to plugins already serialized as a
 * JSON string (often pretty-printed). Re-stringifying that as part of the row
 * would double-encode it — escaped quotes and `\n` inside a string — forcing
 * consumers to parse twice. So when a cell value is itself a JSON array/object
 * string, parse it once here and nest the real structure instead. Only strings
 * that start with `[` or `{` are parsed, so plain text, numbers, hex ids, and
 * null pass through untouched (no accidental coercion of numeric-looking text).
 */
function unwrapNestedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed[0] !== '[' && trimmed[0] !== '{') return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/**
 * Serialize a source row to a JSON string carrying only the configured
 * pass-through columns, keyed by column name (falling back to column id when
 * no name is available). Built lazily for the selected row — never for every
 * row — so it stays O(columns) per click. Missing values serialize as null;
 * cells that are themselves JSON arrays/objects nest as real structure (see
 * unwrapNestedJson) rather than double-encoded strings.
 */
export function buildPassthroughJson(
  data: Record<string, unknown[]> | undefined,
  columns: Record<string, { name?: string }> | undefined,
  passthroughCols: string | string[] | undefined,
  rowIndex: number,
): string {
  const cols = normalizeGroupCols(passthroughCols)
  const row: Record<string, unknown> = {}
  for (const colId of cols) {
    const key = columns?.[colId]?.name ?? colId
    row[key] = unwrapNestedJson(data?.[colId]?.[rowIndex] ?? null)
  }
  return JSON.stringify(row)
}
