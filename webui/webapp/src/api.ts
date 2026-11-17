import type { Account, Group, Meta, Page, Transaction } from './types'

const AUTH_KEY = 'myexpenses.auth'
export const UNAUTHORIZED_EVENT = 'myexpenses:unauthorized'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let authHeader: string | null = sessionStorage.getItem(AUTH_KEY)

export function hasStoredAuth(): boolean {
  return Boolean(authHeader)
}

function encodeBasic(password: string): string {
  const bytes = new TextEncoder().encode(':' + password)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return 'Basic ' + btoa(binary)
}

export function logout(): void {
  authHeader = null
  sessionStorage.removeItem(AUTH_KEY)
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers = new Headers()
  if (authHeader) headers.set('Authorization', authHeader)
  let response: Response
  try {
    response = await fetch('/api/v1' + path, {
      headers,
      signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'network_error',
      "Can't reach the phone. Check that My Expenses is open and on the same network.",
    )
  }
  if (response.status === 401) {
    logout()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(401, 'unauthorized', 'Wrong password')
  }
  if (!response.ok) {
    let body: { error?: string; message?: string } | null = null
    try {
      body = await response.json()
    } catch {
      // Response was not JSON.
    }
    throw new ApiError(
      response.status,
      body?.error ?? 'http_error',
      body?.message ?? response.statusText,
    )
  }
  return (await response.json()) as T
}

export async function login(password: string): Promise<Meta> {
  authHeader = encodeBasic(password)
  try {
    const meta = await getMeta()
    sessionStorage.setItem(AUTH_KEY, authHeader)
    return meta
  } catch (error) {
    authHeader = null
    sessionStorage.removeItem(AUTH_KEY)
    throw error
  }
}

export const getMeta = (signal?: AbortSignal) => request<Meta>('/meta', signal)

export const getAccounts = (signal?: AbortSignal) => request<Account[]>('/accounts', signal)

export const getGrouped = (
  accountId: number,
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  request<Group[]>(
    `/reports/grouped?accountId=${accountId}&from=${from}&to=${to}&grouping=MONTH`,
    signal,
  )

export const getTransactions = (
  accountId: number,
  from: string,
  to: string,
  type: 'both' | 'income' | 'expense',
  limit: number,
  offset: number,
  signal?: AbortSignal,
) =>
  request<Page<Transaction>>(
    `/transactions?accountId=${accountId}&from=${from}&to=${to}` +
      `&type=${type}&limit=${limit}&offset=${offset}`,
    signal,
  )

export const getTransaction = (id: number, signal?: AbortSignal) =>
  request<Transaction>(`/transactions/${id}`, signal)
