import { useEffect, useMemo, useRef } from 'react'
import { DataSet } from 'vis-data'
import {
  Timeline,
  type DataGroup,
  type DataItem,
  type TimelineItem,
  type TimelineOptions,
} from 'vis-timeline/esnext'
import moment from 'moment'
import { buildColorByStatus, buildItemsAndGroups } from './buildItems'
import { renderItemContent } from './templates'
import { SOURCE } from './editorPanel'
import type { ItemVisual, TimelineConfig } from './types'

const DAY_MS = 1000 * 60 * 60 * 24

export interface ItemEditPayload {
  id: unknown
  start: string
  end: string | null
}

export interface LiveTimelineProps {
  config: TimelineConfig | null | undefined
  data: Record<string, unknown[]> | undefined
  legendData: Record<string, unknown[]> | undefined
  onItemEdit?: (payload: ItemEditPayload) => void
}

export function LiveTimeline({
  config,
  data,
  legendData,
  onItemEdit,
}: LiveTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const itemsDsRef = useRef<DataSet<DataItem> | null>(null)
  const groupsDsRef = useRef<DataSet<DataGroup> | null>(null)
  const visualsRef = useRef<Map<string, ItemVisual>>(new Map())
  const rowIdByItemIdRef = useRef<Map<string, unknown>>(new Map())
  const onItemEditRef = useRef<typeof onItemEdit>(onItemEdit)

  const colorByStatus = useMemo(
    () => buildColorByStatus(config, legendData),
    [config, legendData],
  )

  const { items, groups, visuals, rowIdByItemId } = useMemo(
    () => buildItemsAndGroups(config, data, colorByStatus),
    [config, data, colorByStatus],
  )

  useEffect(() => {
    visualsRef.current = visuals
  }, [visuals])

  useEffect(() => {
    rowIdByItemIdRef.current = rowIdByItemId
  }, [rowIdByItemId])

  useEffect(() => {
    onItemEditRef.current = onItemEdit
  }, [onItemEdit])

  useEffect(() => {
    if (!containerRef.current) return
    const itemsDs = new DataSet<DataItem>()
    const groupsDs = new DataSet<DataGroup>()
    itemsDsRef.current = itemsDs
    groupsDsRef.current = groupsDs

    const options: TimelineOptions = {
      stack: true,
      orientation: 'top',
      start: moment().subtract(1, 'month').toDate(),
      end: moment().add(2, 'months').toDate(),
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
        item: { vertical: 14, horizontal: 10 },
        axis: 24,
      },
      verticalScroll: true,
      editable: {
        updateTime: Boolean(onItemEditRef.current),
        updateGroup: false,
        add: false,
        remove: false,
      },
      onMove: (item, callback) => {
        const handler = onItemEditRef.current
        const rowId = rowIdByItemIdRef.current.get(String(item.id))
        if (!handler || rowId == null) {
          callback(null)
          return
        }
        handler({
          id: rowId,
          start: new Date(item.start as Date).toISOString(),
          end: item.end ? new Date(item.end as Date).toISOString() : null,
        })
        callback(item)
      },
      moment: (date: moment.MomentInput) => moment(date),
      groupOrder: (a: DataGroup, b: DataGroup) =>
        String(a.content ?? a.id).localeCompare(String(b.content ?? b.id)),
      template: (item: TimelineItem) =>
        renderItemContent(item, visualsRef.current),
    }

    const tl = new Timeline(containerRef.current, itemsDs, groupsDs, options)
    timelineRef.current = tl

    return () => {
      tl.destroy()
      timelineRef.current = null
      itemsDsRef.current = null
      groupsDsRef.current = null
    }
  }, [])

  useEffect(() => {
    const tl = timelineRef.current
    if (!tl) return
    tl.setOptions({
      editable: {
        updateTime: Boolean(onItemEdit),
        updateGroup: false,
        add: false,
        remove: false,
      },
    })
    const itemsDs = itemsDsRef.current
    if (itemsDs) itemsDs.update(itemsDs.get())
  }, [onItemEdit])

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
  const missingCols = !config?.start || !config?.end

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
