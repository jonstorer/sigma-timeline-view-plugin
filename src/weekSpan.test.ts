import { describe, expect, test } from 'vitest'
import {
  addDays,
  displayEndToDataEnd,
  displaySpanFromCells,
  formatSigmaDateTime,
  nearestWeekStart,
  parseCellDate,
  snapDisplaySpan,
  toLocalDate,
  weekStart,
} from './weekSpan'

// This suite assumes vitest.config.ts pins TZ to a negative-offset zone
// (America/Los_Angeles) — that's what makes the UTC-midnight-slips-a-day bug
// (and DST) reproducible at all.
test('suite runs in a fixed negative-offset zone', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(480)
})

describe('weekStart', () => {
  test('Monday maps to itself', () => {
    const mon = new Date(2026, 4, 4) // Mon May 4, 2026
    expect(weekStart(mon).getTime()).toBe(mon.getTime())
  })

  test('Sunday maps to the previous Monday', () => {
    expect(weekStart(new Date(2026, 4, 10)).getTime()).toBe(
      new Date(2026, 4, 4).getTime(),
    )
  })

  test('Friday maps to that week\'s Monday', () => {
    expect(weekStart(new Date(2026, 4, 8)).getTime()).toBe(
      new Date(2026, 4, 4).getTime(),
    )
  })

  test('crosses the spring-forward transition and stays at local midnight', () => {
    // Sun Mar 8 2026 is the US spring-forward date.
    const result = weekStart(new Date(2026, 2, 8, 12))
    expect(result.getTime()).toBe(new Date(2026, 2, 2).getTime())
    expect(result.getHours()).toBe(0)
  })

  test('crosses the fall-back transition and stays at local midnight', () => {
    // Sun Nov 1 2026 is the US fall-back date.
    const result = weekStart(new Date(2026, 10, 7))
    expect(result.getTime()).toBe(new Date(2026, 10, 2).getTime())
    expect(result.getHours()).toBe(0)
  })
})

describe('nearestWeekStart', () => {
  const monday = new Date(2026, 4, 4)

  test('+3 days rounds down to the same Monday', () => {
    expect(nearestWeekStart(addDays(monday, 3)).getTime()).toBe(
      monday.getTime(),
    )
  })

  test('+4 days rounds up to the next Monday', () => {
    expect(nearestWeekStart(addDays(monday, 4)).getTime()).toBe(
      addDays(monday, 7).getTime(),
    )
  })

  test('exactly midweek (a tie) rounds forward', () => {
    const midweek = new Date(monday.getTime() + 3.5 * 24 * 60 * 60 * 1000)
    expect(nearestWeekStart(midweek).getTime()).toBe(addDays(monday, 7).getTime())
  })
})

describe('parseCellDate', () => {
  const expectMonMay4 = (d: Date | null) => {
    expect(d?.getTime()).toBe(new Date(2026, 4, 4).getTime())
  }

  test('epoch ms (UTC midnight)', () => {
    expectMonMay4(parseCellDate(Date.UTC(2026, 4, 4)))
  })

  test('date-only ISO string', () => {
    expectMonMay4(parseCellDate('2026-05-04'))
  })

  test('ISO datetime with Z', () => {
    expectMonMay4(parseCellDate('2026-05-04T00:00:00Z'))
  })

  test('the naive write-back shape ("Y-M-D H:M:S")', () => {
    expectMonMay4(parseCellDate('2026-05-04 00:00:00'))
  })

  test('ISO datetime with milliseconds and Z', () => {
    expectMonMay4(parseCellDate('2026-05-04T00:00:00.000Z'))
  })

  test('a Date object', () => {
    expectMonMay4(parseCellDate(new Date(Date.UTC(2026, 4, 4))))
  })

  test('an explicit-offset ISO string', () => {
    expectMonMay4(parseCellDate('2026-05-04T00:00:00-07:00'))
  })

  test('null, undefined, and empty string are all null (not "now")', () => {
    expect(parseCellDate(null)).toBeNull()
    expect(parseCellDate(undefined)).toBeNull()
    expect(parseCellDate('')).toBeNull()
  })

  test('garbage input is null', () => {
    expect(parseCellDate('N/A')).toBeNull()
    expect(parseCellDate(NaN)).toBeNull()
    expect(parseCellDate({})).toBeNull()
  })
})

