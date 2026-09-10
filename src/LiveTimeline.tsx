import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DataSet } from 'vis-data'
import {
  Timeline,
  type DataGroup,
  type DataItem,
  type TimelineEventPropertiesResult,
  type TimelineItem,
  type TimelineOptions,
} from 'vis-timeline/esnext'
import moment from 'moment'
import { applyLaneMove, buildItemsAndGroups, parseGroupId } from './buildItems'
import { renderItemContent } from './templates'
import { SOURCE } from './editorPanel'
import { formatDragTooltip } from './dragHelpers'
import { weekendBackgroundItems, WEEKEND_MAX_SPAN_DAYS } from './weekends'
import {
  displayEndToDataEnd,
  formatSigmaDateTime,
  snapDisplaySpan,
} from './weekSpan'
import type { ItemVisual, TimelineConfig } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

/**
 * Reconcile a vis-data DataSet to `next` without clearing it first. Rows not
 * in `next` are removed; rows whose content is unchanged are left completely
 * untouched (no DataSet event fires for them, so vis-timeline doesn't re-touch
 * their DOM); only rows that are new or actually differ are replaced.
 *
 * A plain `.update()` won't do here: vis-data merges partial updates onto the
 * existing object (`{...old, ...update}`), so a field that's present on the
 * old item but omitted from the new one (e.g. a cleared highlight color)
 * would silently survive. Removing + re-adding changed rows avoids that.
 *
 * `skipIds` excludes rows this effect doesn't own (weekend background bands,
 * synced separately) from both the removal and diff passes.
 */
function syncDataSet<T extends { id?: string | number }>(
  ds: DataSet<T>,
  next: T[],
  skipIds: ReadonlySet<string> = new Set(),
): void {
  const nextById = new Map(next.map((item) => [String(item.id), item]))
  const existingIds = ds
    .getIds()
    .map(String)
    .filter((id) => !skipIds.has(id))

  const staleIds = existingIds.filter((id) => !nextById.has(id))
  if (staleIds.length > 0) ds.remove(staleIds)

  const toAdd: T[] = []
  for (const id of existingIds) {
    const nextItem = nextById.get(id)
    if (!nextItem) continue
    nextById.delete(id)
    if (JSON.stringify(ds.get(id)) !== JSON.stringify(nextItem)) {
      ds.remove(id)
      toAdd.push(nextItem)
    }
  }
  toAdd.push(...nextById.values())
  if (toAdd.length > 0) ds.add(toAdd)
}

/**
 * An item update can shift vis-timeline's internal vertical scroll position as
 * a side effect of its own redraw (observed in both directions — revealing
 * rows above OR below depending on the drag — so this isn't limited to one
 * specific layout cause; it's cheaper to just undo whatever vis did than to
 * chase every trigger). This happens purely from the local vis-timeline
 * update, independent of whether the write to Sigma even succeeds.
 *
 * There's no public API to read or hold that scrollTop steady across a
 * redraw, but vis-timeline treats its left label panel's real DOM `scrollTop`
 * as the source of truth — setting it fires vis's own internal 'scroll'
 * listener, which re-syncs vis's state from it. So this isn't fighting vis,
 * just re-asserting the value after vis moves it.
 *
 * Timing: restore synchronously (catches a same-tick redraw) and again on
 * every 'changed' event vis emits for a short window afterward — 'changed'
 * fires once per completed redraw pass (vis can run a few in a row internally
 * when a layout change cascades), so it's a deterministic "redraw settled"
 * signal rather than a guessed frame count.
 */
function withPreservedVerticalScroll<T>(
  tl: Timeline | null,
  container: HTMLElement | null,
  run: () => T,
): T {
  const panel = container?.querySelector<HTMLElement>('.vis-panel.vis-left')
  const scrollTop = panel?.scrollTop
  if (!tl || !panel || scrollTop == null) return run()

  const restore = () => {
    if (panel.scrollTop !== scrollTop) panel.scrollTop = scrollTop
  }
  tl.on('changed', restore)
  const result = run()
  restore()
  setTimeout(() => tl.off('changed', restore), 100)
  return result
}

