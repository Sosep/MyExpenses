import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n'
import type {
  Account,
  BalanceSeries,
  Breakdown,
  ReportSummary,
} from '../../types'
import { ReportsSection } from './ReportsSection'

const getReportSummary = vi.fn()
const getBreakdown = vi.fn()
const getCategories = vi.fn()
const getInvestments = vi.fn()
const getBudgets = vi.fn()
const getBudgetProgress = vi.fn()
const getBalanceSeries = vi.fn()
const getGrouped = vi.fn()
const getReportTransactions = vi.fn()

vi.mock('../../api', () => ({
  getReportSummary: (...args: unknown[]) => getReportSummary(...args),
  getBreakdown: (...args: unknown[]) => getBreakdown(...args),
  getCategories: (...args: unknown[]) => getCategories(...args),
  getInvestments: (...args: unknown[]) => getInvestments(...args),
  getBudgets: (...args: unknown[]) => getBudgets(...args),
  getBudgetProgress: (...args: unknown[]) => getBudgetProgress(...args),
  getBalanceSeries: (...args: unknown[]) => getBalanceSeries(...args),
  getGrouped: (...args: unknown[]) => getGrouped(...args),
  getReportTransactions: (...args: unknown[]) => getReportTransactions(...args),
  describeError: () => 'error',
}))

i18n.activate('en')

const account = (id: number, label: string): Account => ({
  id,
  label,
  type: '2',
  typeName: 'BANK',
  currency: 'EUR',
  fractionDigits: 2,
  openingBalanceMinor: 0,
  currentBalanceMinor: 100000 * id,
  totalMinor: 100000 * id,
  incomeMinor: 0,
  expensesMinor: 0,
  excludeFromTotals: false,
  sealed: false,
  color: 0,
  parentId: null,
  portfolioRole: 'NONE',
  dynamicExchangeRates: false,
  valuationMinor: null,
})

const accounts = [account(1, 'Everyday'), account(2, 'Joint'), account(3, 'Savings')]
const categories = [
  { id: 1, parentId: null, label: 'Food', level: 0, color: null, type: 1 },
  { id: 2, parentId: 1, label: 'Groceries', level: 1, color: null, type: 1 },
  { id: 3, parentId: null, label: 'Income', level: 0, color: null, type: 2 },
]

const summary: ReportSummary = {
  accountId: 0,
  from: '2026-11-01',
  to: '2026-11-30',
  currency: 'EUR',
  fractionDigits: 2,
  incomeMinor: 300000,
  expensesMinor: -180000,
  netMinor: 120000,
  count: 12,
  returnsMinor: 0,
}

const breakdown = (id: number, label: string): Breakdown => ({
  accountId: 0,
  from: '2026-11-01',
  to: '2026-11-30',
  by: 'category',
  type: 'expense',
  currency: 'EUR',
  fractionDigits: 2,
  totalMinor: 180000,
  items: [{ id, label, amountMinor: 180000, count: 1, share: 100 }],
})

const balanceSeries: BalanceSeries = {
  from: '2026-11-01',
  to: '2026-11-30',
  granularity: 'DAY',
  granularityFallback: false,
  mixedCurrencies: false,
  currencies: [{ code: 'EUR', fractionDigits: 2 }],
  accounts: accounts.map((entry) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
    currency: entry.currency,
    fractionDigits: entry.fractionDigits,
    startBalanceMinor: 0,
    firstTransactionDate: null,
    periodIncomeMinor: 0,
    periodExpensesMinor: 0,
    series: [{ date: '2026-11-01', balanceMinor: entry.currentBalanceMinor }],
  })),
  totals: [
    {
      currency: 'EUR',
      fractionDigits: 2,
      startBalanceMinor: 0,
      periodIncomeMinor: 0,
      periodExpensesMinor: 0,
      series: [{ date: '2026-11-01', balanceMinor: 600000 }],
    },
  ],
}

function renderAt(search: string) {
  window.history.replaceState(null, '', `/app/?view=reports${search}`)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ReportsSection
        accounts={accounts}
        homeCurrency="EUR"
        onNavigate={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  getReportSummary.mockReset().mockResolvedValue(summary)
  getBreakdown
    .mockReset()
    .mockResolvedValue(breakdown(1, 'Food'))
  getCategories.mockReset().mockResolvedValue(categories)
  getInvestments
    .mockReset()
    .mockResolvedValue({ homeCurrency: 'EUR', portfolios: [], totals: [] })
  getBudgets.mockReset().mockResolvedValue([])
  getBudgetProgress.mockReset().mockResolvedValue(null)
  getBalanceSeries.mockReset().mockResolvedValue(balanceSeries)
  getGrouped.mockReset().mockResolvedValue([])
  getReportTransactions.mockReset().mockResolvedValue({ items: [], total: 0 })
  window.scrollTo = vi.fn()
})

describe('report URL state', () => {
  it('honours custom dates from a deep link instead of the remembered range', async () => {
    renderAt('&tab=expenses&period=custom&from=2026-01-01&to=2026-01-31')

    await waitFor(() =>
      expect(getReportSummary).toHaveBeenCalledWith(0, '2026-01-01', '2026-01-31'),
    )
    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument()
    const params = new URLSearchParams(window.location.search)
    expect(params.get('from')).toBe('2026-01-01')
    expect(params.get('to')).toBe('2026-01-31')
  })

  it('opens Cuentas in per-account mode for the account in the link', async () => {
    renderAt('&tab=accounts&accountId=2&balanceMode=total')

    await waitFor(() =>
      expect(getBalanceSeries).toHaveBeenCalledWith(
        [2],
        expect.any(String),
        expect.any(String),
        'auto',
      ),
    )
    expect(screen.getByRole('button', { name: 'By account' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Remove filter: Joint (EUR)' })).toBeInTheDocument()
  })

  it('does not force the period controls on investments', async () => {
    renderAt('&tab=investments')
    await waitFor(() => expect(screen.getByText('No portfolios yet')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument()
  })

  it('keeps the expense category filter out of income', async () => {
    renderAt('&tab=expenses&reportCategory=2')

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove filter: Groceries' }),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove filter: Groceries' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('drills a parent category into its children only', async () => {
    renderAt('&tab=expenses')

    const drill = await screen.findByRole('button', { name: 'View subcategories' })
    fireEvent.click(drill)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove filter: Food' }),
      ).toBeInTheDocument(),
    )
  })
})
