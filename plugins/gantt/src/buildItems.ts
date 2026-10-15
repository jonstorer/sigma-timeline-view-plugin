import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import { addDays, dayBoundDisplaySpan, exactDisplaySpan, parseCellDate } from './weekSpan'
import type {
  BuildResult,
  GroupPath,
  GroupValue,
  ItemVisual,
  ParsedGroupCell,
  TimelineConfig,
  WidenedActualOverlay,
  WidenedProjection,
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
  // A plain string is one value, even if it contains commas — splitting on
  // commas is ambiguous (e.g. "Research, Plan, & Execute" is one group, not
  // three). Genuine multi-value cells arrive as an array or JSON array above.
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

/**
 * Parse a progress cell into a 0–1 fraction, or null when absent/non-numeric.
 * Values are clamped to [0, 1] (the configured column is a 0–1 fraction).
 */
export function parseProgress(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return Math.min(1, Math.max(0, n))
}

/**
 * Resolve a row's "projected completion" against its stored span.
 *
 * Earlier builds tried two different mechanisms for the two directions (a
 * separate `type:'range'` ghost item for "behind", so vis-timeline's stacking
 * would bump a colliding sibling out of the way). That worked for collision
 * avoidance but vis-timeline's stacking then free-floats the ghost to
 * whatever row is open at its time slot — NOT necessarily its own item's row
 * — so the ghost visually detached from the bar it belonged to whenever the
 * lane held other items.
 *
 * Both directions are now one mechanism: CSS on the item itself.
 *
 *  - AHEAD (projected earlier) never extends past the bar's own footprint, so
 *    it's just a `--projection-ratio` custom property (percentage of the
 *    item's own width, scales at any zoom level) plus `has-projection-ahead`.
 *  - BEHIND (projected later) reports `displayEnd`, the WIDENED end the
 *    caller should substitute for the item's real end while the projection
 *    toggle is on (see `buildItemsAndGroups` / `LiveTimeline`'s
 *    `widenedByItemId`). Widening the actual rendered item — rather than
 *    adding a sibling — is what makes vis-timeline's stacking treat the
 *    overrun as part of this item's own footprint: there's nothing to
 *    misalign because there's only one box, and it naturally bumps a
 *    colliding sibling for free, with no custom packing logic needed.
 *    `--projection-ratio` here marks where the real end falls within that
 *    widened box (the solid portion), not an absolute offset.
 *
 * Returns null when there's no value, it doesn't parse, or the projection
 * lands exactly on the stored end (on track, nothing to show).
 */
export function resolveProjection(
  span: { start: Date; end: Date },
  rawProjectedEnd: unknown,
):
  | { kind: 'ahead'; className: string; style: string }
  | {
      kind: 'behind'
      className: string
      style: string
      displayEnd: Date
      /** Fraction (0–1) of the widened box that's the real (unwidened)
       * portion — i.e. `--projection-ratio` / 100. Exposed separately so the
       * caller can rescale anything else expressed as a % of the item's own
       * width (e.g. the progress fill) by the same factor: widening the box
       * without rescaling would shrink that fill's *absolute* position even
       * though the underlying progress value didn't change. */
      realRatio: number
    }
  | null {
  if (rawProjectedEnd == null) return null
  const projectedDay = parseCellDate(rawProjectedEnd)
  if (!projectedDay) return null
  const projectedDisplayEnd = addDays(projectedDay, 1)

  const startMs = span.start.getTime()
  const endMs = span.end.getTime()
  const projMs = projectedDisplayEnd.getTime()

  if (projMs === endMs) return null
  if (projMs > endMs) {
    const widenedDurationMs = projMs - startMs
    const realRatio = (endMs - startMs) / widenedDurationMs
    return {
      kind: 'behind',
      className: 'has-projection-behind',
      style: `--projection-ratio: ${realRatio * 100}%;`,
      displayEnd: projectedDisplayEnd,
      realRatio,
    }
  }
  const durationMs = endMs - startMs // > 0: dayBoundDisplaySpan enforces a 1-day minimum
  const ratio = ((projMs - startMs) / durationMs) * 100
  return {
    kind: 'ahead',
    className: 'has-projection-ahead',
    style: `--projection-ratio: ${ratio}%;`,
  }
}

/**
 * Resolve the "actual dates" overlay span for a row — Actual Start Date →
 * Projected Actual End Date, entirely independent of the planned span and
 * `resolveProjection` above (see that function's doc comment: this is a
 * second, optional pair of columns, not a replacement). Both columns must
 * resolve for it to render at all (half the data isn't enough to place a
 * span).
 *
 * This used to be rendered as a separate `type:'background'` DataItem
 * scoped to the row's `group`. That broke down the moment a lane held more
 * than one stacked item (the normal case): vis-timeline can only scope a
 * background item to a *group*, not to whichever row its own dynamic
 * stacking placed a specific item on, so every item sharing a lane rendered
 * its overlay at the exact same (wrong) spot, anchored to the group's own
 * top — confirmed live (every lane showed one band pinned to the top,
 * jittering on scroll as the group's bounds were recomputed).
 *
 * Fixed by not using a second DataItem at all: see `resolveActualOverlayWidening`
 * below, which widens the *main* item's own box (same trick as
 * `resolveProjection`'s "behind" case) so the overlay always follows
 * whatever row vis-timeline stacks that item into.
 */
export function resolveActualOverlay(
  rawActualStart: unknown,
  rawProjectedActualEnd: unknown,
): { start: Date; end: Date } | null {
  const start = parseCellDate(rawActualStart)
  const projectedDay = parseCellDate(rawProjectedActualEnd)
  if (!start || !projectedDay) return null
  const end = addDays(projectedDay, 1)
  if (end.getTime() <= start.getTime()) return null
  return { start, end }
}

/**
 * Widen an item's own box to the union of its planned span and its actual-
 * overlay span, plus a style carrying where the real planned bar sits within
 * that widened box (`--planned-left`/`--planned-right`, percentages of the
 * widened box's own width). `.ts-planned-inset` (App.css) uses these to
 * render the real "solid card" look inset within the wider, translucent
 * outer box — see `templates.ts`'s `renderItemContent` for the wrapper this
 * pairs with.
 *
 * Unlike `resolveProjection`, this can widen *either* edge (an actual start
 * earlier than planned is exactly the "ahead" case this feature exists to
 * surface), so the inset has two independent insets rather than one ratio.
 */
export function resolveActualOverlayWidening(
  span: { start: Date; end: Date },
  overlay: { start: Date; end: Date },
  baseStyle: string | undefined,
): WidenedActualOverlay {
  const start = overlay.start.getTime() < span.start.getTime() ? overlay.start : span.start
  const end = overlay.end.getTime() > span.end.getTime() ? overlay.end : span.end
  const totalMs = end.getTime() - start.getTime()
  const plannedLeft = ((span.start.getTime() - start.getTime()) / totalMs) * 100
  const plannedRight = ((end.getTime() - span.end.getTime()) / totalMs) * 100
  const insetStyle = `--planned-left: ${plannedLeft}%; --planned-right: ${plannedRight}%;`
  return {
    start,
    end,
    style: baseStyle ? `${baseStyle} ${insetStyle}` : insetStyle,
  }
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

export interface BuildItemsOptions {
  /** Use the row's exact start/end instant instead of day-flooring it —
   * for data with genuine sub-day boundaries (e.g. an on-call shift).
   * Defaults to false (day-bound), matching the primary Gantt's week/day
   * granularity. */
  exactTime?: boolean
}

export function buildItemsAndGroups(
  config: TimelineConfig | null | undefined,
  data: Record<string, unknown[]> | undefined,
  options?: BuildItemsOptions,
): BuildResult {
  const resolveSpan = options?.exactTime ? exactDisplaySpan : dayBoundDisplaySpan
  const visuals = new Map<string, ItemVisual>()
  const rowIdByItemId = new Map<string, unknown>()
  const originalPathByItemId = new Map<string, GroupPath>()
  const groupValuesByRowId = new Map<string, GroupValue[][]>()
  const errors: string[] = []

  const empty = (): BuildResult => ({
    items: [],
    widenedByItemId: new Map(),
    widenedByActualId: new Map(),
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
  const progressCol = config.progressColumn
  const projectedEndCol = config.projectedEndColumn
  const pillCol = config.pillLabelColumn
  const pillColorCol = config.pillColorColumn
  const linkCol = config.linkColumn
  const descCol = config.descriptionColumn
  const actualStartCol = config.actualStartColumn
  const projectedActualEndCol = config.projectedActualEndColumn

  const groupCols = normalizeGroupCols(config.group)
  if (!startCol || !endCol) return empty()
  const ungrouped = groupCols.length === 0

  const starts = data[startCol] ?? []
  const ends = data[endCol] ?? []
  const labels = labelCol ? (data[labelCol] ?? []) : []
  const groupColumnData = groupCols.map((col) => data[col] ?? [])
  const ids = idCol ? (data[idCol] ?? []) : []
  const highlights = highlightCol ? (data[highlightCol] ?? []) : []
  const progresses = progressCol ? (data[progressCol] ?? []) : []
  const projectedEnds = projectedEndCol ? (data[projectedEndCol] ?? []) : []
  const pills = pillCol ? (data[pillCol] ?? []) : []
  const pillColors = pillColorCol ? (data[pillColorCol] ?? []) : []
  const links = linkCol ? (data[linkCol] ?? []) : []
  const descriptions = descCol ? (data[descCol] ?? []) : []
  const actualStarts = actualStartCol ? (data[actualStartCol] ?? []) : []
  const projectedActualEnds = projectedActualEndCol
    ? (data[projectedActualEndCol] ?? [])
    : []

  const rowCount = starts.length
  const items: DataItem[] = []
  const widenedByItemId = new Map<string, WidenedProjection>()
  const widenedByActualId = new Map<string, WidenedActualOverlay>()
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
    // Day-bound (default): bind to whole day columns on read — NOT snapped
    // to Mon/Fri weeks. The sheet's stored dates render as-is (an off-week
    // row looks off-week); only dragging (see LiveTimeline's onMoving/
    // onMove) enforces the weekly grain. exactTime (source B): use the raw
    // instant instead — see exactDisplaySpan. Either way, rows whose dates
    // don't parse at all are skipped.
    const span = resolveSpan(starts[i], ends[i])
    if (!span) continue

    const rowId = idCol ? ids[i] : `__row_${i}`
    const label = labelCol ? String(labels[i] ?? '') : ''

    const highlightColor = highlightCol ? String(highlights[i] ?? '').trim() : ''
    const progress = progressCol ? parseProgress(progresses[i]) : null
    const projection = projectedEndCol
      ? resolveProjection(span, projectedEnds[i])
      : null
    const actualOverlay =
      actualStartCol && projectedActualEndCol
        ? resolveActualOverlay(actualStarts[i], projectedActualEnds[i])
        : null
    // The item look is CSS-driven (see App.css). Hand the highlight color and
    // progress to the stylesheet as custom properties; `has-progress` gates the
    // progress fill so bars without a value stay solid.
    const styleParts: string[] = []
    if (highlightColor) styleParts.push(`--item-color: ${highlightColor};`)
    const pct =
      progress != null && progress > 0 ? Math.round(progress * 100) : null
    const progressPartIndex = pct != null ? styleParts.length : -1
    if (pct != null) styleParts.push(`--progress: ${pct}%;`)
    if (projection) styleParts.push(projection.style)
    const style = styleParts.length > 0 ? styleParts.join(' ') : undefined
    const classNames = [
      pct != null ? 'has-progress' : null,
      projection?.className ?? null,
      actualOverlay ? 'has-actual-overlay' : null,
    ].filter((c): c is string => c != null)
    const className = classNames.length > 0 ? classNames.join(' ') : undefined
    const pill = pillCol ? String(pills[i] ?? '').trim() : ''
    const pillColor = pillColorCol ? String(pillColors[i] ?? '').trim() : ''
    const linkUrl = linkCol ? String(links[i] ?? '').trim() : ''
    const description = descCol ? String(descriptions[i] ?? '').trim() : ''

    const pushItem = (itemId: string, group?: string) => {
      if (pill || pillColor || linkUrl || description) {
        visuals.set(itemId, {
          ...(pill ? { pill } : {}),
          ...(pillColor ? { pillColor } : {}),
          ...(linkUrl ? { linkUrl } : {}),
          ...(description ? { description } : {}),
        })
      }
      if (idCol) rowIdByItemId.set(itemId, rowId)
      items.push({
        id: itemId,
        ...(group ? { group } : {}),
        content: label,
        start: span.start,
        end: span.end,
        type: 'range',
        ...(style ? { style } : {}),
        ...(className ? { className } : {}),
      })
      if (actualOverlay) {
        widenedByActualId.set(
          itemId,
          resolveActualOverlayWidening(span, actualOverlay, style),
        )
      }
      // The caller substitutes this for the item's real end/style while the
      // projection toggle is on — see `resolveProjection`'s doc comment for
      // why widening the item itself (not a sibling) is what makes
      // vis-timeline's stacking treat the overrun as this item's own
      // footprint, with nothing to misalign. The style override only exists
      // when there's a progress fill to rescale — the fill is a % of the
      // item's own (always-visible) width, so widening without rescaling
      // would shrink its absolute position even though the progress value
      // didn't change. (--projection-ratio itself doesn't need this: it's
      // gated behind the `show-projection` class, so it's inert in the base
      // style — only the always-visible progress fill needs a toggle-aware
      // variant.)
      if (projection?.kind === 'behind') {
        const widenedStyleParts =
          progressPartIndex === -1
            ? null
            : styleParts.with(
                progressPartIndex,
                `--progress: ${pct! * projection.realRatio}%;`,
              )
        widenedByItemId.set(itemId, {
          end: projection.displayEnd,
          ...(widenedStyleParts ? { style: widenedStyleParts.join(' ') } : {}),
        })
      }
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
    widenedByItemId,
    widenedByActualId,
    groups,
    visuals,
    rowIdByItemId,
    groupColumns: groupCols,
    originalPathByItemId,
    groupValuesByRowId,
    errors,
  }
}
