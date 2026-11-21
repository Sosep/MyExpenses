import { t } from '@lingui/core/macro'
import type {
  Account,
  Breakdown,
  Budget,
  AccountTypeEntry,
  BudgetAllocation,
  BudgetBreakdown,
  BudgetHistoryPoint,
  BudgetAllocationsWrite,
  BudgetProgress,
  BudgetWrite,
  Category,
  CategoryWrite,
  CurrencyEntry,
  CurrencyWrite,
  FileEntry,
  Group,
  Meta,
  Method,
  MethodWrite,
  Page,
  Payee,
  PortfolioAssets,
  PortfolioWrite,
  Price,
  PriceWrite,
  BalanceSeries,
  ReportSummary,
  Investments,
  SplitWrite,
  Tag,
  TagWrite,
  Trade,
  TradeWrite,
  Transaction,
  TransactionWrite,
  TransferWrite,
  UiPreferences,
} from './types'
import type { Grouping } from './filters'

export const UNAUTHORIZED_EVENT = 'myexpenses:unauthorized'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Turns an error into copy in the active locale. The server speaks English and
 * the network layer never formats sentences for the user, so the UI translates
 * by code and only falls back to the server text for codes it does not know.
 */
export function describeError(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'network_error':
        return t`Can't reach the phone. Check that My Expenses is open and on the same network.`
      case 'unauthorized':
        return t`Sign in required.`
      case 'invalid_password':
        return t`Wrong password.`
      case 'not_found':
      case 'category_not_found':
      case 'method_not_found':
      case 'tag_not_found':
      case 'currency_not_found':
      case 'price_not_found':
        return t`This item no longer exists on the phone.`
      case 'conflict':
      case 'unsupported_trade_change':
      case 'unsupported_move':
        return t`This change is not allowed here.`
      case 'portfolio_limit_reached':
        return t`The free version tracks one portfolio. More need the Professional licence.`
      case 'portfolio_not_found':
      case 'trade_not_found':
        return t`This item no longer exists on the phone.`
      case 'currency_still_used':
        return t`The currency is used by an account or a transaction and cannot be deleted.`
      case 'currency_already_defined':
        return t`That currency code is already defined.`
      case 'category_in_use':
        return t`The category is in use; choose where to move its data.`
      case 'unknown_asset':
        return t`The asset is not registered on the phone. Add it in App data first.`
      case 'http_error':
        return error.status >= 500
          ? t`The phone could not complete the request.`
          : (fallback ?? error.message)
      default:
        return error.message
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback ?? t`Something did not work. Try again.`
}

