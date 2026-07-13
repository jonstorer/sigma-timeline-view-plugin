import type { DataItem } from 'vis-timeline/esnext'

/** Below this visible span (in days) weekends are shown; above it they'd be too
 * dense to be useful, so the caller clears them. ~3 months (a few days over the
 * default 1-back/2-forward window): weekends show at the default zoom and while
 * zoomed in, and drop once you zoom out past ~3 months. */
export const WEEKEND_MAX_SPAN_DAYS = 95

/**
 * One vis-timeline background item per weekend (Sat 00:00 → Mon 00:00) covering
 * [from, to]. Rendered as a full-height band behind the items; the two-tone
 * Sat/Sun look comes from CSS (`.ts-weekend`), which splits the 2-day span at
 * its midpoint (= Sun 00:00). Ids are derived from the Saturday timestamp so a
 * given weekend keeps a stable id across re-syncs.
 */
export function weekendBackgroundItems(from: Date, to: Date): DataItem[] {
  const items: DataItem[] = []
  const day = new Date(from)
  day.setHours(0, 0, 0, 0)
  // advance to the first Saturday on/after `from`
  while (day.getDay() !== 6) day.setDate(day.getDate() + 1)
  while (day <= to) {
    const sat = new Date(day)
    const mon = new Date(day)
    mon.setDate(mon.getDate() + 2)
    items.push({
      id: `__weekend_${sat.getTime()}`,
      start: sat,
      end: mon,
      type: 'background',
      className: 'ts-weekend',
    } as DataItem)
    day.setDate(day.getDate() + 7)
  }
  return items
}