describe('toLocalDate', () => {
  test('a Date passes through unchanged', () => {
    const d = new Date(2026, 4, 4, 13, 30)
    expect(toLocalDate(d)?.getTime()).toBe(d.getTime())
  })

  test('null is null', () => {
    expect(toLocalDate(null)).toBeNull()
  })

  test('unparseable is null', () => {
    expect(toLocalDate('not a date')).toBeNull()
  })
})

describe('displaySpanFromCells', () => {
  test('a mid-week row renders as Mon of the start week -> Sat of the end week', () => {
    // Wed May 6 -> Wed May 20 (two weeks later)
    const span = displaySpanFromCells('2026-05-06', '2026-05-20')
    expect(span?.start.getTime()).toBe(new Date(2026, 4, 4).getTime()) // Mon May 4
    expect(span?.end.getTime()).toBe(new Date(2026, 4, 23).getTime()) // Sat May 23
  })

  test('an already-correct Mon/Fri row is unchanged (idempotent)', () => {
    const span = displaySpanFromCells('2026-05-04 00:00:00', '2026-05-08 00:00:00')
    expect(span?.start.getTime()).toBe(new Date(2026, 4, 4).getTime())
    expect(span?.end.getTime()).toBe(new Date(2026, 4, 9).getTime()) // Sat display end
  })

  test('a UTC-midnight epoch start does not slip to the previous local week', () => {
    const span = displaySpanFromCells(Date.UTC(2026, 4, 4), Date.UTC(2026, 4, 8))
    expect(span?.start.getTime()).toBe(new Date(2026, 4, 4).getTime())
  })

  test('a single-day row (start === end) becomes one full week', () => {
    const span = displaySpanFromCells('2026-05-06', '2026-05-06') // Wed
    expect(span?.start.getTime()).toBe(new Date(2026, 4, 4).getTime())
    expect(span?.end.getTime()).toBe(new Date(2026, 4, 9).getTime())
  })

  test('end before start is clamped to one week', () => {
    const span = displaySpanFromCells('2026-05-11', '2026-05-04') // end a week before start
    expect(span?.start.getTime()).toBe(new Date(2026, 4, 11).getTime())
    expect(span?.end.getTime()).toBe(new Date(2026, 4, 16).getTime())
  })

  test('null or unparseable start/end yields null', () => {
    expect(displaySpanFromCells(null, '2026-05-08')).toBeNull()
    expect(displaySpanFromCells('2026-05-04', null)).toBeNull()
    expect(displaySpanFromCells('garbage', 'garbage')).toBeNull()
  })

  test('a span whose weeks straddle a DST boundary stays at local midnight', () => {
    // Wed Mar 4 -> Wed Mar 11 2026, straddling the Mar 8 spring-forward.
    const span = displaySpanFromCells('2026-03-04', '2026-03-11')
    expect(span?.start.getHours()).toBe(0)
    expect(span?.end.getHours()).toBe(0)
  })

  test('round-trips through formatSigmaDateTime', () => {
    const span = displaySpanFromCells('2026-05-04', '2026-05-08')!
    const dataEnd = displayEndToDataEnd(span.end)
    const restart = displaySpanFromCells(
      formatSigmaDateTime(span.start),
      formatSigmaDateTime(dataEnd),
    )
    expect(restart?.start.getTime()).toBe(span.start.getTime())
    expect(restart?.end.getTime()).toBe(span.end.getTime())
  })

  test('applying it twice is a no-op (idempotent)', () => {
    const once = displaySpanFromCells('2026-05-06', '2026-05-20')!
    const dataEnd = displayEndToDataEnd(once.end)
    const twice = displaySpanFromCells(once.start, dataEnd)
    expect(twice?.start.getTime()).toBe(once.start.getTime())
    expect(twice?.end.getTime()).toBe(once.end.getTime())
  })
})

