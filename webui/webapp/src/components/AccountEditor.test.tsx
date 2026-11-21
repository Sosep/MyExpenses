import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../i18n'
import { AccountEditor } from './AccountEditor'

const getAccountTypes = vi.fn()
const createAccount = vi.fn()
const createPortfolio = vi.fn()

vi.mock('../api', () => ({
  getAccountTypes: (...args: unknown[]) => getAccountTypes(...args),
  createAccount: (...args: unknown[]) => createAccount(...args),
  createPortfolio: (...args: unknown[]) => createPortfolio(...args),
  describeError: () => 'error',
}))

i18n.activate('en')

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSaved = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <AccountEditor
        currencies={['EUR', 'USD']}
        defaultCurrency="EUR"
        homeCurrency="EUR"
        onClose={() => {}}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  )
  return { onSaved }
}

beforeEach(() => {
  vi.clearAllMocks()
  getAccountTypes.mockResolvedValue([
    { id: 2, name: 'BANK', isAsset: true, supportsReconciliation: true },
    { id: 6, name: 'INVESTMENT', isAsset: true, supportsReconciliation: false },
  ])
  createPortfolio.mockImplementation(async (payload) => ({
    id: 20,
    label: payload.label,
    portfolioRole: 'CONTAINER',
  }))
  createAccount.mockResolvedValue({ id: 21, label: 'Account', portfolioRole: 'NONE' })
})

describe('account editor kind', () => {
  it('preselects BANK for an account and INVESTMENT for a portfolio', async () => {
    renderEditor()
    const type = await screen.findByLabelText('Account type')
    await waitFor(() => expect(type).toHaveValue('2'))

    fireEvent.click(screen.getByRole('button', { name: 'Portfolio' }))
    await waitFor(() => expect(type).toHaveValue('6'))
  })
})

describe('portfolio exchange rate', () => {
  it('requires a fixed rate for a foreign currency', async () => {
    renderEditor()
    await screen.findByLabelText('Account type')
    fireEvent.click(screen.getByRole('button', { name: 'Portfolio' }))
    fireEvent.change(screen.getByLabelText('Portfolio name'), { target: { value: 'Dollar portfolio' } })
    fireEvent.change(screen.getByLabelText('Account currency'), { target: { value: 'USD' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Required.')).toBeInTheDocument()
    expect(createPortfolio).not.toHaveBeenCalled()
  })

  it('creates the portfolio with the typed rate', async () => {
    renderEditor()
    await screen.findByLabelText('Account type')
    fireEvent.click(screen.getByRole('button', { name: 'Portfolio' }))
    fireEvent.change(screen.getByLabelText('Portfolio name'), { target: { value: 'Dollar portfolio' } })
    fireEvent.change(screen.getByLabelText('Account currency'), { target: { value: 'USD' } })
    fireEvent.change(screen.getByLabelText('Exchange rate'), { target: { value: '1.08' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(createPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Dollar portfolio',
          currency: 'USD',
          dynamicExchangeRates: false,
          exchangeRate: 1.08,
        }),
      ),
    )
  })
})
