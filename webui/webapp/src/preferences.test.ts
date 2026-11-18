import { beforeEach, describe, expect, it } from 'vitest'
import {
  readBudgetMonth,
  readReportPreferences,
  readTransactionType,
  rememberBudgetMonth,
  rememberReportPreferences,
  rememberTransactionType,
} from './preferences'

beforeEach(() => {
  localStorage.clear()
})

describe('remembered screen preferences', () => {
  it('starts from the current month and the report defaults', () => {
    expect(readReportPreferences('2026-11')).toEqual({
      month: '2026-11',
      range: 'month',
      breakdown: 'category',
      type: 'expense',
      allAccounts: false,
    })
    expect(readBudgetMonth('2026-11')).toBe('2026-11')
    expect(readTransactionType()).toBe('all')
  })

  it('round-trips the report controls', () => {
    rememberReportPreferences({
      month: '2025-03',
      range: 'year',
      breakdown: 'payee',
      type: 'both',
      allAccounts: true,
    })

    expect(readReportPreferences('2026-11')).toEqual({
      month: '2025-03',
      range: 'year',
      breakdown: 'payee',
      type: 'both',
      allAccounts: true,
    })
  })

  it('round-trips the budget month and the transaction type', () => {
    rememberBudgetMonth('2024-12')
    rememberTransactionType('income')

    expect(readBudgetMonth('2026-11')).toBe('2024-12')
    expect(readTransactionType()).toBe('income')
  })

  it('ignores values a previous version or the user left behind', () => {
    localStorage.setItem('myexpenses.reportMonth', '2026-13')
    localStorage.setItem('myexpenses.reportRange', 'decade')
    localStorage.setItem('myexpenses.reportBreakdown', 'account')
    localStorage.setItem('myexpenses.reportType', 'transfer')
    localStorage.setItem('myexpenses.budgetMonth', 'next-month')
    localStorage.setItem('myexpenses.transactionType', 'transfers')

    expect(readReportPreferences('2026-11')).toEqual({
      month: '2026-11',
      range: 'month',
      breakdown: 'category',
      type: 'expense',
      allAccounts: false,
    })
    expect(readBudgetMonth('2026-11')).toBe('2026-11')
    expect(readTransactionType()).toBe('all')
  })

  it('keeps a falsy all-accounts flag as false', () => {
    rememberReportPreferences({
      month: '2026-11',
      range: 'last3',
      breakdown: 'tag',
      type: 'income',
      allAccounts: false,
    })

    expect(readReportPreferences('2020-01').allAccounts).toBe(false)
  })
})
