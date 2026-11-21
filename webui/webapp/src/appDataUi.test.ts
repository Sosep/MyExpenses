import { describe, expect, it } from 'vitest'
import type { AccountTypeEntry, Category, CurrencyEntry, Method } from './types'
import {
  accountTypeNames,
  branchIds,
  nonFiatCurrencies,
  remapCandidates,
} from './appDataUi'

const categories: Category[] = [
  { id: 1, parentId: null, label: 'Food', level: 0, color: null, type: 1 },
  { id: 2, parentId: 1, label: 'Groceries', level: 1, color: null, type: 1 },
  { id: 3, parentId: 2, label: 'Fruit', level: 2, color: null, type: 1 },
  { id: 4, parentId: null, label: 'Transport', level: 0, color: null, type: 1 },
  { id: 5, parentId: null, label: 'Income', level: 0, color: null, type: 2 },
]

describe('category branch', () => {
  it('collects the category and every descendant, at any depth', () => {
    expect(branchIds(categories, 1).sort()).toEqual([1, 2, 3])
  })

  it('returns just the category when it has no children', () => {
    expect(branchIds(categories, 4)).toEqual([4])
  })

  it('never offers the deleted branch as a remap target', () => {
    expect(remapCandidates(categories, 1).map((candidate) => candidate.id)).toEqual([
      4, 5,
    ])
  })
})

describe('price history commodities', () => {
  const currencies: CurrencyEntry[] = [
    { code: 'EUR', label: 'Euro', symbol: '€', fractionDigits: 2, commodityType: 'FIAT', priceMinor: null },
    { code: 'USD', label: 'Dollar', symbol: '$', fractionDigits: 2, commodityType: 'FIAT', priceMinor: null },
    { code: 'AAPL', label: 'Apple', symbol: 'AAPL', fractionDigits: 4, commodityType: 'SECURITY', priceMinor: 0.05 },
    { code: 'BTC', label: 'Bitcoin', symbol: 'BTC', fractionDigits: 8, commodityType: 'CRYPTO', priceMinor: 0.0043 },
  ]

  it('offers only the non-fiat currencies in the price history', () => {
    expect(nonFiatCurrencies(currencies).map((currency) => currency.code)).toEqual([
      'AAPL',
      'BTC',
    ])
  })
})

describe('method account types', () => {
  const types: AccountTypeEntry[] = [
    { id: 1, name: 'CASH', isAsset: true, supportsReconciliation: false },
    { id: 2, name: 'BANK', isAsset: true, supportsReconciliation: true },
    { id: 6, name: 'INVESTMENT', isAsset: true, supportsReconciliation: false },
  ]

  it('shows the names the app knows instead of the stored ids', () => {
    const method: Method = {
      id: 1,
      label: 'Card',
      isNumbered: false,
      type: 0,
      accountTypes: ['1', '2'],
    }
    expect(accountTypeNames(method, types)).toBe('CASH, BANK')
  })

  it('falls back to the id for a type the server no longer lists', () => {
    expect(
      accountTypeNames(
        { id: 1, label: 'Card', isNumbered: false, type: 0, accountTypes: ['99'] },
        types,
      ),
    ).toBe('99')
  })
})
