import { describe, expect, test } from 'vitest'
import moment from 'moment'
import { applyIsoWeekLocale } from './isoWeek'

describe('applyIsoWeekLocale', () => {
  test('configures weeks to start on Monday', () => {
    applyIsoWeekLocale()
    const startOfWeek = moment('2026-05-13').startOf('week')
    expect(startOfWeek.day()).toBe(1)
    expect(startOfWeek.format('YYYY-MM-DD')).toBe('2026-05-11')
  })

  test('week 1 contains the first Thursday (doy=4)', () => {
    applyIsoWeekLocale()
    expect(moment('2027-01-01').week()).toBe(53)
    expect(moment('2027-01-04').week()).toBe(1)
  })
})
