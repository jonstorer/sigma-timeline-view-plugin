import moment from 'moment'

export function applyIsoWeekLocale(): void {
  moment.updateLocale('en', { week: { dow: 1, doy: 4 } })
}
