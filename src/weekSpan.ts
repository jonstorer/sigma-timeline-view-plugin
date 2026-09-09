import moment from 'moment'

/**
 * Calendar math for whole-week (Monday→Friday) items.
 *
 * Two rules differ deliberately between *reading* stored data and *dragging*:
 *
 *  - Inbound cells are exact calendar days, so `displaySpanFromCells` floors
 *    to the containing week (`weekStart`) — unambiguous and idempotent.
 *  - Drag values are approximate pointer positions, so `snapDisplaySpan` rounds
 *    to the *nearest* week boundary (`nearestWeekStart`). Flooring here would
 *    mean a resize handle sitting exactly on its own Monday — which is where
 *    it starts — floors to the *previous* week on a single pixel of leftward
 *    jitter, silently kicking the item back 7 days. `nearest` gives every
 *    handle a dead zone around its own position.
 *
 * Do not unify these two rules; they're solving different problems.
 *
 * All items are stored as DATA: start = Monday 00:00, end = Friday 00:00. But
 * a bar whose end is Friday 00:00 stops at the Friday gridline and visually
 * excludes Friday, so vis-timeline is given a DISPLAY end one day later, at
 * Saturday 00:00 — the right edge of the Friday column. `displayEndToDataEnd`
 * / the `+5` in `displaySpanFromCells` are that offset. Never write a DISPLAY
 * value back to Sigma, and never format a DISPLAY end into a tooltip without
 * converting it back to the Friday the user actually dragged onto.
 *
 * Dates are handled as LOCAL midnight throughout (never `.toISOString()`,
 * which reinterprets in UTC and can shift the calendar day). This matches
 * `src/weekends.ts`'s weekend bands, which are also local-midnight — items and
 * weekend shading must agree on where midnight falls.
 */

export interface DisplaySpan {
  start: Date
  end: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Local midnight `days` from `date` (may be fractional-day-safe across DST:
 * re-flattened to midnight after the calendar-day arithmetic). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Monday 00:00 local of the week containing `date`. Idempotent. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  // getDay(): Sun=0 … Sat=6. Distance back to Monday: Mon=0, Tue=1, … Sun=6.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0) // re-flatten: the subtraction can cross a DST change
  return d
}

/** Monday 00:00 local of the week boundary nearest `date`. Ties (exactly
 * midweek) round forward, matching the old day-snap's tie convention. */
export function nearestWeekStart(date: Date): Date {
  const floor = weekStart(date)
  const ceil = addDays(floor, 7)
  const t = date.getTime()
  return t - floor.getTime() < ceil.getTime() - t ? floor : ceil
}

/**
 * Parse an inbound Sigma datetime cell (epoch ms, an ISO/naive datetime
 * string, or a Date) to the LOCAL midnight of the value's UTC calendar day.
 *
 * Rebuilding on the UTC day (not the local day) is deliberate: values written
 * back by `formatSigmaDateTime` are naive "Y-M-D H:M:S" strings with no
 * timezone marker, so Sigma stores (and returns) an instant at that wall-clock
 * time with no offset applied — i.e. effectively UTC. Reinterpreting on the
 * *local* calendar day would, in any negative-UTC-offset browser, read one day
 * early and walk the item back a week on every save. Returns null when `raw`
 * is absent or unparseable — never treat a missing value as "now".
 */
export function parseCellDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  let m: moment.Moment
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    m = moment.utc(raw)
  } else if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    m = moment.utc(raw)
  } else {
    m = moment.utc(String(raw), moment.ISO_8601, true)
    if (!m.isValid()) m = moment.utc(String(raw), 'YYYY-MM-DD HH:mm:ss', true)
    if (!m.isValid()) {
      // Last resort: the native parser, not moment's loose fallback (which
      // logs a deprecation warning for anything non-RFC2822/ISO). Reject
      // rather than guess for anything that isn't a real date string.
      const native = new Date(String(raw))
      m = Number.isNaN(native.getTime()) ? moment.invalid() : moment.utc(native)
    }
  }
  if (!m.isValid()) return null
  return new Date(m.year(), m.month(), m.date())
}

/**
 * Interpret a value vis-timeline hands back during a drag (a pixel-to-time
 * conversion) as a LOCAL instant — no UTC reinterpretation, unlike
 * `parseCellDate`. vis works entirely in local wall-clock time.
 */
export function toLocalDate(value: unknown): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value as string | number)
  return Number.isNaN(d.getTime()) ? null : d
}

/** DISPLAY end (Saturday 00:00) → DATA end (Friday 00:00). Re-derived from the
 * week lattice rather than a flat `-1 day`, so a foreign, non-Saturday
 * "exclusive end" resolves to the Friday of its own week. */
export function displayEndToDataEnd(displayEnd: Date): Date {
  return addDays(weekStart(addDays(displayEnd, -1)), 4)
}

/**
 * DISPLAY span for a data row: Monday of the start's week → Saturday of the
 * end's week (the display offset), clamped to at least one week. Floors both
 * ends — see the module doc for why this differs from `snapDisplaySpan`.
 * Idempotent: re-running it on its own output is a no-op.
 */
export function displaySpanFromCells(
  rawStart: unknown,
  rawEnd: unknown,
): DisplaySpan | null {
  const s0 = parseCellDate(rawStart)
  const e0 = parseCellDate(rawEnd)
  if (!s0 || !e0) return null
  const start = weekStart(s0)
  const end = addDays(weekStart(e0), 5)
  const minEnd = addDays(start, 5)
  return { start, end: end.getTime() < minEnd.getTime() ? minEnd : end }
}

/**
 * Re-snap a dragged DISPLAY span (start, end — both already in display space,
 * i.e. end is one day past the data Friday) to whole Mon→Sat weeks, clamped to
 * a one-week minimum. Snaps each edge independently to the *nearest* boundary
 * on its own lattice (start: Monday-phase, end: Saturday-phase, same period).
 * Because a whole-item drag shifts both edges by the same delta, this
 * preserves the item's week count without needing to know which edge (if any)
 * is being dragged — see the module doc's jitter-immunity note.
 *
 * Returns null if either input is unparseable (caller should pass the item
 * through unchanged rather than corrupt it).
 */
export function snapDisplaySpan(
  start: unknown,
  end: unknown,
): DisplaySpan | null {
  const s0 = toLocalDate(start)
  const e0 = toLocalDate(end)
  if (!s0 || !e0) return null
  const snappedStart = nearestWeekStart(s0)
  // Shift the Saturday-phase end onto the Monday lattice, snap, shift back.
  const snappedEnd = addDays(nearestWeekStart(addDays(e0, -5)), 5)
  const minEnd = addDays(snappedStart, 5)
  return {
    start: snappedStart,
    end: snappedEnd.getTime() < minEnd.getTime() ? minEnd : snappedEnd,
  }
}

/** "YYYY-MM-DD HH:mm:ss" from `date`'s LOCAL wall clock — never
 * `.toISOString()`, which converts to UTC and can shift the calendar day. */
export function formatSigmaDateTime(date: Date): string {
  return moment(date).format('YYYY-MM-DD HH:mm:ss')
}

export { DAY_MS }
