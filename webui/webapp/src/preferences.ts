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
export type ReportRange = 'month' | 'last3' | 'year'
export type ReportBreakdown = 'category' | 'payee' | 'tag' | 'method'
export type ReportType = 'expense' | 'income' | 'both'
export type TransactionType = 'all' | 'expense' | 'income'

export interface ReportPreferences {
  month: string
  range: ReportRange
  breakdown: ReportBreakdown
  type: ReportType
  allAccounts: boolean
}

const REPORT_RANGES: readonly ReportRange[] = ['month', 'last3', 'year']
const REPORT_BREAKDOWNS: readonly ReportBreakdown[] = ['category', 'payee', 'tag', 'method']
const REPORT_TYPES: readonly ReportType[] = ['expense', 'income', 'both']
const TRANSACTION_TYPES: readonly TransactionType[] = ['all', 'expense', 'income']

const KEYS = {
  reportMonth: 'myexpenses.reportMonth',
  reportRange: 'myexpenses.reportRange',
  reportBreakdown: 'myexpenses.reportBreakdown',
  reportType: 'myexpenses.reportType',
  reportAllAccounts: 'myexpenses.reportAllAccounts',
  budgetMonth: 'myexpenses.budgetMonth',
  transactionType: 'myexpenses.transactionType',
} as const

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

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

export function readReportPreferences(defaultMonth: string): ReportPreferences {
  return {
    month: month(KEYS.reportMonth, defaultMonth),
    range: oneOf(KEYS.reportRange, REPORT_RANGES, 'month'),
    breakdown: oneOf(KEYS.reportBreakdown, REPORT_BREAKDOWNS, 'category'),
    type: oneOf(KEYS.reportType, REPORT_TYPES, 'expense'),
    allAccounts: read(KEYS.reportAllAccounts) === '1',
  }
}

export function rememberReportPreferences(preferences: ReportPreferences): void {
  remember(KEYS.reportMonth, preferences.month)
  remember(KEYS.reportRange, preferences.range)
  remember(KEYS.reportBreakdown, preferences.breakdown)
  remember(KEYS.reportType, preferences.type)
  remember(KEYS.reportAllAccounts, preferences.allAccounts ? '1' : '0')
}

export function readBudgetMonth(defaultMonth: string): string {
  return month(KEYS.budgetMonth, defaultMonth)
}

export function rememberBudgetMonth(value: string): void {
  remember(KEYS.budgetMonth, value)
}

export function readTransactionType(): TransactionType {
  return oneOf(KEYS.transactionType, TRANSACTION_TYPES, 'all')
}

export function rememberTransactionType(value: TransactionType): void {
  remember(KEYS.transactionType, value)
}
