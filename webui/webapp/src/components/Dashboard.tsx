import { useMemo } from 'react'
import type { Account, Transaction } from '../types'
import { describeError, getGrouped, getTransactions } from '../api'
import {
  currentMonth,
  formatDate,
  formatMoney,
  formatMonthKey,
  kindLabel,
  lastMonths,
  monthRange,
} from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { fillSeries } from '../series'
import { Chart } from './Chart'

interface DashboardProps {
  account: Account
  onOpenTransactions: () => void
  onNewTransaction: () => void
}

function description(transaction: Transaction): string {
  if (transaction.payee?.label) return transaction.payee.label
  if (transaction.comment) return transaction.comment
  return kindLabel(transaction.kind)
}

export function Dashboard({
  account,
  onOpenTransactions,
  onNewTransaction,
}: DashboardProps) {
  const months = lastMonths(12)
  const fromMonth = months.from.slice(0, 7)
  const groups = useAsync(
    () => getGrouped(account.id, 'MONTH', months.from, months.to),
    ['dashboard-groups', account.id, months.from, months.to],
  )
  const thisMonth = monthRange(currentMonth())
  const recent = useAsync(
    () => getTransactions(account.id, thisMonth.from, thisMonth.to, 'both', 8, 0),
    ['dashboard-recent', account.id, thisMonth.from, thisMonth.to],
  )

  const series = useMemo(
    () => fillSeries(groups.data ?? [], fromMonth, 12),
    [groups.data, fromMonth],
  )
  const current = series[series.length - 1]
  const income = current?.incomeMinor ?? 0
  const expenses = current?.expensesMinor ?? 0
  const saved = income + expenses
  const month = currentMonth()
  const loading = groups.loading || recent.loading
  const error = groups.error ?? recent.error

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Overview`}</h1>
          <p>
            {formatMonthKey(month)} · {account.label}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={onOpenTransactions}>
            {t`Transactions`}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              groups.reload()
              recent.reload()
            }}
          >
            {t`Refresh`}
          </button>
          <button
            type="button"
            className="btn primary new-transaction"
            onClick={onNewTransaction}
          >
            {t`New transaction`}
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner" role="alert">
          <span>{describeError(error, t`Could not load the overview.`)}</span>
          <button
            type="button"
            className="btn ghost banner-action"
            onClick={() => {
              groups.reload()
              recent.reload()
            }}
          >
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <div className="kpis">
        <div className="hero">
          <div className="accent-bar" />
          <div className="kpi-label">{t`Net worth`}</div>
          <div className="hero-value">
            {formatMoney(account.currentBalanceMinor, account.currency, account.fractionDigits)}
          </div>
          <div className="hero-delta">
            <span className={saved >= 0 ? 'amount-pos' : 'amount-neg'}>
              {formatMoney(saved, account.currency, account.fractionDigits, true)}
            </span>{' '}
            {t`saved this month`}
          </div>
        </div>
        <div className="kpi mint">
          <div className="kpi-label">{t`Income`}</div>
          <div className="kpi-value">
            {loading
              ? '—'
              : formatMoney(income, account.currency, account.fractionDigits)}
          </div>
          <div className="kpi-foot">{t`This month`}</div>
        </div>
        <div className="kpi rose">
          <div className="kpi-label">{t`Expenses`}</div>
          <div className="kpi-value">
            {loading
              ? '—'
              : formatMoney(expenses, account.currency, account.fractionDigits)}
          </div>
          <div className="kpi-foot">{t`This month`}</div>
        </div>
        <div className="kpi lav">
          <div className="kpi-label">{t`Saved`}</div>
          <div className="kpi-value">
            {loading
              ? '—'
              : formatMoney(saved, account.currency, account.fractionDigits, true)}
          </div>
          <div className="kpi-foot">{t`Income minus expenses`}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t`Income and expenses`}</h2>
            <p>{t`Last 12 months`}</p>
          </div>
          <span className="card-note">{account.currency}</span>
        </div>
        <div className="chart-wrap">
          {groups.loading ? (
            <div className="skeleton chart-skeleton" />
          ) : (
            <Chart
              series={series}
              currency={account.currency}
              fractionDigits={account.fractionDigits}
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t`Recent transactions`}</h2>
            <p>{formatMonthKey(month)}</p>
          </div>
          <button type="button" className="link" onClick={onOpenTransactions}>
            {t`View all`}
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Description`}</th>
              <th className="hide-sm">{t`Category`}</th>
              <th className="num">{t`Amount`}</th>
            </tr>
          </thead>
          <tbody>
            {recent.loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={4}>
                    <div className="skeleton skeleton-row" />
                  </td>
                </tr>
              ))
            ) : recent.data && recent.data.items.length > 0 ? (
              recent.data.items.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="date">{formatDate(transaction.date)}</td>
                  <td>
                    <div className="desc">{description(transaction)}</div>
                  </td>
                  <td className="hide-sm">
                    {transaction.category?.path ?? kindLabel(transaction.kind)}
                  </td>
                  <td
                    className={`num ${
                      transaction.kind === 'TRANSFER'
                        ? 'amount-neutral'
                        : transaction.amountMinor > 0
                          ? 'amount-pos'
                          : 'amount-neg'
                    }`}
                  >
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
                <td colSpan={4}>
                  <div className="empty">
                    <h3>{t`No transactions this month`}</h3>
                    <p>{t`Record one in the app and it will show up here.`}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
