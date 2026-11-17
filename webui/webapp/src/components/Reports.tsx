import { useState } from 'react'
import type { Account } from '../types'
import { getBreakdown, getReportSummary } from '../api'
import {
  addMonths,
  currentMonth,
  formatMoney,
  formatMonth,
  monthRange,
} from '../format'
import { useAsync } from '../hooks'
import { IconChevronLeft, IconChevronRight } from './Icons'

interface ReportsProps {
  account: Account
  dataVersion: number
}

type By = 'category' | 'payee' | 'tag'
type Type = 'expense' | 'income' | 'both'

const BY_OPTIONS: { value: By; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'payee', label: 'Payee' },
  { value: 'tag', label: 'Tag' },
]

const TYPE_OPTIONS: { value: Type; label: string }[] = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'both', label: 'Both' },
]

function titleFor(by: By, type: Type): string {
  const noun = by === 'category' ? 'category' : by === 'payee' ? 'payee' : 'tag'
  if (type === 'income') return `Income by ${noun}`
  if (type === 'both') return `Activity by ${noun}`
  return `Spending by ${noun}`
}

export function Reports({ account, dataVersion }: ReportsProps) {
  const [month, setMonth] = useState(currentMonth())
  const [by, setBy] = useState<By>('category')
  const [type, setType] = useState<Type>('expense')
  const range = monthRange(month)
  const [year, monthNumber] = month.split('-').map(Number)

  const summary = useAsync(
    () => getReportSummary(account.id, range.from, range.to),
    [account.id, range.from, range.to, dataVersion],
  )
  const breakdown = useAsync(
    () => getBreakdown(account.id, by, type, range.from, range.to),
    [account.id, by, type, range.from, range.to, dataVersion],
  )

  const data = breakdown.data
  const totals = summary.data
  const loading = (summary.loading && !summary.data) || (breakdown.loading && !breakdown.data)
  const error = summary.error ?? breakdown.error

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>
            {account.label} · {formatMonth(year, monthNumber)}
          </p>
        </div>
        <div className="page-actions">
          <div className="month-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label="Previous month"
            >
              <IconChevronLeft />
            </button>
            <span>{formatMonth(year, monthNumber)}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Next month"
            >
              <IconChevronRight />
            </button>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              summary.reload()
              breakdown.reload()
            }}
            disabled={summary.loading || breakdown.loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner" role="alert">
          <span>{error.message}</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              summary.reload()
              breakdown.reload()
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="report-controls">
        <div className="segmented" role="group" aria-label="Breakdown by">
          {BY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={by === option.value ? 'active' : ''}
              aria-pressed={by === option.value}
              onClick={() => setBy(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Transaction type">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={type === option.value ? 'active' : ''}
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p className="card-note">Loading report…</p>
        </div>
      ) : (
        <>
          {totals ? (
            <div className="kpis">
              <div className="kpi mint">
                <div className="kpi-label">Income</div>
                <div className="kpi-value">
                  {formatMoney(totals.incomeMinor, totals.currency, totals.fractionDigits)}
                </div>
                <div className="kpi-foot">This month</div>
              </div>
              <div className="kpi rose">
                <div className="kpi-label">Expenses</div>
                <div className="kpi-value">
                  {formatMoney(
                    Math.abs(totals.expensesMinor),
                    totals.currency,
                    totals.fractionDigits,
                  )}
                </div>
                <div className="kpi-foot">This month</div>
              </div>
              <div className="kpi lav">
                <div className="kpi-label">Net</div>
                <div className="kpi-value">
                  {formatMoney(totals.netMinor, totals.currency, totals.fractionDigits, true)}
                </div>
                <div className="kpi-foot">Income minus expenses</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Transactions</div>
                <div className="kpi-value">{totals.count}</div>
                <div className="kpi-foot">In this month</div>
              </div>
            </div>
          ) : null}

          <div className="card report-card">
            <div className="card-head">
              <div>
                <h2>{titleFor(by, type)}</h2>
                <p>
                  {data && data.items.length > 0
                    ? `${data.items.length} ${
                        data.items.length === 1 ? 'group' : 'groups'
                      } · ${formatMoney(
                        data.totalMinor,
                        account.currency,
                        account.fractionDigits,
                      )} total`
                    : 'No activity for this selection'}
                </p>
              </div>
            </div>

            {data && data.items.length > 0 ? (
              <div className="breakdown">
                {data.items.map((item) => (
                  <div key={`${item.id}-${item.label}`} className="breakdown-row">
                    <div className="breakdown-main">
                      <span className="breakdown-label">{item.label}</span>
                      <span className="breakdown-amount">
                        {formatMoney(
                          item.amountMinor,
                          account.currency,
                          account.fractionDigits,
                        )}
                      </span>
                    </div>
                    <div className="breakdown-bar">
                      <div
                        className={`breakdown-fill ${type}`}
                        style={{ width: `${Math.max(item.share, 1)}%` }}
                      />
                    </div>
                    <div className="breakdown-meta">
                      <span>{item.share.toFixed(1)}%</span>
                      <span>
                        {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card-note">
                Nothing was recorded for this month. Try another month or change the type.
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}
