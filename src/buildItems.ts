import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import type {
  BuildResult,
  GroupValue,
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
  const groupCol = config.group
  const idCol = config.idColumn
  const statusCol = config.statusColumn
  const pillCol = config.pillLabelColumn

  if (!startCol || !endCol || !groupCol) {
    return { items: [], groups: [], visuals, errors }
  }

  const starts = data[startCol] ?? []
  const ends = data[endCol] ?? []
  const labels = labelCol ? (data[labelCol] ?? []) : []
  const groupCells = data[groupCol] ?? []
  const ids = idCol ? (data[idCol] ?? []) : []
  const statuses = statusCol ? (data[statusCol] ?? []) : []
  const pills = pillCol ? (data[pillCol] ?? []) : []

  const rowCount = starts.length
  const groupSet = new Set<GroupValue>()
  const items: DataItem[] = []

  for (let i = 0; i < rowCount; i++) {
    const rawStart = starts[i]
    const rawEnd = ends[i]
    if (rawStart == null || rawEnd == null) continue

    const rowId = idCol ? ids[i] : `__row_${i}`
    const label = labelCol ? String(labels[i] ?? '') : ''
    const { values: groupValues } = parseGroupCell(groupCells[i])

    if (groupValues.length === 0) continue

    const status = statusCol ? String(statuses[i] ?? '') : ''
    const color = status ? colorByStatus.get(status) : undefined
    const style = color
      ? `box-shadow: inset 5px 0 0 ${color};`
      : undefined

    const pill = pillCol ? String(pills[i] ?? '').trim() : ''

    for (const gv of groupValues) {
      groupSet.add(gv)
      const itemId = `${safeId(rowId)}|${safeId(gv)}`
      if (pill || color) {
        visuals.set(itemId, {
          ...(pill ? { pill } : {}),
          ...(color ? { chipColor: color } : {}),
        })
      }
      items.push({
        id: itemId,
        group: gv,
        content: label,
        start: rawStart as DataItem['start'],
        end: rawEnd as DataItem['end'],
        type: 'range',
        ...(style ? { style } : {}),
      })
    }
  }

  const groups: DataGroup[] = Array.from(groupSet)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, content: id }))

  return { items, groups, visuals, errors }
}
