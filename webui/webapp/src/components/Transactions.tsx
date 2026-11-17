import { useEffect, useState } from 'react'
import type { Account, Transaction } from '../types'
import { getGrouped, getTransactions } from '../api'
import {
  addMonths,
  currentMonth,
  formatDate,
  formatMoney,
  formatMonth,
  kindLabel,
  monthRange,
  statusClass,
  statusLabel,
} from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { IconChevronLeft, IconChevronRight } from './Icons'
import { TransactionPanel } from './TransactionPanel'

interface TransactionsProps {
  account: Account
  onNewTransaction: () => void
  onEditTransaction: (id: number) => void
  onDataChanged: () => void
}

type TypeFilter = 'all' | 'income' | 'expense'

function description(transaction: Transaction): string {
  if (transaction.payee?.label) return transaction.payee.label
  if (transaction.comment) return transaction.comment
  return kindLabel(transaction.kind)
}

function amountClass(transaction: Transaction): string {
  if (transaction.kind === 'TRANSFER') return 'amount-neutral'
  return transaction.amountMinor > 0 ? 'amount-pos' : 'amount-neg'
}

export function Transactions({
  account,
  onNewTransaction,
  onEditTransaction,
  onDataChanged,
}: TransactionsProps) {
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState<TypeFilter>('all')
  const [extra, setExtra] = useState<Transaction[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const range = monthRange(month)
  const apiType = type === 'all' ? 'both' : type
  const summary = useAsync(
    () => getGrouped(account.id, range.from, range.to),
    ['transaction-summary', account.id, range.from, range.to],
  )
  const page = useAsync(
    () => getTransactions(account.id, range.from, range.to, apiType, 50, 0),
    ['transaction-page', account.id, range.from, range.to, apiType],
  )

  useEffect(() => {
    setExtra([])
    setMoreError(null)
    setSelectedId(null)
  }, [account.id, month, type])

  const [year, monthNumber] = month.split('-').map(Number)
  const items = [...(page.data?.items ?? []), ...extra]
  const total = page.data?.total ?? 0
  const current = summary.data?.[0]
  const income = current?.incomeMinor ?? 0
  const expenses = current?.expensesMinor ?? 0
  const net = income + expenses

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await getTransactions(
        account.id,
        range.from,
        range.to,
        apiType,
        50,
        items.length,
      )
      setExtra((previous) => [...previous, ...next.items])
    } catch (cause) {
      setMoreError(cause instanceof Error ? cause.message : 'Could not load more')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Transactions`}</h1>
          <p>
            {account.label} · {t`${total} transactions`}
          </p>
        </div>
        <div className="page-actions">
          <div className="month-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label={t`Previous month`}
            >
              <IconChevronLeft />
            </button>
            <span>{formatMonth(year, monthNumber)}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t`Next month`}
            >
              <IconChevronRight />
            </button>
          </div>
          <button type="button" className="btn primary" onClick={onNewTransaction}>
            {t`New transaction`}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="segmented" role="group" aria-label={t`Type`}>
          {(
            [
              ['all', t`All`],
              ['expense', t`Expenses`],
              ['income', t`Income`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={type === value ? 'active' : ''}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="summary-strip">
          <div>
            <span>{t`Income`}</span>
            <b className="amount-pos">
              {summary.loading
                ? '—'
                : formatMoney(income, account.currency, account.fractionDigits)}
            </b>
          </div>
          <div>
            <span>{t`Expenses`}</span>
            <b className="amount-neg">
              {summary.loading
                ? '—'
                : formatMoney(expenses, account.currency, account.fractionDigits)}
            </b>
          </div>
          <div>
            <span>{t`Net`}</span>
            <b className={net >= 0 ? 'amount-pos' : 'amount-neg'}>
              {summary.loading
                ? '—'
                : formatMoney(net, account.currency, account.fractionDigits, true)}
            </b>
          </div>
        </div>
      </div>

      {page.error ? (
        <div className="banner" role="alert">
          <span>{page.error.message}</span>
          <button
            type="button"
            className="btn ghost banner-action"
            onClick={() => page.reload()}
          >
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Description`}</th>
              <th className="hide-sm">{t`Category`}</th>
              <th className="hide-sm">{t`Tags`}</th>
              <th className="num">{t`Amount`}</th>
            </tr>
          </thead>
          <tbody>
            {page.loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={5}>
                    <div className="skeleton skeleton-row" />
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="clickable"
                  tabIndex={0}
                  aria-label={t`Open transaction: ${description(transaction)}`}
                  onClick={() => setSelectedId(transaction.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(transaction.id)
                    }
                  }}
                >
                  <td className="date">
                    <span
                      className={`status-dot ${statusClass(transaction.crStatus)}`}
                      title={statusLabel(transaction.crStatus)}
                    />
                    {formatDate(transaction.date)}
                  </td>
                  <td>
                    <div className="desc">{description(transaction)}</div>
                    {transaction.payee && transaction.comment ? (
                      <div className="sub">{transaction.comment}</div>
                    ) : null}
                  </td>
                  <td className="hide-sm">
                    {transaction.category?.path ?? kindLabel(transaction.kind)}
                  </td>
                  <td className="hide-sm">
                    {transaction.tags.length > 0 ? (
                      <>
                        <span className="tag">#{transaction.tags[0].label}</span>
                        {transaction.tags.length > 1 ? (
                          <span className="sub"> +{transaction.tags.length - 1}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td className={`num ${amountClass(transaction)}`}>
                    {formatMoney(
                      transaction.amountMinor,
                      transaction.currency,
                      transaction.fractionDigits,
                      true,
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    <h3>{t`No transactions in ${formatMonth(year, monthNumber)}`}</h3>
                    <p>{t`Record one in the app and it will show up here.`}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {items.length < total ? (
          <div className="load-more">
            {moreError ? <span className="error-text">{moreError}</span> : null}
            <button
              type="button"
              className="btn"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? t`Loading…` : t`Load more (${total - items.length})`}
            </button>
          </div>
        ) : null}
      </section>

      {selectedId !== null ? (
        <TransactionPanel
          id={selectedId}
          account={account}
          onClose={() => setSelectedId(null)}
          onEdit={(id) => {
            setSelectedId(null)
            onEditTransaction(id)
          }}
          onDeleted={() => {
            setSelectedId(null)
            onDataChanged()
          }}
        />
      ) : null}
    </>
  )
}
