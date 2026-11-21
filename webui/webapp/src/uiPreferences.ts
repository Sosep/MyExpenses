import { putUiPreferences } from './api'
import type { UiPreferences } from './types'

/**
 * The selections the web UI remembers. They are cached in localStorage so the
 * first paint (theme, language) is right, and uploaded to the phone so a new
 * origin - every server start can expose another URL - recovers them.
 *
 * localStorage wins for nothing: the server copy wins per key at startup, and a
 * missing server key keeps the local one. That is why the FOUC can only happen
 * the first time an origin is opened.
 */
export const STORAGE_KEYS = {
  theme: 'myexpenses.theme',
  locale: 'myexpenses.locale',
  accountId: 'myexpenses.accountId',
  grouping: 'myexpenses.grouping',
  hideTotals: 'myexpenses.hideTotals',
  hideTransactions: 'myexpenses.hideTransactions',
  reportMonth: 'myexpenses.reportMonth',
  reportRange: 'myexpenses.reportRange',
  reportBreakdown: 'myexpenses.reportBreakdown',
  reportType: 'myexpenses.reportType',
  reportAllAccounts: 'myexpenses.reportAllAccounts',
  reportTab: 'myexpenses.reportTab',
  reportPeriod: 'myexpenses.reportPeriod',
  reportCustomFrom: 'myexpenses.reportCustomFrom',
  reportCustomTo: 'myexpenses.reportCustomTo',
  reportCompare: 'myexpenses.reportCompare',
  reportBalanceRange: 'myexpenses.reportBalanceRange',
  reportBalanceFrom: 'myexpenses.reportBalanceFrom',
  reportBalanceTo: 'myexpenses.reportBalanceTo',
  reportAccountIds: 'myexpenses.reportAccountIds',
  budgetMonth: 'myexpenses.budgetMonth',
  transactionType: 'myexpenses.transactionType',
} as const

export type UiPreferenceField = keyof UiPreferences

const FIELDS: readonly UiPreferenceField[] = [
  'theme',
  'locale',
  'accountId',
  'grouping',
  'hideTotals',
  'hideTransactions',
  'reportMonth',
  'reportRange',
  'reportBreakdown',
  'reportType',
  'reportAllAccounts',
  'reportTab',
  'reportPeriod',
  'reportCustomFrom',
  'reportCustomTo',
  'reportCompare',
  'reportBalanceRange',
  'reportBalanceFrom',
  'reportBalanceTo',
  'reportAccountIds',
  'budgetMonth',
  'transactionType',
]

type Value = string | number | boolean | number[]

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

interface FieldSpec {
  storageKey: string
  fromLocal: (raw: string | null) => Value | null
  fromServer: (raw: unknown) => Value | null
}

function oneOf(storageKey: string, allowed: readonly string[]): FieldSpec {
  const valid = (raw: unknown): raw is string =>
    typeof raw === 'string' && allowed.includes(raw)
  return {
    storageKey,
    fromLocal: (raw) => (valid(raw) ? raw : null),
    fromServer: (raw) => (valid(raw) ? raw : null),
  }
}

function boolean(storageKey: string): FieldSpec {
  return {
    storageKey,
    fromLocal: (raw) => (raw === '1' ? true : raw === '0' ? false : null),
    fromServer: (raw) => (typeof raw === 'boolean' ? raw : null),
  }
}

function month(storageKey: string): FieldSpec {
  const valid = (raw: unknown): raw is string =>
    typeof raw === 'string' && MONTH_PATTERN.test(raw)
  return {
    storageKey,
    fromLocal: (raw) => (valid(raw) ? raw : null),
    fromServer: (raw) => (valid(raw) ? raw : null),
  }
}

function date(storageKey: string): FieldSpec {
  const valid = (raw: unknown): raw is string =>
    typeof raw === 'string' && DATE_PATTERN.test(raw)
  return {
    storageKey,
    fromLocal: (raw) => (valid(raw) ? raw : null),
    fromServer: (raw) => (valid(raw) ? raw : null),
  }
}

function idList(storageKey: string): FieldSpec {
  const valid = (raw: unknown): raw is number[] =>
    Array.isArray(raw) &&
    raw.every((value) => typeof value === 'number' && Number.isInteger(value) && value > 0)
  return {
    storageKey,
    fromLocal: (raw) => {
      if (raw === null || raw.trim() === '') return null
      const values = raw
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
      return values.length > 0 ? values : null
    },
    fromServer: (raw) => (valid(raw) ? raw : null),
  }
}

function positiveId(storageKey: string): FieldSpec {
  return {
    storageKey,
    fromLocal: (raw) => {
      if (raw === null || raw.trim() === '') return null
      const value = Number(raw)
      return Number.isInteger(value) && value > 0 ? value : null
    },
    fromServer: (raw) =>
      typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null,
  }
}

