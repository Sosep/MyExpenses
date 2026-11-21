import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import { formatMoney, maskedMoney } from './format'
import { scheduleUpload, STORAGE_KEYS } from './uiPreferences'

/**
 * Two independent switches hide money, because the two kinds are hidden for
 * different reasons: `totals` covers the headline figures (net worth, the month
 * KPIs, reports and budget aggregates) and `transactions` covers the amount of
 * each movement and of every list row. Neither ever masks an open editor.
 */
export type AmountScope = 'totals' | 'transactions'

interface AmountsState {
  totals: boolean
  transactions: boolean
  toggle: (scope: AmountScope) => void
}

const STORAGE_KEYS_BY_SCOPE: Record<AmountScope, string> = {
  totals: STORAGE_KEYS.hideTotals,
  transactions: STORAGE_KEYS.hideTransactions,
}

/** Visible by default: a tree without a provider (tests, login) never masks. */
const AmountsContext = createContext<AmountsState>({
  totals: false,
  transactions: false,
  toggle: () => {},
})

function readHidden(scope: AmountScope): boolean {
  return localStorage.getItem(STORAGE_KEYS_BY_SCOPE[scope]) === '1'
}

export function AmountsProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Record<AmountScope, boolean>>(() => ({
    totals: readHidden('totals'),
    transactions: readHidden('transactions'),
  }))

  useEffect(() => {
    // QA and CSS can read the state without asking React.
    document.documentElement.dataset.hiddenTotals = hidden.totals ? '1' : '0'
    document.documentElement.dataset.hiddenTransactions = hidden.transactions ? '1' : '0'
  }, [hidden])

  const toggle = useCallback((scope: AmountScope) => {
    setHidden((current) => {
      const next = !current[scope]
      localStorage.setItem(STORAGE_KEYS_BY_SCOPE[scope], next ? '1' : '0')
      scheduleUpload(scope === 'totals' ? 'hideTotals' : 'hideTransactions', next)
      return { ...current, [scope]: next }
    })
  }, [])

  const value = useMemo<AmountsState>(
    () => ({ totals: hidden.totals, transactions: hidden.transactions, toggle }),
    [hidden, toggle],
  )

  return <AmountsContext.Provider value={value}>{children}</AmountsContext.Provider>
}

export function useAmounts(): AmountsState {
  return useContext(AmountsContext)
}

/**
 * `formatMoney` for one scope, masked while that scope is hidden. Use it where
 * the amount is interpolated into a Lingui message; use `<Money>` for plain JSX.
 */
export function useMoney(scope: AmountScope = 'transactions') {
  const hidden = useAmounts()[scope]
  return useCallback(
    (amountMinor: number, currency: string, fractionDigits: number, showSign = false) =>
      hidden
        ? maskedMoney(currency)
        : formatMoney(amountMinor, currency, fractionDigits, showSign),
    [hidden],
  )
}

interface MoneyProps {
  scope?: AmountScope
  amountMinor: number
  currency: string
  fractionDigits: number
  showSign?: boolean
  className?: string
}

export function Money({
  scope = 'transactions',
  amountMinor,
  currency,
  fractionDigits,
  showSign = false,
  className,
}: MoneyProps) {
  const hidden = useAmounts()[scope]
  if (!hidden) {
    return <>{formatMoney(amountMinor, currency, fractionDigits, showSign)}</>
  }
  return (
    <span className={className ? `money-masked ${className}` : 'money-masked'}>
      <span aria-hidden="true">{maskedMoney(currency)}</span>
      <span className="sr-only">{t`Amount hidden`}</span>
    </span>
  )
}
