import { pad2, todayIso } from './format'
import type {
  ReportBalanceRange,
  ReportCompare,
  ReportPeriod,
  ReportTab,
} from './preferences'

export interface DateRange {
  from: string
  to: string
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** A real calendar date in the API's ISO shape; `2026-02-31` is not valid. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function isValidRange(range: DateRange): boolean {
  return isValidDate(range.from) && isValidDate(range.to)
}

/**
 * The last usable custom range. A native date input can briefly emit an empty
 * value while the user edits it; the report must keep the previous range
 * instead of sending an empty `from`/`to` that the API rejects (or that a
 * fixture widens to the whole database).
 */
export function safeRange(range: DateRange, fallback: DateRange): DateRange {
  if (!isValidRange(range)) return fallback
  return range.from <= range.to ? range : { from: range.to, to: range.from }
}

export interface ReportUrlState {
  tab: ReportTab | null
  period: ReportPeriod | null
  compare: ReportCompare | null
  custom: DateRange | null
  balanceRange: ReportBalanceRange | null
  balanceCustom: DateRange | null
  balanceMode: 'total' | 'perAccount' | null
  accountIds: number[]
  categoryIds: number[]
  /** The topbar account, used by the Cuentas deep link. */
  accountId: number | null
}

const URL_TABS: readonly ReportTab[] = [
  'summary',
  'expenses',
  'income',
  'accounts',
  'investments',
  'budgets',
]
const REPORT_PERIODS: readonly ReportPeriod[] = [
  'week',
  'month',
  'quarter',
  'year',
  'lastYear',
  'custom',
]
const REPORT_COMPARES: readonly ReportCompare[] = ['none', 'previous']
const REPORT_BALANCE_RANGES: readonly ReportBalanceRange[] = [
  'm1',
  'm3',
  'm6',
  'y1',
  'y2',
  'y5',
  'all',
  'custom',
]

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function ids(search: string, name: string): number[] {
  return [
    ...new Set(
      new URLSearchParams(search)
        .getAll(name)
        .flatMap((value) => value.split(','))
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ]
}

function dateParam(search: string, name: string): string | null {
  const value = new URLSearchParams(search).get(name)
  return value !== null && isValidDate(value) ? value : null
}

function customParam(search: string): DateRange | null {
  const from = dateParam(search, 'from')
  const to = dateParam(search, 'to')
  return from !== null && to !== null ? { from, to } : null
}

function balanceCustomParam(search: string): DateRange | null {
  const from = dateParam(search, 'balanceFrom')
  const to = dateParam(search, 'balanceTo')
  return from !== null && to !== null ? { from, to } : null
}

/**
 * Reads the report deep link. Only valid values are returned, so an invalid
 * URL falls back to the remembered preferences instead of feeding a stale
 * option to the screen. Custom dates must be complete and real dates.
 */
export function parseReportUrl(search: string): ReportUrlState {
  const params = new URLSearchParams(search)
  const mode = params.get('balanceMode')
  const accountId = Number(params.get('accountId'))
  return {
    tab: oneOf(params.get('tab'), URL_TABS),
    period: oneOf(params.get('period'), REPORT_PERIODS),
    compare: oneOf(params.get('compare'), REPORT_COMPARES),
    custom: customParam(search),
    balanceRange: oneOf(params.get('balanceRange'), REPORT_BALANCE_RANGES),
    balanceCustom: balanceCustomParam(search),
    balanceMode: mode === 'perAccount' || mode === 'total' ? mode : null,
    accountIds: ids(search, 'reportAccount'),
    categoryIds: ids(search, 'reportCategory'),
    accountId:
      params.get('accountId') !== null &&
      Number.isInteger(accountId) &&
      accountId > 0
        ? accountId
        : null,
  }
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

/** Closing balance of the same accounts the series draws. */
export function sumLastBalances(
  entries: { series: { balanceMinor: number }[] }[],
): number {
  return entries.reduce(
    (total, entry) => total + (entry.series.at(-1)?.balanceMinor ?? 0),
    0,
  )
}
