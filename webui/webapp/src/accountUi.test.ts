import { describe, expect, it } from 'vitest'
import {
  defaultAccountTypeName,
  topLevelAccounts,
  validatePortfolioExchangeRate,
} from './accountUi'

describe('account editor defaults', () => {
  it('offers a bank account when the account tab is active', () => {
    expect(defaultAccountTypeName('account')).toBe('BANK')
  })

  it('offers an investment account for a portfolio', () => {
    expect(defaultAccountTypeName('portfolio')).toBe('INVESTMENT')
  })
})

describe('portfolio exchange rate', () => {
  it('needs no rate in the home currency', () => {
    expect(
      validatePortfolioExchangeRate({ isForeign: false, dynamic: false, raw: '' }),
    ).toEqual({})
  })

  it('needs no fixed rate when the app downloads it', () => {
    expect(
      validatePortfolioExchangeRate({ isForeign: true, dynamic: true, raw: '' }),
    ).toEqual({})
  })

  it('requires a rate for a foreign currency with a fixed rate', () => {
    expect(
      validatePortfolioExchangeRate({ isForeign: true, dynamic: false, raw: '  ' }),
    ).toEqual({ error: 'required' })
  })

  it('rejects zero, negatives and non-numbers', () => {
    for (const raw of ['0', '-1', 'abc', '1,2,3']) {
      expect(
        validatePortfolioExchangeRate({ isForeign: true, dynamic: false, raw }),
      ).toEqual({ error: 'invalid' })
    }
  })

  it('accepts a decimal comma and returns the real rate', () => {
    expect(
      validatePortfolioExchangeRate({ isForeign: true, dynamic: false, raw: '1,08' }),
    ).toEqual({ rate: 1.08 })
  })
})

describe('account picker list', () => {
  it('keeps accounts and containers but hides portfolio sub-accounts', () => {
    const base = {
      label: 'x',
      type: '2',
      typeName: 'BANK',
      currency: 'EUR',
      fractionDigits: 2,
      openingBalanceMinor: 0,
      currentBalanceMinor: 0,
      totalMinor: 0,
      incomeMinor: 0,
      expensesMinor: 0,
      excludeFromTotals: false,
      sealed: false,
      color: 0,
      parentId: null,
      dynamicExchangeRates: false,
      valuationMinor: null,
    }
    const visible = topLevelAccounts([
      { ...base, id: 1, portfolioRole: 'NONE' },
      { ...base, id: 7, portfolioRole: 'CONTAINER' },
      { ...base, id: 8, portfolioRole: 'CASH', parentId: 7 },
      { ...base, id: 9, portfolioRole: 'ASSET', parentId: 7 },
    ])
    expect(visible.map((account) => account.id)).toEqual([1, 7])
  })
})
