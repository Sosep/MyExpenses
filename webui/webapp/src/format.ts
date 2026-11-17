import { t } from '@lingui/core/macro'
import { i18n } from './i18n'
import type { Category } from './types'

function uiLocale(): string {
  return i18n.locale === 'es' ? 'es-ES' : 'en-GB'
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  fractionDigits: number,
  showSign = false,
): string {
  const value = amountMinor / Math.pow(10, fractionDigits)
  const formatted = new Intl.NumberFormat(uiLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value))
  if (value < 0) return '−' + formatted
  if (showSign && value > 0) return '+' + formatted
  return formatted
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
): string {
  return new Intl.DateTimeFormat(uiLocale(), options).format(parseIsoDate(iso))
}

export function formatMonth(year: number, second: number): string {
  return new Intl.DateTimeFormat(uiLocale(), { month: 'long', year: 'numeric' }).format(
    new Date(year, second, 1),
  )
}

export function formatMonthShort(year: number, second: number): string {
  return new Intl.DateTimeFormat(uiLocale(), { month: 'short' }).format(
    new Date(year, second, 1),
  )
}

/**
 * Formats a `YYYY-MM` cursor (the UI's own month state, 1-12) with the same
 * helper that formats the API's `second` (0-11). Convert at this boundary only,
 * so no screen has to remember which convention it is holding.
 */
export function formatMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return formatMonth(year, monthNumber - 1)
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    from: `${month}-01`,
    to: `${month}-${pad2(lastDay)}`,
  }
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + delta, 1)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function lastMonths(count: number): { from: string; to: string } {
  return {
    from: monthRange(addMonths(currentMonth(), -(count - 1))).from,
    to: monthRange(currentMonth()).to,
  }
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case 'TRANSFER':
      return t`Transfer`
    case 'SPLIT':
      return t`Split transaction`
    default:
      return t`Transaction`
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'CLEARED':
      return t`Cleared`
    case 'RECONCILED':
      return t`Reconciled`
    case 'VOID':
      return t`Void`
    default:
      return t`Unreconciled`
  }
}

export function statusClass(status: string): string {
  switch (status) {
    case 'CLEARED':
      return 'status-cleared'
    case 'RECONCILED':
      return 'status-reconciled'
    case 'VOID':
      return 'status-void'
    default:
      return 'status-unreconciled'
  }
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function nowTime(): string {
  const now = new Date()
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

export function parseAmountMinor(value: string, fractionDigits: number): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d*)?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const padded = (fraction + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
  const minor = Number(whole) * 10 ** fractionDigits + Number(padded || '0')
  if (!Number.isSafeInteger(minor) || minor <= 0) return null
  return minor
}

export function amountInputValue(amountMinor: number, fractionDigits: number): string {
  if (amountMinor === 0) return ''
  return (Math.abs(amountMinor) / 10 ** fractionDigits).toFixed(fractionDigits)
}

export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat(uiLocale(), {
    style: 'currency',
    currency,
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

export function categoryPathMap(categories: Category[]): Map<number, string> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const paths = new Map<number, string>()
  const resolve = (id: number): string => {
    const cached = paths.get(id)
    if (cached) return cached
    const category = byId.get(id)
    if (!category) return ''
    const own = category.label
    const parent = category.parentId ? resolve(category.parentId) : ''
    const path = parent ? `${parent} > ${own}` : own
    paths.set(id, path)
    return path
  }
  categories.forEach((category) => resolve(category.id))
  return paths
}

export function parseSignedAmountMinor(value: string, fractionDigits: number): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const negative = normalized.startsWith('-')
  const digits = normalized.replace(/^-/, '')
  const minor = parseAmountMinor(digits, fractionDigits)
  if (minor === null) return null
  return negative ? -minor : minor
}

export function signedAmountInput(amountMinor: number, fractionDigits: number): string {
  return (amountMinor / 10 ** fractionDigits).toFixed(fractionDigits)
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function formatTimestamp(epochMillis: number): string {
  return new Intl.DateTimeFormat(uiLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epochMillis))
}