function requestInit(options: RequestOptions, headers: Headers): RequestInit {
  return {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    keepalive: options.keepalive,
    cache: 'no-store',
    credentials: 'same-origin',
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  /** The page is closing; let the request outlive it (pagehide flush). */
  keepalive?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers()
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch('/api/v1' + path, requestInit(options, headers))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'network_error',
      "Can't reach the phone. Check that My Expenses is open and on the same network.",
    )
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(401, 'unauthorized', 'Sign in required')
  }
  if (!response.ok) {
    let payload: { error?: string; message?: string; fields?: Record<string, string> } | null = null
    try {
      payload = await response.json()
    } catch {
      // Response was not JSON.
    }
    throw new ApiError(
      response.status,
      payload?.error ?? 'http_error',
      payload?.message ?? response.statusText,
      payload?.fields,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function login(password: string): Promise<Meta> {
  let response: Response
  try {
    response = await fetch('/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(
      0,
      'network_error',
      "Can't reach the phone. Check that My Expenses is open and on the same network.",
    )
  }
  if (response.status === 401) {
    throw new ApiError(401, 'invalid_password', 'Wrong password')
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'http_error', 'Could not sign in')
  }
  return getMeta()
}

export function logout(): void {
  fetch('/api/v1/session', {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
  }).catch(() => {})
}

export const getMeta = (signal?: AbortSignal) => request<Meta>('/meta', { signal })

export const getUiPreferences = (signal?: AbortSignal) =>
  request<UiPreferences>('/ui-preferences', { signal })

/** Partial update: only the fields present are stored, the rest is kept. */
export const putUiPreferences = (payload: Partial<UiPreferences>, keepalive = false) =>
  request<UiPreferences>('/ui-preferences', { method: 'PUT', body: payload, keepalive })

export const getAccountTypes = (signal?: AbortSignal) =>
  request<AccountTypeEntry[]>('/account-types', { signal })

export interface AccountWrite {
  label: string
  type: string
  currency: string
  openingBalanceMinor?: number
  excludeFromTotals?: boolean
}

export const createAccount = (payload: AccountWrite) =>
  request<Account>('/accounts', { method: 'POST', body: payload })

export const getAccounts = (signal?: AbortSignal) => request<Account[]>('/accounts', { signal })

export const createPortfolio = (payload: PortfolioWrite) =>
  request<Account>('/portfolios', { method: 'POST', body: payload })

export const updatePortfolio = (id: number, payload: PortfolioWrite) =>
  request<Account>(`/portfolios/${id}`, { method: 'PUT', body: payload })

export const getPortfolioAssets = (id: number, signal?: AbortSignal) =>
  request<PortfolioAssets>(`/portfolios/${id}/assets`, { signal })

export const getTrades = (
  portfolioId: number,
  limit: number,
  offset: number,
  signal?: AbortSignal,
) =>
  request<Page<Trade>>(
    `/portfolios/${portfolioId}/trades?limit=${limit}&offset=${offset}`,
    { signal },
  )

export const getTrade = (portfolioId: number, id: number, signal?: AbortSignal) =>
  request<Trade>(`/portfolios/${portfolioId}/trades/${id}`, { signal })

export const createTrade = (portfolioId: number, payload: TradeWrite) =>
  request<Trade>(`/portfolios/${portfolioId}/trades`, { method: 'POST', body: payload })

export const updateTrade = (portfolioId: number, id: number, payload: TradeWrite) =>
  request<Trade>(`/portfolios/${portfolioId}/trades/${id}`, { method: 'PUT', body: payload })

export const getCategories = (signal?: AbortSignal) =>
  request<Category[]>('/categories', { signal })

export const getPayees = (signal?: AbortSignal) => request<Payee[]>('/payees', { signal })

export const getTags = (signal?: AbortSignal) => request<Tag[]>('/tags', { signal })

export const getMethods = (signal?: AbortSignal) => request<Method[]>('/methods', { signal })

export const getGrouped = (
  accountId: number | 'all',
  grouping: Grouping,
  from: string,
  to: string,
  type: 'both' | 'income' | 'expense' = 'both',
  filters: TransactionFilters = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    accountId: String(accountId),
    grouping,
    from,
    to,
    type,
  })
  // The period sums follow the same criteria as the rows below them; without
  // the filters a header would total transactions the list is hiding.
  appendTransactionFilters(params, filters)
  return request<Group[]>(`/reports/grouped?${params.toString()}`, { signal })
}

import type { Filters } from './filters'

export type TransactionFilters = Partial<Filters>

function appendTransactionFilters(params: URLSearchParams, filters: TransactionFilters) {
  for (const [key, values] of [
    ['categoryId', filters.categoryIds],
    ['payeeId', filters.payeeIds],
    ['tagId', filters.tagIds],
    ['methodId', filters.methodIds],
  ] as const) {
    for (const value of values ?? []) params.append(key, String(value))
  }
  if (filters.uncategorized) params.set('uncategorized', 'true')
  if (filters.text) params.set('q', filters.text)
  if (filters.amountMin != null) params.set('amountMin', String(filters.amountMin))
  if (filters.amountMax != null) params.set('amountMax', String(filters.amountMax))
  for (const status of filters.statuses ?? []) params.append('status', status)
  if (filters.transfer === 'only') params.set('transfer', 'true')
  if (filters.transfer === 'none') params.set('transfer', 'false')
}