/**
 * Drag-edit write-back payload, serialized to the edit variable. Keyed by the
 * *source column ids* — the same keys the data arrived under — so the edit
 * action maps each field straight back to its column:
 *   - id column   → the row id
 *   - start / end → ISO timestamps
 *   - each Group-by column → the row's full value set for that column after the
 *     move (a between-swimlane drag swaps one lane; see `applyLaneMove`).
 */
export type ItemEditPayload = Record<string, unknown>

export interface LiveTimelineProps {
  config: TimelineConfig | null | undefined
  data: Record<string, unknown[]> | undefined
  onItemEdit?: (payload: ItemEditPayload) => void
  onItemSelect?: (recordId: string) => void
}

export function LiveTimeline({
  config,
  data,
  onItemEdit,
  onItemSelect,
}: LiveTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const itemsDsRef = useRef<DataSet<DataItem> | null>(null)
  const groupsDsRef = useRef<DataSet<DataGroup> | null>(null)
  const visualsRef = useRef<Map<string, ItemVisual>>(new Map())
  const rowIdByItemIdRef = useRef<Map<string, unknown>>(new Map())
  const onItemEditRef = useRef<typeof onItemEdit>(onItemEdit)
  const onItemSelectRef = useRef<typeof onItemSelect>(onItemSelect)
  const weekendIdsRef = useRef<string[]>([])
  // Whether groupsDs is currently the Timeline's active groups source. Lets
  // the sync effect below skip re-calling setGroups() when nothing about
  // grouped-vs-ungrouped changed — see that effect for why it matters.
  const groupsAttachedRef = useRef<boolean | null>(null)
  // The current config (for the source column ids the edit payload is keyed by)
  // and the group write-back context, read inside the once-wired onMove handler.
  const configRef = useRef(config)
  const groupCtxRef = useRef<
    Pick<
      ReturnType<typeof buildItemsAndGroups>,
      'groupColumns' | 'originalPathByItemId' | 'groupValuesByRowId'
    >
  >({
    groupColumns: [],
    originalPathByItemId: new Map(),
    groupValuesByRowId: new Map(),
  })

  const {
    items,
    groups,
    visuals,
    rowIdByItemId,
    groupColumns,
    originalPathByItemId,
    groupValuesByRowId,
  } = useMemo(() => buildItemsAndGroups(config, data), [config, data])

  useEffect(() => {
    visualsRef.current = visuals
  }, [visuals])

  useEffect(() => {
    rowIdByItemIdRef.current = rowIdByItemId
  }, [rowIdByItemId])

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    groupCtxRef.current = {
      groupColumns,
      originalPathByItemId,
      groupValuesByRowId,
    }
  }, [groupColumns, originalPathByItemId, groupValuesByRowId])

  useEffect(() => {
    onItemEditRef.current = onItemEdit
  }, [onItemEdit])

  useEffect(() => {
    onItemSelectRef.current = onItemSelect
  }, [onItemSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const itemsDs = new DataSet<DataItem>()
    const groupsDs = new DataSet<DataGroup>()
    itemsDsRef.current = itemsDs
    groupsDsRef.current = groupsDs

    const options: TimelineOptions = {
      stack: true,
      orientation: 'top',
      // No `start`/`end` options: with them, vis-timeline gates its initial
      // reveal on a `rangechanged` event that doesn't fire reliably in the Sigma
      // iframe (leaving the chart blank). Without them, vis auto-fits the window
      // to the data on first draw — so we set our fixed opening window in
      // onInitialDrawComplete below, which runs *after* that auto-fit and wins.
      onInitialDrawComplete: () => {
        // Default zoom: a 3-month window, one month back and two forward.
        timelineRef.current?.setWindow(
          moment().subtract(1, 'month').toDate(),
          moment().add(2, 'months').toDate(),
          { animation: false },
        )
      },
      zoomMin: 28 * DAY_MS,
      zoomMax: 730 * DAY_MS,
      zoomable: false,
      horizontalScroll: true,
      timeAxis: { scale: 'week', step: 1 },
      format: {
        minorLabels: { week: 'MMM D' },
        majorLabels: { week: 'MMMM YYYY' },
      },
      margin: {
        // vis-timeline insets each lane by `axis` at the top but only
        // `item.vertical / 2` at the bottom, so a small vertical left items
        // flush against the lane bottom. Bump vertical for a real bottom gap
        // (also widens spacing between stacked items, the same knob).
        item: { vertical: 24, horizontal: 10 },
        axis: 24,
      },
      verticalScroll: true,
      // Cap the timeline to its container so vertical scrolling actually engages
      // — without a maxHeight, vis-timeline grows to fit every lane and nothing
      // scrolls internally, so the whole chart (time axis included) scrolls away
      // instead of the axis staying pinned while the lanes scroll under it.
      maxHeight: '100%',
      editable: {
        updateTime: Boolean(onItemEditRef.current),
        // Lane reassignment: dragging an item onto another swimlane writes the
        // new lane back through the same edit payload/action (see onMove).
        updateGroup: Boolean(onItemEditRef.current),
        add: false,
        remove: false,
      },
      // Drag-to-move (grabbing the item body) is gated behind the same
      // selected-state check as resize in vis-timeline. Without this, a body
      // drag on an item that isn't cleanly selected at panstart falls through
      // to the Range pan and scrolls the timeline instead of moving the item.
      // Making items always draggable lets the body drag claim the gesture.
      itemsAlwaysDraggable: { item: true, range: true },
      // Week granularity is decided entirely in onMoving/onMove (below), on the
      // full-fidelity pointer position — `snap` only ever sees a bare
      // timestamp with no indication of which edge is moving, so it can't
      // apply the Monday/Friday-specific rule. Pre-rounding here would also
      // shift the nearest-week thresholds onMoving relies on.
      snap: null,
      // Live-drag snapping: keeps the bar visually on Mon->Sat weeks while the
      // user drags, independent of which edge (or the whole item) is moving.
      // Weekend background bands and end-less items pass through untouched.
      onMoving: (item, callback) => {
        if (item.type === 'background' || item.end == null) {
          callback(item)
          return
        }
        const span = snapDisplaySpan(item.start, item.end)
        withPreservedVerticalScroll(timelineRef.current, container, () =>
          callback(span ? { ...item, start: span.start, end: span.end } : item),
        )
      },
      onMove: (item, callback) => {
        const handler = onItemEditRef.current
        const itemId = String(item.id)
        const rowId = rowIdByItemIdRef.current.get(itemId)
        const cfg = configRef.current
        const idCol = cfg?.idColumn
        const startCol = cfg?.startDate
        const endCol = cfg?.endDate
        if (!handler || rowId == null || !idCol || !startCol || !endCol) {
          withPreservedVerticalScroll(timelineRef.current, container, () => callback(null))
          return
        }
        // Re-snap rather than trust onMoving's last frame: a drop can arrive
        // with no preceding panmove. Snapping is a fixed point, so re-running
        // it on an already-snapped span is a no-op.
        const span = item.end != null ? snapDisplaySpan(item.start, item.end) : null
        // Key the payload by the source column ids (the same keys the data
        // arrived under) so the edit action maps each field back to its
        // column. The end is converted from the DISPLAY Saturday back to the
        // DATA Friday, and formatted with no T/Z/millis — Sigma's Date()
        // parses "YYYY-MM-DD HH:MM:SS" natively but not ISO 8601.
        const payload: ItemEditPayload = {
          [idCol]: rowId,
          [startCol]: span ? formatSigmaDateTime(span.start) : null,
          [endCol]: span ? formatSigmaDateTime(displayEndToDataEnd(span.end)) : null,
        }
        // Lane reassignment: item.group is the lane the item was dropped onto.
        // Treat each group column independently and emit its full value set for
        // the row after swapping this item's old lane value for the new one.
        const { groupColumns, originalPathByItemId, groupValuesByRowId } =
          groupCtxRef.current
        if (groupColumns.length > 0 && item.group != null) {
          const oldPath = originalPathByItemId.get(itemId) ?? []
          const newPath = parseGroupId(String(item.group))
          const current =
            groupValuesByRowId.get(String(rowId)) ?? groupColumns.map(() => [])
          const updated = applyLaneMove(current, oldPath, newPath)
          groupColumns.forEach((col, idx) => {
            payload[col] = updated[idx] ?? []
          })
        }
        handler(payload)
        withPreservedVerticalScroll(timelineRef.current, container, () =>
          callback(span ? { ...item, start: span.start, end: span.end } : item),
        )
      },
      moment: (date: moment.MomentInput) => moment(date),
      tooltipOnItemUpdateTime: {
        template: (item: { start?: unknown; end?: unknown }) =>
          formatDragTooltip(item),
      },
      groupOrder: (a: DataGroup, b: DataGroup) =>
        String(a.content ?? a.id).localeCompare(String(b.content ?? b.id)),
      template: (item: TimelineItem) =>
        renderItemContent(item, visualsRef.current),
    }

    const tl = new Timeline(container, itemsDs, groupsDs, options)
    timelineRef.current = tl

    // vis-timeline only builds its drag tooltip (the date readout shown while
    // an item's start/end is dragged) for *selected* items. With
    // itemsAlwaysDraggable a body drag can claim the gesture without the item
    // ever being selected, so the tooltip never appears. Select the item under
    // the pointer on pointerdown so the tooltip exists before the drag moves.
    // Gated to edit mode: selection is only useful here to drive that tooltip.
    const selectOnPointerDown = (event: PointerEvent) => {
      if (!onItemEditRef.current) return
      const itemId = tl.getEventProperties(event).item
      if (itemId != null) tl.setSelection([itemId])
    }
    container.addEventListener('pointerdown', selectOnPointerDown)

    // Hover card: a single reused popup element. The plugin doesn't format the
    // value — it shows the raw description column verbatim, so authors control
    // the content entirely from Sigma.
    const hoverCard = document.createElement('div')
    hoverCard.className = 'ts-hover-card'
    hoverCard.style.display = 'none'
    container.appendChild(hoverCard)

    const hideHoverCard = () => {
      hoverCard.style.display = 'none'
    }

    const showHoverCard = (props: TimelineEventPropertiesResult) => {
      const itemId = props.item
      const description =
        itemId == null
          ? undefined
          : visualsRef.current.get(String(itemId))?.description
      if (!description) {
        hideHoverCard()
        return
      }
      hoverCard.textContent = description

      // Measure off-screen, then place near the cursor and flip toward the
      // viewport edge so the card never overflows. Positioned fixed so it
      // escapes the timeline host's overflow clipping.
      const ev = props.event as MouseEvent | undefined
      const x = ev?.clientX ?? props.pageX ?? 0
      const y = ev?.clientY ?? props.pageY ?? 0
      hoverCard.style.left = '0'
      hoverCard.style.top = '0'
      hoverCard.style.display = 'block'
      const { offsetWidth: w, offsetHeight: h } = hoverCard
      const left = x + 14 + w > window.innerWidth - 8 ? x - w - 14 : x + 14
      const top = y + 14 + h > window.innerHeight - 8 ? y - h - 14 : y + 14
      hoverCard.style.left = `${Math.max(8, left)}px`
      hoverCard.style.top = `${Math.max(8, top)}px`
    }

    tl.on('itemover', showHoverCard)
    tl.on('itemout', hideHoverCard)

    tl.on('doubleClick', (props: TimelineEventPropertiesResult) => {
      const handler = onItemSelectRef.current
      // The `doubleClick` event carries the single `item` under the cursor
      // (null when the double-click misses an item).
      const itemId = props.item
      if (!handler || itemId == null) return
      const rowId = rowIdByItemIdRef.current.get(String(itemId))
      if (rowId == null) return
      handler(String(rowId))
    })

    return () => {
      container.removeEventListener('pointerdown', selectOnPointerDown)
      tl.destroy()
      hoverCard.remove()
      timelineRef.current = null
      itemsDsRef.current = null
      groupsDsRef.current = null
    }
  }, [])

  // Toggle drag affordances when editing turns on/off. Keyed on the boolean,
  // not the `onItemEdit` callback identity — the callback's identity changes
  // whenever its deps (e.g. column metadata) do, and re-running the full
  // itemsDs.update() on every such change is needless churn. onMove always
  // reads the latest callback via onItemEditRef.
  const editingEnabled = Boolean(onItemEdit)
  useEffect(() => {
    const tl = timelineRef.current
    if (!tl) return
    tl.setOptions({
      editable: {
        updateTime: editingEnabled,
        updateGroup: editingEnabled,
        add: false,
        remove: false,
      },
    })
    const itemsDs = itemsDsRef.current
    if (itemsDs) itemsDs.update(itemsDs.get())
  }, [editingEnabled])

  // Shade weekends across the visible window (plus a window-span buffer each
  // side). Regenerated on pan/zoom via `rangechanged` and after data reloads.
  // Skipped when zoomed out past WEEKEND_MAX_SPAN_DAYS, where per-week bands
  // would just be noise.
  const syncWeekends = useCallback(() => {
    const tl = timelineRef.current
    const ds = itemsDsRef.current
    if (!tl || !ds) return
    if (weekendIdsRef.current.length > 0) {
      ds.remove(weekendIdsRef.current)
      weekendIdsRef.current = []
    }
    const win = tl.getWindow()
    const span = win.end.getTime() - win.start.getTime()
    if (span / DAY_MS > WEEKEND_MAX_SPAN_DAYS) return
    const wk = weekendBackgroundItems(
      new Date(win.start.getTime() - span),
      new Date(win.end.getTime() + span),
    )
    ds.add(wk as DataItem[])
    weekendIdsRef.current = wk.map((w) => String((w as { id: unknown }).id))
  }, [])

  useEffect(() => {
    const tl = timelineRef.current
    if (!tl) return
    tl.on('rangechanged', syncWeekends)
    return () => tl.off('rangechanged', syncWeekends)
  }, [syncWeekends])

  useEffect(() => {
    const itemsDs = itemsDsRef.current
    const groupsDs = groupsDsRef.current
    const tl = timelineRef.current
    if (!itemsDs || !groupsDs || !tl) return

    withPreservedVerticalScroll(tl, containerRef.current, () => {
      // Diff instead of clear()+add(): every edit re-sends the full dataset,
      // so `items`/`groups` get new array identities on every keystroke-
      // equivalent change even when almost nothing actually differs. A
      // clear() briefly empties the DataSet and re-adding everything touches
      // every item's DOM node, which is what was resetting scroll position on
      // each edit. Untouched rows are now left alone entirely. (A real
      // content change can still legitimately alter a lane's stacked height,
      // which is what withPreservedVerticalScroll guards against.)
      syncDataSet(groupsDs, groups)

      // setGroups() rebinds the Timeline's rendering to the groups source and
      // resets its internal scroll — only call it on an actual grouped <->
      // ungrouped transition, not every time (groupsDs is the same instance
      // on every render; re-passing it is a no-op vis can't distinguish from
      // "start over").
      const hasGroups = groups.length > 0
      if (groupsAttachedRef.current !== hasGroups) {
        tl.setGroups(hasGroups ? groupsDs : undefined)
        groupsAttachedRef.current = hasGroups
      }

      syncDataSet(itemsDs, items, new Set(weekendIdsRef.current))
      syncWeekends()
    })
  }, [items, groups, syncWeekends])

  const hasSource = Boolean(config?.[SOURCE])
  const missingCols = !config?.startDate || !config?.endDate

  const laneCount = groups.filter(
    (g) => !g.nestedGroups || g.nestedGroups.length === 0,
  ).length

  const zoomIn = () => timelineRef.current?.zoomIn(0.3)
  const zoomOut = () => timelineRef.current?.zoomOut(0.3)

  return (
    <div className="timeline-root">
      <header className="timeline-header">
        <div className="timeline-header-text">
          <h1>Timeline</h1>
          <p className="timeline-sub">
            {!hasSource
              ? 'Pick a data source in the editor panel.'
              : missingCols
                ? 'Pick Start and End columns in the editor panel.'
                : laneCount === 0
                  ? `${items.length} item${items.length === 1 ? '' : 's'}.`
                  : `${items.length} item${items.length === 1 ? '' : 's'} across ${laneCount} lane${laneCount === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className="timeline-toolbar">
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="timeline-zoom-btn"
            onClick={zoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </header>
      <div ref={containerRef} className="timeline-host" />
    </div>
  )
}
