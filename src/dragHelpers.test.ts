import { describe, expect, test } from 'vitest'
import { formatDragTooltip } from './dragHelpers'

describe('formatDragTooltip', () => {
  test('shows the Monday start -> Friday data end, not the Saturday display end', () => {
    // Mon Jun 15 -> Sat Jun 20, 2026: a normalized 1-week display span.
    expect(
      formatDragTooltip({
        start: new Date(2026, 5, 15),
        end: new Date(2026, 5, 20),
      }),
    ).toBe('Jun 15, 2026 → Jun 19, 2026')
  })

  test('shows just the start (floored to its week) when there is no end', () => {
    // Tue Jun 16 has no end -> floors to that week's Monday.
    expect(formatDragTooltip({ start: new Date(2026, 5, 16) })).toBe(
      'Jun 15, 2026',
    )
  })

  test('re-snaps an unsnapped mid-drag span so the tooltip is always a clean week', () => {
    expect(
      formatDragTooltip({
        start: new Date(2026, 5, 17), // Wed
        end: new Date(2026, 5, 18), // Thu
      }),
    ).toBe('Jun 15, 2026 → Jun 19, 2026')
  })

  test('empty item (no start) shows nothing', () => {
    expect(formatDragTooltip({})).toBe('')
  })
})
