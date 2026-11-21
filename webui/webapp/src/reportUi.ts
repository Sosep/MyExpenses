import { pad2, todayIso } from './format'
import type { ReportBalanceRange, ReportPeriod } from './preferences'

export interface DateRange {
  from: string
  to: string
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfWeek(now: Date): Date {
  const day = (now.getDay() + 6) % 7 // Monday = 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
}

export function reportRange(
  period: ReportPeriod,
  custom: DateRange,
  now = new Date(),
): DateRange {
  if (period === 'custom') {
    return custom.from <= custom.to
      ? custom
      : { from: custom.to, to: custom.from }
  }
  if (period === 'week') {
    return { from: iso(startOfWeek(now)), to: iso(now) }
  }
  if (period === 'month') {
    return {
      from: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
      to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }
  if (period === 'quarter') {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    return {
      from: `${now.getFullYear()}-${pad2(quarterStart + 1)}-01`,
      to: iso(new Date(now.getFullYear(), quarterStart + 3, 0)),
    }
  }
  if (period === 'year') {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    }
  }
  const previous = now.getFullYear() - 1
  return { from: `${previous}-01-01`, to: `${previous}-12-31` }
}

/** The same number of days immediately before `from`, so weeks that cross a month compare fairly. */
export function previousRange(from: string, to: string): DateRange {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const previousTo = new Date(start)
  previousTo.setDate(previousTo.getDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setDate(previousFrom.getDate() - (days - 1))
  return { from: iso(previousFrom), to: iso(previousTo) }
}

export function balanceRange(
  range: ReportBalanceRange,
  custom: DateRange,
  now = new Date(),
): DateRange {
  if (range === 'all') {
    // The API caps the points by granularity; a very old start is honest and cheap.
    return { from: '1970-01-01', to: todayIso() }
  }
  if (range === 'custom') {
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
  const months = range === 'm1' ? 1 : range === 'm3' ? 3 : range === 'm6' ? 6 : range === 'y1' ? 12 : range === 'y2' ? 24 : 60
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return { from: iso(start), to: todayIso() }
}

export type EvolutionGrouping = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export function evolutionGrouping(from: string, to: string): EvolutionGrouping {
  const days =
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
        86400000,
    ) + 1
  if (days <= 31) return 'DAY'
  if (days <= 190) return 'WEEK'
  if (days <= 1100) return 'MONTH'
  return 'YEAR'
}

export const REPORT_TABS = [
  'summary',
  'expenses',
  'income',
  'accounts',
  'investments',
  'budgets',
] as const

export function reportRangeLabel(
  period: ReportPeriod,
  range: DateRange,
  labels: Record<ReportPeriod, string>,
): string {
  return period === 'custom' ? `${range.from} – ${range.to}` : labels[period]
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}
