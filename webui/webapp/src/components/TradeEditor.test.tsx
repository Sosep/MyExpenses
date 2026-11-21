import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../i18n'
import type { Account, Meta, Trade } from '../types'
import { TradeEditor } from './TradeEditor'

const getTrade = vi.fn()
const createTrade = vi.fn()
const updateTrade = vi.fn()
const deleteTransaction = vi.fn()

vi.mock('../api', () => ({
  getTrade: (...args: unknown[]) => getTrade(...args),
  createTrade: (...args: unknown[]) => createTrade(...args),
  updateTrade: (...args: unknown[]) => updateTrade(...args),
  deleteTransaction: (...args: unknown[]) => deleteTransaction(...args),
  describeError: () => 'error',
}))

i18n.activate('en')

const portfolio: Account = {
  id: 7,
  label: 'Investments',
  type: '6',
  typeName: 'INVESTMENT',
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
  portfolioRole: 'CONTAINER',
  dynamicExchangeRates: false,
  valuationMinor: 0,
}

const bank: Account = {
  ...portfolio,
  id: 1,
  label: 'Everyday',
  type: '2',
  typeName: 'BANK',
  portfolioRole: 'NONE',
  valuationMinor: null,
}

const meta: Meta = {
  appVersion: 'test',
  serverTime: '2026-11-21T10:00:00',
  timeZone: 'Europe/Madrid',
  locale: 'en',
  homeCurrency: 'EUR',
  preferences: { timeEnabled: false, valueDateEnabled: false },
}

const trade = (over: Partial<Trade>): Trade => ({
  id: 701,
  type: 'BUY',
  accountId: 7,
  currency: 'EUR',
  date: '2026-11-12',
  time: null,
  comment: '',
  assetSymbol: 'AAPL',
  fractionDigits: 4,
  quantityMinor: 30000,
  price: '5.0',
  principalMinor: 1500,
  feeMinor: 500,
  peerAccountId: null,
  peerAccountLabel: null,
  ...over,
})

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onSaved = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <TradeEditor
        mode="edit"
        id={701}
        account={portfolio}
        accounts={[portfolio, bank]}
        meta={meta}
        onClose={() => {}}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  )
  return { onSaved }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('operation editor funding', () => {
  it('keeps external funding when an edited buy is switched to sell', async () => {
    getTrade.mockResolvedValue(trade({ peerAccountId: null }))
    renderEditor()

    const funding = await screen.findByLabelText('Funding')
    await waitFor(() => expect(funding).toHaveValue('EXTERNAL'))

    fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
    expect(funding).toHaveValue('EXTERNAL')
  })

  it('saves the switched sell still funded externally', async () => {
    getTrade.mockResolvedValue(trade({ peerAccountId: null }))
    updateTrade.mockResolvedValue(trade({ type: 'SELL' }))
    renderEditor()

    await waitFor(() => expect(screen.getByLabelText('Funding')).toHaveValue('EXTERNAL'))
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateTrade).toHaveBeenCalledWith(
        7,
        701,
        expect.objectContaining({ type: 'SELL', fundingSource: 'EXTERNAL' }),
      ),
    )
  })

  it('reads the portfolio cash sub-account as portfolio funding', async () => {
    getTrade.mockResolvedValue(trade({ peerAccountId: 9, peerAccountLabel: 'Cash' }))
    renderEditor()

    await waitFor(() => expect(screen.getByLabelText('Funding')).toHaveValue('PORTFOLIO'))
  })

  it('reads a bank account as account funding', async () => {
    getTrade.mockResolvedValue(trade({ peerAccountId: 1, peerAccountLabel: 'Everyday' }))
    renderEditor()

    await waitFor(() => expect(screen.getByLabelText('Funding')).toHaveValue('ACCOUNT'))
    expect(await screen.findByDisplayValue('Everyday')).toBeInTheDocument()
  })
})
