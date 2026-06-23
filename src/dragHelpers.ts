import moment from 'moment'

/**
 * Snap a dragged/resized timestamp to the nearest day boundary, independent of
 * the (weekly) axis scale — vis-timeline's default snap rounds to the displayed
 * scale (weeks here), so this is passed to the documented `snap` option to get
 * day-granular dragging while keeping the weekly axis.
 */
export function snapToDay(date: Date | number): Date {
  const m = moment(date)
  const floor = m.clone().startOf('day')
  const ceil = floor.clone().add(1, 'day')
  const t = m.valueOf()
  return t - floor.valueOf() < ceil.valueOf() - t
    ? floor.toDate()
    : ceil.toDate()
}

/**
 * Tooltip shown while dragging/resizing an item (via the `tooltipOnItemUpdateTime`
 * option), so the user can see the dates they're dropping onto. Shows the live
 * start → end for a range, or just the start when there's no end.
 */
export function formatDragTooltip(item: {
  start?: unknown
  end?: unknown
}): string {
  const fmt = (d: unknown) =>
    moment(d as moment.MomentInput).format('MMM D, YYYY')
  const start = item.start != null ? fmt(item.start) : ''
  return item.end != null ? `${start} → ${fmt(item.end)}` : start
}
