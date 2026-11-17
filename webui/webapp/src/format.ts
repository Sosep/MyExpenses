// The UI is English; Lingui will supply the active locale once i18n lands.
const LOCALE = 'en-GB'

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
  const formatted = new Intl.NumberFormat(LOCALE, {
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
  return new Intl.DateTimeFormat(LOCALE, options).format(parseIsoDate(iso))
}

export function formatMonth(year: number, second: number): string {
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(
    new Date(year, second - 1, 1),
  )
}

export function formatMonthShort(year: number, second: number): string {
  return new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(
    new Date(year, second - 1, 1),
  )
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
      return 'Transfer'
    case 'SPLIT':
      return 'Split transaction'
    default:
      return 'Transaction'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'CLEARED':
      return 'Cleared'
    case 'RECONCILED':
      return 'Reconciled'
    case 'VOID':
      return 'Void'
    default:
      return 'Unreconciled'
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
