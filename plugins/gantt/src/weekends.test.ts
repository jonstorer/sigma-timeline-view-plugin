import { describe, expect, test } from 'vitest'
import { weekendBackgroundItems, WEEKEND_MAX_SPAN_DAYS } from './weekends'

const DAY = 1000 * 60 * 60 * 24

describe('weekendBackgroundItems', () => {
  test('one background band per weekend: Sat 00:00 → Mon 00:00, a week apart', () => {
    const items = weekendBackgroundItems(new Date(2026, 6, 1), new Date(2026, 7, 1))
    expect(items.length).toBeGreaterThanOrEqual(4)
    for (const it of items) {
      expect(it.type).toBe('background')
      expect(it.className).toBe('ts-weekend')
      const s = it.start as Date
      const e = it.end as Date
      expect(s.getDay()).toBe(6) // Saturday
      expect(e.getDay()).toBe(1) // Monday
      expect((e.getTime() - s.getTime()) / DAY).toBe(2)
    }
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1].start as Date
      const cur = items[i].start as Date
      expect((cur.getTime() - prev.getTime()) / DAY).toBe(7)
    }
  })

  test('no band when the range contains no Saturday (Sun → Fri)', () => {
    const all = weekendBackgroundItems(new Date(2026, 6, 1), new Date(2026, 7, 1))
    const sat = all[0].start as Date
    const sun = new Date(sat)
    sun.setDate(sun.getDate() + 1)
    const fri = new Date(sat)
    fri.setDate(fri.getDate() + 5)
    expect(weekendBackgroundItems(sun, fri)).toHaveLength(0)
  })

  test('includes a Saturday equal to `from`, with a stable id', () => {
    const all = weekendBackgroundItems(new Date(2026, 6, 1), new Date(2026, 7, 1))
    const sat = all[0].start as Date
    const one = weekendBackgroundItems(sat, new Date(sat.getTime() + 1000))
    expect(one).toHaveLength(1)
    // Same weekend → same id regardless of the range it was generated from.
    expect(one[0].id).toBe(all[0].id)
  })

  test('exposes a sane max-span threshold', () => {
    expect(WEEKEND_MAX_SPAN_DAYS).toBeGreaterThan(30)
  })
})
