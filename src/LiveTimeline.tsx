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
import type { ItemVisual } from './types'

export interface LiveTimelineProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
  data: Record<string, unknown[]> | undefined
  legendData: Record<string, unknown[]> | undefined
}

export function LiveTimeline({ config, data, legendData }: LiveTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const itemsDsRef = useRef<DataSet<DataItem> | null>(null)
  const groupsDsRef = useRef<DataSet<DataGroup> | null>(null)
  const visualsRef = useRef<Map<string, ItemVisual>>(new Map())

  const colorByStatus = useMemo(
    () => buildColorByStatus(config, legendData),
    [config, legendData],
  )

  const { items, groups, visuals } = useMemo(
    () => buildItemsAndGroups(config, data, colorByStatus),
    [config, data, colorByStatus],
  )

  useEffect(() => {
    visualsRef.current = visuals
  }, [visuals])

  // One-time Timeline construction (read-only baseline — drag/add/lazy-load
  // wiring deliberately omitted; will be added back as separate capabilities).
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
      zoomMin: 1000 * 60 * 60 * 24 * 28, // 4 weeks
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 2, // 2 years
      // Mouse wheel pans the timeline horizontally; zoom is via the toolbar.
      zoomable: false,
      horizontalScroll: true,
      timeAxis: { scale: 'week', step: 1 },
      format: {
        minorLabels: { week: 'MMM D' },
        majorLabels: { week: 'MMMM YYYY' },
      },
      margin: {
        item: { vertical: 12, horizontal: 10 },
        axis: 24,
      },
      verticalScroll: true,
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

  // Push items + groups updates whenever the data builds change
  useEffect(() => {
    const itemsDs = itemsDsRef.current
    const groupsDs = groupsDsRef.current
    if (!itemsDs || !groupsDs) return
    itemsDs.clear()
    groupsDs.clear()
    groupsDs.add(groups)
    itemsDs.add(items)
  }, [items, groups])

  const hasSource = Boolean(config?.[SOURCE])
  const missingCols =
    !config?.start || !config?.end || !config?.group ? true : false

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
                ? 'Pick Start, End, and Group columns in the editor panel.'
                : `${items.length} item${items.length === 1 ? '' : 's'} across ${groups.length} lane${groups.length === 1 ? '' : 's'}.`}
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
