import moment from 'moment'
import {
  displayEndToDataEnd,
  snapDisplaySpan,
  toLocalDate,
  weekStart,
} from './weekSpan'

/**
 * Tooltip shown while dragging/resizing an item (via the `tooltipOnItemUpdateTime`
 * option), so the user can see the dates they're dropping onto.
 *
 * `item.end` here is a DISPLAY value (Saturday — see `weekSpan.ts`), one day
 * past the Friday that will actually be written to Sigma. Convert back before
 * formatting, or the tooltip shows the user a Saturday they never asked for.
 */
export function formatDragTooltip(item: {
  start?: unknown
  end?: unknown
}): string {
  const fmt = (d: Date) => moment(d).format('MMM D, YYYY')
  const start = toLocalDate(item.start)
  if (!start) return ''
  if (item.end == null) return fmt(weekStart(start))
  // Defensive re-snap: by the time this template runs the item has already
  // gone through onMoving, but re-snapping is a no-op on a fixed point and
  // keeps the tooltip correct even on a frame this component didn't produce.
  const span = snapDisplaySpan(item.start, item.end)
  if (!span) return fmt(weekStart(start))
  return `${fmt(span.start)} → ${fmt(displayEndToDataEnd(span.end))}`
}
