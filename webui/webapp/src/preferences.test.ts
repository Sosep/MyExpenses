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
  it('starts from the supplied range and the report defaults', () => {
    expect(readReportPreferences('2026-11-01', '2026-11-30')).toEqual({
      tab: 'summary',
      period: 'month',
      customFrom: '2026-11-01',
      customTo: '2026-11-30',
      compare: 'none',
      balanceRange: 'y1',
      balanceFrom: '2026-11-01',
      balanceTo: '2026-11-30',
      accountIds: [],
    })
    expect(readBudgetMonth('2026-11')).toBe('2026-11')
    expect(readTransactionType()).toBe('all')
  })

  it('round-trips the report controls', () => {
    rememberReportPreferences({
      tab: 'expenses',
      period: 'quarter',
      customFrom: '2025-01-01',
      customTo: '2025-03-31',
      compare: 'previous',
      balanceRange: 'm3',
      balanceFrom: '2025-02-01',
      balanceTo: '2025-04-30',
      accountIds: [1, 2],
    })

    expect(readReportPreferences('2026-11-01', '2026-11-30')).toEqual({
      tab: 'expenses',
      period: 'quarter',
      customFrom: '2025-01-01',
      customTo: '2025-03-31',
      compare: 'previous',
      balanceRange: 'm3',
      balanceFrom: '2025-02-01',
      balanceTo: '2025-04-30',
      accountIds: [1, 2],
    })
  })

  it('round-trips the budget month and the transaction type', () => {
    rememberBudgetMonth('2024-12')
    rememberTransactionType('income')

    expect(readBudgetMonth('2026-11')).toBe('2024-12')
    expect(readTransactionType()).toBe('income')
  })

  it('ignores values a previous version or the user left behind', () => {
    localStorage.setItem('myexpenses.reportTab', 'unknown')
    localStorage.setItem('myexpenses.reportPeriod', 'decade')
    localStorage.setItem('myexpenses.reportCustomFrom', '2026-13-01')
    localStorage.setItem('myexpenses.reportCompare', 'yearAgo')
    localStorage.setItem('myexpenses.reportBalanceRange', 'm2')
    localStorage.setItem('myexpenses.reportAccountIds', '1,-2,x')
    localStorage.setItem('myexpenses.budgetMonth', 'next-month')
    localStorage.setItem('myexpenses.transactionType', 'transfers')

    expect(readReportPreferences('2026-11-01', '2026-11-30')).toEqual({
      tab: 'summary',
      period: 'month',
      customFrom: '2026-11-01',
      customTo: '2026-11-30',
      compare: 'none',
      balanceRange: 'y1',
      balanceFrom: '2026-11-01',
      balanceTo: '2026-11-30',
      accountIds: [1],
    })
    expect(readBudgetMonth('2026-11')).toBe('2026-11')
    expect(readTransactionType()).toBe('all')
  })

  it('keeps an empty account selection when every id is invalid', () => {
    rememberReportPreferences({
      tab: 'summary',
      period: 'month',
      customFrom: '2026-11-01',
      customTo: '2026-11-30',
      compare: 'none',
      balanceRange: 'y1',
      balanceFrom: '2026-11-01',
      balanceTo: '2026-11-30',
      accountIds: [],
    })

    expect(readReportPreferences('2020-01-01', '2020-01-31').accountIds).toEqual([])
  })
})