const SPECS: Record<UiPreferenceField, FieldSpec> = {
  theme: oneOf(STORAGE_KEYS.theme, ['light', 'dark']),
  locale: oneOf(STORAGE_KEYS.locale, ['en', 'es']),
  accountId: positiveId(STORAGE_KEYS.accountId),
  grouping: oneOf(STORAGE_KEYS.grouping, ['NONE', 'DAY', 'WEEK', 'MONTH', 'YEAR']),
  hideTotals: boolean(STORAGE_KEYS.hideTotals),
  hideTransactions: boolean(STORAGE_KEYS.hideTransactions),
  reportMonth: month(STORAGE_KEYS.reportMonth),
  reportRange: oneOf(STORAGE_KEYS.reportRange, ['month', 'last3', 'year']),
  reportBreakdown: oneOf(STORAGE_KEYS.reportBreakdown, ['category', 'payee', 'tag', 'method']),
  reportType: oneOf(STORAGE_KEYS.reportType, ['expense', 'income', 'both']),
  reportAllAccounts: boolean(STORAGE_KEYS.reportAllAccounts),
  reportTab: oneOf(STORAGE_KEYS.reportTab, [
    'summary',
    'expenses',
    'income',
    'accounts',
    'investments',
    'budgets',
  ]),
  reportPeriod: oneOf(STORAGE_KEYS.reportPeriod, [
    'week',
    'month',
    'quarter',
    'year',
    'lastYear',
    'custom',
  ]),
  reportCustomFrom: date(STORAGE_KEYS.reportCustomFrom),
  reportCustomTo: date(STORAGE_KEYS.reportCustomTo),
  reportCompare: oneOf(STORAGE_KEYS.reportCompare, ['none', 'previous']),
  reportBalanceRange: oneOf(STORAGE_KEYS.reportBalanceRange, [
    'm1',
    'm3',
    'm6',
    'y1',
    'y2',
    'y5',
    'all',
    'custom',
  ]),
  reportBalanceFrom: date(STORAGE_KEYS.reportBalanceFrom),
  reportBalanceTo: date(STORAGE_KEYS.reportBalanceTo),
  reportAccountIds: idList(STORAGE_KEYS.reportAccountIds),
  budgetMonth: month(STORAGE_KEYS.budgetMonth),
  transactionType: oneOf(STORAGE_KEYS.transactionType, ['all', 'expense', 'income']),
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // A private window or a full quota must not break the screen.
  }
}

function encode(value: Value): string {
  if (Array.isArray(value)) return value.join(',')
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

/**
 * Applies the server copy on top of the local cache, one key at a time. Values
 * the server never stored and values it cannot parse are ignored, so a corrupt
 * document cannot leave the UI without a theme. Unknown fields are skipped.
 *
 * Returns true when the server had no known field at all: the first contact
 * after this feature shipped, where the browser's choices should be uploaded.
 */
export function applyServerPreferences(server: UiPreferences | null): boolean {
  if (!server) return false
  let hasValue = false
  for (const field of FIELDS) {
    const raw: unknown = server[field]
    if (raw === undefined || raw === null) continue
    hasValue = true
    const value = SPECS[field].fromServer(raw)
    if (value === null) continue
    writeLocal(SPECS[field].storageKey, encode(value))
  }
  return !hasValue
}

/**
 * The validated choices of this browser. Used to seed an empty server and to
 * prove that every read here has the same rules as the screens.
 */
export function localPreferences(): Partial<UiPreferences> {
  const result: Partial<UiPreferences> = {}
  const target = result as Record<string, Value>
  for (const field of FIELDS) {
    const value = SPECS[field].fromLocal(readLocal(SPECS[field].storageKey))
    if (value !== null) target[field] = value
  }
  // The anti-FOUC script paints from the system theme without storing it; the
  // first visit should still carry that choice to another origin.
  const painted = document.documentElement.dataset.theme
  if (result.theme === undefined && (painted === 'light' || painted === 'dark')) {
    result.theme = painted
  }
  return result
}

/** Seeds an empty server once, so choices made before this feature survive. */
export function uploadLocalPreferences(): void {
  const local = localPreferences()
  if (Object.keys(local).length === 0) return
  void putUiPreferences(local).catch(() => {})
}

let uploadsEnabled = false
let timer: number | undefined
let pending: Partial<Record<UiPreferenceField, Value>> = {}
let pagehideListener: (() => void) | null = null

const UPLOAD_DELAY = 1000

/**
 * Writes are only uploaded once the startup has merged the server copy: an
 * effect that fires before that must not overwrite the phone with a stale
 * local value.
 */
export function startUiPreferencesSync(): void {
  uploadsEnabled = true
  if (pagehideListener) return
  pagehideListener = () => flushUiPreferences(true)
  window.addEventListener('pagehide', pagehideListener)
}

/** Test hook; also useful if the app ever tears the shell down in place. */
export function stopUiPreferencesSync(): void {
  uploadsEnabled = false
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
  pending = {}
  if (pagehideListener) {
    window.removeEventListener('pagehide', pagehideListener)
    pagehideListener = null
  }
}

/**
 * Queues a partial PUT. Rapid changes coalesce into one request with the last
 * value per field; a failure is silent because the local cache still holds the
 * choice and the next start retries with it.
 */
export function scheduleUpload(field: UiPreferenceField, value: Value): void {
  if (!uploadsEnabled) return
  const valid = SPECS[field].fromServer(value)
  if (valid === null) return
  pending[field] = valid
  if (timer !== undefined) return
  timer = window.setTimeout(() => flushUiPreferences(false), UPLOAD_DELAY)
}

/**
 * Sends what is pending now. `keepalive` lets the browser finish the request
 * while the page is going away (`pagehide`).
 */
export function flushUiPreferences(keepalive: boolean): void {
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
  const body = pending as Partial<UiPreferences>
  pending = {}
  if (Object.keys(body).length === 0) return
  void putUiPreferences(body, keepalive).catch(() => {})
}