export const getTransactions = (
  accountId: number,
  from: string | undefined,
  to: string | undefined,
  type: 'both' | 'income' | 'expense',
  limit: number,
  offset: number,
  filters: TransactionFilters = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    accountId: String(accountId),
    type,
    limit: String(limit),
    offset: String(offset),
  })
  // Without a range the list is the whole history, newest first.
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  appendTransactionFilters(params, filters)
  return request<Page<Transaction>>(`/transactions?${params.toString()}`, { signal })
}

export const getTransaction = (id: number, signal?: AbortSignal) =>
  request<Transaction>(`/transactions/${id}`, { signal })

export const createTransaction = (payload: TransactionWrite) =>
  request<Transaction>('/transactions', { method: 'POST', body: payload })

export const updateTransaction = (id: number, payload: TransactionWrite) =>
  request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: payload })

export const deleteTransaction = (id: number) =>
  request<void>(`/transactions/${id}`, { method: 'DELETE' })

export const createTransfer = (payload: TransferWrite) =>
  request<Transaction>('/transfers', { method: 'POST', body: payload })

export const updateTransfer = (id: number, payload: TransferWrite) =>
  request<Transaction>(`/transfers/${id}`, { method: 'PUT', body: payload })

export const createSplit = (payload: SplitWrite) =>
  request<Transaction>('/split-transactions', { method: 'POST', body: payload })

export const updateSplit = (id: number, payload: SplitWrite) =>
  request<Transaction>(`/split-transactions/${id}`, { method: 'PUT', body: payload })

export const getFiles = (signal?: AbortSignal) =>
  request<FileEntry[]>('/files', { signal })

export async function downloadFile(name: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch('/api/v1/files/' + encodeURIComponent(name), {
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the phone to download the file.")
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(401, 'unauthorized', 'Sign in required')
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 404 ? 'not_found' : 'http_error',
      response.status === 404 ? 'File not found' : 'Could not download the file',
    )
  }
  return response.blob()
}

export const getBudgets = (signal?: AbortSignal) =>
  request<Budget[]>('/budgets', { signal })

export const getBudgetProgress = (
  id: number,
  year?: number,
  second?: number,
  signal?: AbortSignal,
) => {
  const query =
    year !== undefined && second !== undefined ? `?year=${year}&second=${second}` : ''
  return request<BudgetProgress>(`/budgets/${id}${query}`, { signal })
}

export const createBudget = (payload: BudgetWrite) =>
  request<Budget>('/budgets', { method: 'POST', body: payload })

export const updateBudget = (id: number, payload: BudgetWrite) =>
  request<Budget>(`/budgets/${id}`, { method: 'PUT', body: payload })

export const deleteBudget = (id: number) =>
  request<void>(`/budgets/${id}`, { method: 'DELETE' })

export const getReportSummary = (
  accountId: number,
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  request<ReportSummary>(
    `/reports/summary?accountId=${accountId}&from=${from}&to=${to}`,
    { signal },
  )

export const getBreakdown = (
  accountId: number | 'all',
  by: 'category' | 'payee' | 'tag' | 'method',
  type: 'expense' | 'income' | 'both',
  from: string,
  to: string,
  categoryIds: number[] = [],
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    accountId: String(accountId),
    by,
    type,
    from,
    to,
  })
  for (const id of categoryIds) params.append('categoryId', String(id))
  return request<Breakdown>(`/reports/breakdown?${params.toString()}`, { signal })
}

export const getBalanceSeries = (
  accountIds: number[],
  from: string,
  to: string,
  granularity: 'auto' | 'day' | 'week' | 'month' = 'auto',
  signal?: AbortSignal,
) =>
  request<BalanceSeries>(
    `/reports/balance-series?accountIds=${accountIds.join(',')}` +
      `&from=${from}&to=${to}&granularity=${granularity}`,
    { signal },
  )

export const getInvestments = (signal?: AbortSignal) =>
  request<Investments>('/reports/investments', { signal })