describe('snapDisplaySpan', () => {
  // A pre-snapped 1-week display span: Mon May 4 -> Sat May 9.
  const mon = new Date(2026, 4, 4)
  const sat = new Date(2026, 4, 9)

  test('a 3-day body drag does not move a snapped span', () => {
    const span = snapDisplaySpan(addDays(mon, 3), addDays(sat, 3))
    expect(span?.start.getTime()).toBe(mon.getTime())
    expect(span?.end.getTime()).toBe(sat.getTime())
  })

  test('a 4-day body drag moves the span exactly one week', () => {
    const span = snapDisplaySpan(addDays(mon, 4), addDays(sat, 4))
    expect(span?.start.getTime()).toBe(addDays(mon, 7).getTime())
    expect(span?.end.getTime()).toBe(addDays(sat, 7).getTime())
  })

  test('a body drag preserves a multi-week span, even across a DST boundary', () => {
    // 2-week item Mon Mar 2 -> Sat Mar 14 (display), dragged +8 days, crossing
    // the Mar 8 spring-forward.
    const start = new Date(2026, 2, 2)
    const end = new Date(2026, 2, 14)
    const span = snapDisplaySpan(addDays(start, 8), addDays(end, 8))
    expect(span?.start.getTime()).toBe(new Date(2026, 2, 9).getTime())
    expect(span?.end.getTime()).toBe(new Date(2026, 2, 21).getTime())
    expect(span?.start.getHours()).toBe(0)
    expect(span?.end.getHours()).toBe(0)
    // 2 weeks preserved.
    const days = (span!.end.getTime() - span!.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(days).toBe(12) // Mon->Sat next-next week is 12 days display-space
  })

  test('left edge jitter of 1 day does not move the start (dead zone)', () => {
    const span = snapDisplaySpan(addDays(mon, -1), sat)
    expect(span?.start.getTime()).toBe(mon.getTime())
  })

  test('left edge dragged back 4 days moves the start one week earlier', () => {
    const span = snapDisplaySpan(addDays(mon, -4), sat)
    expect(span?.start.getTime()).toBe(addDays(mon, -7).getTime())
  })

  test('right edge jitter of 2 days does not move the end', () => {
    const span = snapDisplaySpan(mon, addDays(sat, 2))
    expect(span?.end.getTime()).toBe(sat.getTime())
  })

  test('right edge dragged out 4 days extends the span one week', () => {
    const span = snapDisplaySpan(mon, addDays(sat, 4))
    expect(span?.end.getTime()).toBe(addDays(sat, 7).getTime())
  })

  test('right edge dragged left past the start pins to the start\'s own Saturday', () => {
    const span = snapDisplaySpan(mon, addDays(mon, 1)) // end snaps back near start's own week
    expect(span?.start.getTime()).toBe(mon.getTime())
    expect(span?.end.getTime()).toBe(sat.getTime())
  })

  test('left edge dragged past the end collapses to one week at the new start', () => {
    // Left edge dragged to Tue May 12 (past the original end); nearest Monday
    // to that is May 11, and the end can't stay behind it, so it clamps
    // forward to a fresh one-week span at the new start.
    const span = snapDisplaySpan(addDays(sat, 3), sat)
    expect(span?.start.getTime()).toBe(addDays(mon, 7).getTime())
    const days = (span!.end.getTime() - span!.start.getTime()) / (1000 * 60 * 60 * 24)
    expect(days).toBe(5)
  })

  test('an already-snapped span is a fixed point', () => {
    const span = snapDisplaySpan(mon, sat)
    expect(span?.start.getTime()).toBe(mon.getTime())
    expect(span?.end.getTime()).toBe(sat.getTime())
  })

  test('unparseable input yields null', () => {
    expect(snapDisplaySpan('garbage', sat)).toBeNull()
    expect(snapDisplaySpan(mon, null)).toBeNull()
  })
})

describe('displayEndToDataEnd', () => {
  test('Saturday 00:00 becomes the preceding Friday 00:00', () => {
    expect(displayEndToDataEnd(new Date(2026, 4, 9)).getTime()).toBe(
      new Date(2026, 4, 8).getTime(),
    )
  })

  test('a foreign exclusive-Monday end resolves to the previous Friday', () => {
    expect(displayEndToDataEnd(new Date(2026, 4, 11)).getTime()).toBe(
      new Date(2026, 4, 8).getTime(),
    )
  })

  test('stays at local midnight across a DST weekend', () => {
    const result = displayEndToDataEnd(new Date(2026, 2, 9)) // Mon Mar 9 -> Fri Mar 6
    expect(result.getHours()).toBe(0)
  })
})

describe('formatSigmaDateTime', () => {
  test('formats local components with no T, Z, or milliseconds', () => {
    const formatted = formatSigmaDateTime(new Date(2026, 4, 4))
    expect(formatted).toBe('2026-05-04 00:00:00')
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
