import type { Account, Trade, TradeType } from './types'

export type Funding = 'PORTFOLIO' | 'ACCOUNT' | 'EXTERNAL'

export type PeerKind = 'asset' | 'cash' | 'transfer'

export function isCash(type: TradeType): boolean {
  return type === 'DEPOSIT' || type === 'WITHDRAW'
}

export function isTransfer(type: TradeType): boolean {
  return type === 'TRANSFER_IN' || type === 'TRANSFER_OUT'
}

/** Each operation kind points at a different peer picker. */
export function peerKind(type: TradeType): PeerKind {
  if (isCash(type)) return 'cash'
  if (isTransfer(type)) return 'transfer'
  return 'asset'
}

/**
 * Reads the funding source back from the stored operation. A BUY/SELL funded by
 * the portfolio has its cash sub-account as counterpart, which is not in the
 * top-level account list; a top-level counterpart is a bank/cash account and no
 * counterpart means the money was not tracked.
 */
export function fundingForTrade(trade: Trade, accounts: Account[]): Funding {
  if (isTransfer(trade.type)) return 'EXTERNAL'
  if (trade.peerAccountId === null) return 'EXTERNAL'
  if (isCash(trade.type)) return 'ACCOUNT'
  return accounts.some((account) => account.id === trade.peerAccountId)
    ? 'ACCOUNT'
    : 'PORTFOLIO'
}

/**
 * The funding a type switch may preset. Editing only moves inside the family
 * (buy/sell, deposit/withdraw, transfer), so the stored source is the user's
 * intent and must survive the switch; creating needs a valid default for the
 * new picker.
 */
export function fundingAfterTypeChange(
  mode: 'create' | 'edit',
  current: Funding,
  next: TradeType,
): Funding {
  if (mode === 'edit') return current
  if (isCash(next)) return current === 'PORTFOLIO' ? 'ACCOUNT' : current
  if (isTransfer(next)) return 'EXTERNAL'
  return current === 'EXTERNAL' ? 'PORTFOLIO' : current
}

/** An incoming transfer names the other portfolio as its source, not its target. */
export function transferPeerPointsAtSource(type: TradeType): boolean {
  return type === 'TRANSFER_IN'
}

/**
 * Bank/cash accounts that can fund a buy or sell. The app only offers accounts
 * in the portfolio currency: amounts are not converted across currencies.
 */
export function fundingAccounts(portfolio: Account, accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && account.currency === portfolio.currency,
  )
}
