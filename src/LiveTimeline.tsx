import { useEffect, useMemo, useRef } from 'react'
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
import { snapToDay, formatDragTooltip } from './dragHelpers'
import type { ItemVisual, TimelineConfig } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

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
      // No `start`/`end` here — the opening window is set with setWindow after
      // construction (see below). Passing them as options would gate the chart's
      // initial reveal on an unreliable rangechanged event in the Sigma iframe.
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
      onMove: (item, callback) => {
        const handler = onItemEditRef.current
        const itemId = String(item.id)
        const rowId = rowIdByItemIdRef.current.get(itemId)
        const cfg = configRef.current
        const idCol = cfg?.idColumn
        const startCol = cfg?.startDate
        const endCol = cfg?.endDate
        if (!handler || rowId == null || !idCol || !startCol || !endCol) {
          callback(null)
          return
        }
        // Key the payload by the source column ids (the same keys the data
        // arrived under) so the edit action maps each field back to its column.
        const payload: ItemEditPayload = {
          [idCol]: rowId,
          [startCol]: new Date(item.start as Date).toISOString(),
          [endCol]: item.end ? new Date(item.end as Date).toISOString() : null,
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
        callback(item)
      },
      moment: (date: moment.MomentInput) => moment(date),
      snap: (date) => snapToDay(date),
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

    // Opening zoom: a 3-month window (one month back, two forward). Set via
    // setWindow rather than the `start`/`end` options on purpose — those options
    // gate vis-timeline's initial reveal on a `rangechanged` event that doesn't
    // fire reliably inside the Sigma iframe, which leaves the whole chart
    // positioned but stuck at visibility:hidden. Omitting them keeps the reveal
    // unconditional; setWindow still gives us the exact starting window.
    tl.setWindow(
      moment().subtract(1, 'month').toDate(),
      moment().add(2, 'months').toDate(),
      { animation: false },
    )

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

  useEffect(() => {
    const itemsDs = itemsDsRef.current
    const groupsDs = groupsDsRef.current
    const tl = timelineRef.current
    if (!itemsDs || !groupsDs || !tl) return
    itemsDs.clear()
    groupsDs.clear()
    if (groups.length > 0) {
      groupsDs.add(groups)
      tl.setGroups(groupsDs)
    } else {
      tl.setGroups(undefined)
    }
    itemsDs.add(items)
  }, [items, groups])

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
