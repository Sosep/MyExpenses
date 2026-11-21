import type { Account } from './types'

export type AccountKind = 'account' | 'portfolio'

/** Top-level accounts only: portfolio sub-accounts (cash, assets) are hidden. */
export function topLevelAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) => account.portfolioRole === 'NONE' || account.portfolioRole === 'CONTAINER',
  )
}

/** Type the editor preselects for each tab, like the app's setup dialog. */
export function defaultAccountTypeName(kind: AccountKind): string {
  return kind === 'portfolio' ? 'INVESTMENT' : 'BANK'
}

interface PortfolioRateInput {
  isForeign: boolean
  dynamic: boolean
  raw: string
}

interface PortfolioRateResult {
  rate?: number
  error?: 'required' | 'invalid'
}

/**
 * Fixed exchange rates are only needed for a foreign currency that does not
 * download its own. The input accepts the decimal comma the locale shows.
 */
export function validatePortfolioExchangeRate({
  isForeign,
  dynamic,
  raw,
}: PortfolioRateInput): PortfolioRateResult {
  if (!isForeign || dynamic) return {}
  if (raw.trim() === '') return { error: 'required' }
  const rate = Number(raw.replace(',', '.'))
  if (!Number.isFinite(rate) || rate <= 0) return { error: 'invalid' }
  return { rate }
}
