import { describe, expect, it } from 'vitest'
import type { Account, Trade } from './types'
import {
  fundingAccounts,
  fundingAfterTypeChange,
  fundingForTrade,
  peerKind,
  transferPeerPointsAtSource,
} from './tradeUi'

const account = (over: Partial<Account>): Account => ({
  id: 1,
  label: 'Everyday',
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
  portfolioRole: 'NONE',
  dynamicExchangeRates: false,
  valuationMinor: null,
  ...over,
})

const trade = (over: Partial<Trade>): Trade => ({
  id: 1,
  type: 'BUY',
  accountId: 7,
  currency: 'EUR',
  date: '2026-11-12',
  time: null,
  comment: '',
  assetSymbol: 'AAPL',
  fractionDigits: 4,
  quantityMinor: 10000,
  price: '5',
  principalMinor: 500,
  feeMinor: null,
  peerAccountId: null,
  peerAccountLabel: null,
  ...over,
})

// The editor receives the top-level list: portfolio cash/assets are hidden.
const accounts = [
  account({ id: 1, label: 'Everyday', currency: 'EUR' }),
  account({ id: 2, label: 'Dollars', currency: 'USD' }),
  account({ id: 8, label: 'Trading', currency: 'USD', portfolioRole: 'CONTAINER' }),
]

describe('operation family', () => {
  it('groups the six types into the three families the app edits', () => {
    expect(peerKind('BUY')).toBe('asset')
    expect(peerKind('SELL')).toBe('asset')
    expect(peerKind('DEPOSIT')).toBe('cash')
    expect(peerKind('WITHDRAW')).toBe('cash')
    expect(peerKind('TRANSFER_IN')).toBe('transfer')
    expect(peerKind('TRANSFER_OUT')).toBe('transfer')
  })
})

describe('funding inferred from a stored operation', () => {
  it('reads an asset trade without counterpart as external', () => {
    expect(fundingForTrade(trade({ peerAccountId: null }), accounts)).toBe('EXTERNAL')
  })

  it('reads a cash sub-account as portfolio funding', () => {
    expect(fundingForTrade(trade({ peerAccountId: 9 }), accounts)).toBe('PORTFOLIO')
  })

  it('reads a top-level account as bank funding', () => {
    expect(fundingForTrade(trade({ peerAccountId: 1 }), accounts)).toBe('ACCOUNT')
  })

  it('reads a cash movement without counterpart as external', () => {
    expect(
      fundingForTrade(trade({ type: 'WITHDRAW', peerAccountId: null }), accounts),
    ).toBe('EXTERNAL')
  })

  it('reads a cash movement from an account as account funding', () => {
    expect(
      fundingForTrade(trade({ type: 'DEPOSIT', peerAccountId: 1 }), accounts),
    ).toBe('ACCOUNT')
  })
})

describe('funding when the user switches the operation type', () => {
  it('keeps external funding when an edited buy becomes a sell', () => {
    expect(fundingAfterTypeChange('edit', 'EXTERNAL', 'SELL')).toBe('EXTERNAL')
    expect(fundingAfterTypeChange('edit', 'PORTFOLIO', 'SELL')).toBe('PORTFOLIO')
    expect(fundingAfterTypeChange('edit', 'ACCOUNT', 'SELL')).toBe('ACCOUNT')
  })

  it('keeps the cash source when a deposit becomes a withdrawal', () => {
    expect(fundingAfterTypeChange('edit', 'ACCOUNT', 'WITHDRAW')).toBe('ACCOUNT')
    expect(fundingAfterTypeChange('edit', 'EXTERNAL', 'WITHDRAW')).toBe('EXTERNAL')
  })

  it('still picks a valid default while creating', () => {
    expect(fundingAfterTypeChange('create', 'PORTFOLIO', 'DEPOSIT')).toBe('ACCOUNT')
    expect(fundingAfterTypeChange('create', 'ACCOUNT', 'DEPOSIT')).toBe('ACCOUNT')
    expect(fundingAfterTypeChange('create', 'PORTFOLIO', 'TRANSFER_OUT')).toBe('EXTERNAL')
    expect(fundingAfterTypeChange('create', 'EXTERNAL', 'BUY')).toBe('PORTFOLIO')
    expect(fundingAfterTypeChange('create', 'PORTFOLIO', 'BUY')).toBe('PORTFOLIO')
  })
})

describe('incoming transfer peer', () => {
  it('points at the source portfolio when the operation comes in', () => {
    expect(transferPeerPointsAtSource('TRANSFER_IN')).toBe(true)
    expect(transferPeerPointsAtSource('TRANSFER_OUT')).toBe(false)
  })
})


describe('funding accounts', () => {
  it('keeps only bank accounts in the portfolio currency', () => {
    const portfolio = account({
      id: 7,
      label: 'Investments',
      currency: 'EUR',
      portfolioRole: 'CONTAINER',
    })
    expect(fundingAccounts(portfolio, accounts).map((entry) => entry.id)).toEqual([1])
  })

  it('never offers a portfolio or an account in another currency', () => {
    const portfolio = account({
      id: 8,
      label: 'Trading',
      currency: 'USD',
      portfolioRole: 'CONTAINER',
    })
    expect(fundingAccounts(portfolio, accounts).map((entry) => entry.id)).toEqual([2])
  })
})