export const getBudgetAllocations = (
  id: number,
  year?: number,
  second?: number,
  signal?: AbortSignal,
) => {
  const query =
    year !== undefined && second !== undefined ? `?year=${year}&second=${second}` : ''
  return request<BudgetAllocation[]>(`/budgets/${id}/allocations${query}`, { signal })
}

export const updateBudgetAllocations = (
  id: number,
  payload: BudgetAllocationsWrite,
) =>
  request<BudgetAllocation[]>(`/budgets/${id}/allocations`, {
    method: 'PUT',
    body: payload,
  })

export const getReportTransactions = (
  accountId: number,
  by: 'category' | 'payee' | 'tag' | 'method',
  groupId: number,
  type: 'expense' | 'income' | 'both',
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  request<Page<Transaction>>(
    `/reports/transactions?accountId=${accountId}&by=${by}&id=${groupId}` +
      `&type=${type}&from=${from}&to=${to}&limit=100&offset=0`,
    { signal },
  )

export const duplicateBudget = (id: number) =>
  request<Budget>(`/budgets/${id}/duplicate`, { method: 'POST' })

export const getBudgetHistory = (id: number, months = 12, signal?: AbortSignal) =>
  request<BudgetHistoryPoint[]>(`/budgets/${id}/history?months=${months}`, { signal })

export const getBudgetBreakdown = (
  id: number,
  year?: number,
  second?: number,
  signal?: AbortSignal,
) => {
  const query =
    year !== undefined && second !== undefined ? `?year=${year}&second=${second}` : ''
  return request<BudgetBreakdown>(`/budgets/${id}/breakdown${query}`, { signal })
}

// ---- App data (settings > data) -----------------------------------------

export const createCategory = (payload: CategoryWrite) =>
  request<Category>('/categories', { method: 'POST', body: payload })

export const updateCategory = (id: number, payload: CategoryWrite) =>
  request<Category>(`/categories/${id}`, { method: 'PUT', body: payload })

export const deleteCategory = (id: number, remapTo?: number) =>
  request<void>(`/categories/${id}${remapTo ? `?remapTo=${remapTo}` : ''}`, {
    method: 'DELETE',
  })

export const createMethod = (payload: MethodWrite) =>
  request<Method>('/methods', { method: 'POST', body: payload })

export const updateMethod = (id: number, payload: MethodWrite) =>
  request<Method>(`/methods/${id}`, { method: 'PUT', body: payload })

export const deleteMethod = (id: number) =>
  request<void>(`/methods/${id}`, { method: 'DELETE' })

export const createTag = (payload: TagWrite) =>
  request<Tag>('/tags', { method: 'POST', body: payload })

export const updateTag = (id: number, payload: TagWrite) =>
  request<Tag>(`/tags/${id}`, { method: 'PUT', body: payload })

export const deleteTag = (id: number) => request<void>(`/tags/${id}`, { method: 'DELETE' })

export const getCurrencies = (signal?: AbortSignal) =>
  request<CurrencyEntry[]>('/currencies', { signal })

export const createCurrency = (payload: CurrencyWrite) =>
  request<CurrencyEntry>('/currencies', { method: 'POST', body: payload })

export const updateCurrency = (code: string, payload: CurrencyWrite) =>
  request<CurrencyEntry>(`/currencies/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: payload,
  })

export const deleteCurrency = (code: string) =>
  request<void>(`/currencies/${encodeURIComponent(code)}`, { method: 'DELETE' })

export const getPrices = (commodity: string, signal?: AbortSignal) =>
  request<Price[]>(`/prices?commodity=${encodeURIComponent(commodity)}`, { signal })

export const savePrice = (payload: PriceWrite) =>
  request<Price>('/prices', { method: 'POST', body: payload })

export const updatePrice = (commodity: string, date: string, payload: PriceWrite) =>
  request<Price>(`/prices/${encodeURIComponent(commodity)}/${date}`, {
    method: 'PUT',
    body: payload,
  })

export const deletePrice = (commodity: string, date: string) =>
  request<void>(`/prices/${encodeURIComponent(commodity)}/${date}`, { method: 'DELETE' })
