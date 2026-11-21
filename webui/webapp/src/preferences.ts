import { scheduleUpload, STORAGE_KEYS } from './uiPreferences'

/**
 * Selections that belong to this browser, not to the phone, and that must
 * survive a reload (the PWA reloads too). Screens read them when they mount and
 * write them when the user changes something.
 *
 * localStorage is user-editable and survives across app versions, so every read
 * validates the value and falls back to the default instead of feeding a stale
 * option to the UI. Appearance settings (`theme`, `locale`, the privacy
 * switches) live next to the feature that owns them; this module covers the
 * screen-level choices.
 */
export type ReportTab = 'summary' | 'expenses' | 'income' | 'accounts' | 'investments' | 'budgets'
export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year' | 'lastYear' | 'custom'
export type ReportCompare = 'none' | 'previous'
export type ReportBalanceRange = 'm1' | 'm3' | 'm6' | 'y1' | 'y2' | 'y5' | 'all' | 'custom'
export type TransactionType = 'all' | 'expense' | 'income'

export interface ReportPreferences {
  tab: ReportTab
  period: ReportPeriod
  customFrom: string
  customTo: string
  compare: ReportCompare
  balanceRange: ReportBalanceRange
  balanceFrom: string
  balanceTo: string
  accountIds: number[]
}

const REPORT_TABS: readonly ReportTab[] = [
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
const TRANSACTION_TYPES: readonly TransactionType[] = ['all', 'expense', 'income']

const KEYS = {
  reportTab: STORAGE_KEYS.reportTab,
  reportPeriod: STORAGE_KEYS.reportPeriod,
  reportCustomFrom: STORAGE_KEYS.reportCustomFrom,
  reportCustomTo: STORAGE_KEYS.reportCustomTo,
  reportCompare: STORAGE_KEYS.reportCompare,
  reportBalanceRange: STORAGE_KEYS.reportBalanceRange,
  reportBalanceFrom: STORAGE_KEYS.reportBalanceFrom,
  reportBalanceTo: STORAGE_KEYS.reportBalanceTo,
  reportAccountIds: STORAGE_KEYS.reportAccountIds,
  budgetMonth: STORAGE_KEYS.budgetMonth,
  transactionType: STORAGE_KEYS.transactionType,
} as const

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // A private window or a full quota must not break the screen.
  }
}

function oneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = read(key)
  if (stored === null) return fallback
  return (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback
}

/** `YYYY-MM`, the same key the month navigation and the API boundary use. */
function month(key: string, fallback: string): string {
  const stored = read(key)
  return stored !== null && MONTH_PATTERN.test(stored) ? stored : fallback
}

function date(key: string, fallback: string): string {
  const stored = read(key)
  return stored !== null && DATE_PATTERN.test(stored) ? stored : fallback
}

function idList(key: string): number[] {
  const stored = read(key)
  if (!stored) return []
  return stored
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export function readReportPreferences(defaultFrom: string, defaultTo: string): ReportPreferences {
  return {
    tab: oneOf(KEYS.reportTab, REPORT_TABS, 'summary'),
    period: oneOf(KEYS.reportPeriod, REPORT_PERIODS, 'month'),
    customFrom: date(KEYS.reportCustomFrom, defaultFrom),
    customTo: date(KEYS.reportCustomTo, defaultTo),
    compare: oneOf(KEYS.reportCompare, REPORT_COMPARES, 'none'),
    balanceRange: oneOf(KEYS.reportBalanceRange, REPORT_BALANCE_RANGES, 'y1'),
    balanceFrom: date(KEYS.reportBalanceFrom, defaultFrom),
    balanceTo: date(KEYS.reportBalanceTo, defaultTo),
    accountIds: idList(KEYS.reportAccountIds),
  }
}

export function rememberReportPreferences(preferences: ReportPreferences): void {
  remember(KEYS.reportTab, preferences.tab)
  remember(KEYS.reportPeriod, preferences.period)
  remember(KEYS.reportCustomFrom, preferences.customFrom)
  remember(KEYS.reportCustomTo, preferences.customTo)
  remember(KEYS.reportCompare, preferences.compare)
  remember(KEYS.reportBalanceRange, preferences.balanceRange)
  remember(KEYS.reportBalanceFrom, preferences.balanceFrom)
  remember(KEYS.reportBalanceTo, preferences.balanceTo)
  remember(KEYS.reportAccountIds, preferences.accountIds.join(','))
  scheduleUpload('reportTab', preferences.tab)
  scheduleUpload('reportPeriod', preferences.period)
  scheduleUpload('reportCustomFrom', preferences.customFrom)
  scheduleUpload('reportCustomTo', preferences.customTo)
  scheduleUpload('reportCompare', preferences.compare)
  scheduleUpload('reportBalanceRange', preferences.balanceRange)
  scheduleUpload('reportBalanceFrom', preferences.balanceFrom)
  scheduleUpload('reportBalanceTo', preferences.balanceTo)
  scheduleUpload('reportAccountIds', preferences.accountIds)
}

export function readBudgetMonth(defaultMonth: string): string {
  return month(KEYS.budgetMonth, defaultMonth)
}

export function rememberBudgetMonth(value: string): void {
  remember(KEYS.budgetMonth, value)
  scheduleUpload('budgetMonth', value)
}

export function readTransactionType(): TransactionType {
  return oneOf(KEYS.transactionType, TRANSACTION_TYPES, 'all')
}

export function rememberTransactionType(value: TransactionType): void {
  remember(KEYS.transactionType, value)
  scheduleUpload('transactionType', value)
}
