import { describe, expect, it } from 'vitest'
import { i18n } from './i18n'
import {
  addMonths,
  amountInputValue,
  decimalInputValue,
  formatDate,
  formatMoney,
  formatMonth,
  formatMonthKey,
  formatMonthShort,
  formatPercent,
  monthRange,
  parseAmountMinor,
  parseIsoDate,
} from './format'

describe('formatMoney', () => {
  it('formats minor units with the active locale', () => {
    i18n.activate('es')
    const formatted = formatMoney(123456, 'EUR', 2)
    expect(formatted).toContain(',56')
    expect(formatted).toContain('€')
  })

  it('groups thousands in English', () => {
    i18n.activate('en')
    expect(formatMoney(123456, 'EUR', 2)).toContain('1,234.56')
  })

  it('keeps the minus sign of an expense', () => {
    i18n.activate('es')
    expect(formatMoney(-1999, 'EUR', 2).startsWith('−')).toBe(true)
  })

  it('uses the fraction digits of the currency', () => {
    i18n.activate('en')
    expect(formatMoney(1000, 'JPY', 0)).toContain('1,000')
    expect(formatMoney(1000, 'JPY', 0)).not.toContain('.')
  })
})

describe('dates', () => {
  it('parses ISO dates in local time, not UTC', () => {
    const date = parseIsoDate('2026-11-17')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(17)
  })

  it('formats a date with the active locale', () => {
    i18n.activate('es')
    expect(formatDate('2026-11-17', { day: '2-digit', month: 'short' })).toContain('17')
  })

  it('computes the last day of a month', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('moves across years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
})

describe('parseAmountMinor', () => {
  it('reads decimal input as a string, comma or dot', () => {
    expect(parseAmountMinor('12,34', 2)).toBe(1234)
    expect(parseAmountMinor('12.34', 2)).toBe(1234)
    expect(parseAmountMinor('12', 2)).toBe(1200)
  })

  it('rejects amounts that are not positive finite numbers', () => {
    expect(parseAmountMinor('0', 2)).toBeNull()
    expect(parseAmountMinor('-3', 2)).toBeNull()
    expect(parseAmountMinor('1e3', 2)).toBeNull()
    expect(parseAmountMinor('abc', 2)).toBeNull()
  })
})

describe('percentages', () => {
  it('uses the locale separators', () => {
    i18n.activate('es')
    expect(formatPercent(28.5)).toBe('28,5\u00A0%')

    i18n.activate('en')
    expect(formatPercent(28.5)).toBe('28.5%')
  })

  it('drops decimals when asked', () => {
    i18n.activate('es')
    expect(formatPercent(78, 0)).toBe('78\u00A0%')
    i18n.activate('en')
    expect(formatPercent(78, 0)).toBe('78%')
  })
})

describe('month index', () => {
  it('formats the API month index (0-11) as the month it names', () => {
    i18n.activate('es')
    expect(formatMonth(2026, 10)).toContain('noviembre')
    expect(formatMonth(2026, 0)).toContain('enero')

    i18n.activate('en')
    expect(formatMonthShort(2026, 10).toLowerCase()).toContain('nov')
  })

  it('formats the UI month key as the same month the API calls it', () => {
    i18n.activate('es')
    expect(formatMonthKey('2026-11')).toBe(formatMonth(2026, 10))
    expect(formatMonthKey('2026-01')).toBe(formatMonth(2026, 0))
  })
})

describe('decimal inputs', () => {
  it('renders a quantity in minor units without scientific notation', () => {
    expect(amountInputValue(1, 8)).toBe('0.00000001')
    expect(amountInputValue(1234, 2)).toBe('12.34')
    expect(amountInputValue(0, 2)).toBe('')
  })

  it('renders a major value with the digits the API returned', () => {
    expect(decimalInputValue(4300)).toBe('4300')
    expect(decimalInputValue(0.00000001)).toBe('0.00000001')
    expect(decimalInputValue(1.08)).toBe('1.08')
    expect(decimalInputValue(0)).toBe('')
  })
})
