import { useState } from 'react'
import { t } from '@lingui/core/macro'
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
}

type By = 'category' | 'payee' | 'tag'
type Type = 'expense' | 'income' | 'both'

const BY_OPTIONS = ['category', 'payee', 'tag'] as const
const TYPE_OPTIONS = ['expense', 'income', 'both'] as const

function byLabel(by: By): string {
  if (by === 'category') return t`Category`
  if (by === 'payee') return t`Payee`
  return t`Tag`
}

function typeLabel(type: Type): string {
  if (type === 'expense') return t`Expenses`
  if (type === 'income') return t`Income`
  return t`Both`
}

function titleFor(by: By, type: Type): string {
  const noun = by === 'category' ? t`category` : by === 'payee' ? t`payee` : t`tag`
  if (type === 'income') return t`Income by ${noun}`
  if (type === 'both') return t`Activity by ${noun}`
  return t`Spending by ${noun}`
}

export function Reports({ account }: ReportsProps) {
  const [month, setMonth] = useState(currentMonth())
  const [by, setBy] = useState<By>('category')
  const [type, setType] = useState<Type>('expense')
  const range = monthRange(month)
  const [year, monthNumber] = month.split('-').map(Number)

  const summary = useAsync(
    () => getReportSummary(account.id, range.from, range.to),
    ['report-summary', account.id, range.from, range.to],
  )
  const breakdown = useAsync(
    () => getBreakdown(account.id, by, type, range.from, range.to),
    ['report-breakdown', account.id, by, type, range.from, range.to],
  )

  const data = breakdown.data
  const totals = summary.data
  const loading = (summary.loading && !summary.data) || (breakdown.loading && !breakdown.data)
  const error = summary.error ?? breakdown.error

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Reports`}</h1>
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
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              summary.reload()
              breakdown.reload()
            }}
            disabled={summary.loading || breakdown.loading}
          >
            {t`Refresh`}
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
        <div className="segmented" role="group" aria-label={t`Breakdown by`}>
          {BY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={by === option ? 'active' : ''}
              aria-pressed={by === option}
              onClick={() => setBy(option)}
            >
              {byLabel(option)}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t`Transaction type`}>
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={type === option ? 'active' : ''}
              aria-pressed={type === option}
              onClick={() => setType(option)}
            >
              {typeLabel(option)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p className="card-note">{t`Loading report…`}</p>
        </div>
      ) : (
        <>
          {totals ? (
            <div className="kpis">
              <div className="kpi mint">
                <div className="kpi-label">{t`Income`}</div>
                <div className="kpi-value">
                  {formatMoney(totals.incomeMinor, totals.currency, totals.fractionDigits)}
                </div>
                <div className="kpi-foot">{t`This month`}</div>
              </div>
              <div className="kpi rose">
                <div className="kpi-label">{t`Expenses`}</div>
                <div className="kpi-value">
                  {formatMoney(
                    Math.abs(totals.expensesMinor),
                    totals.currency,
                    totals.fractionDigits,
                  )}
                </div>
                <div className="kpi-foot">{t`This month`}</div>
              </div>
              <div className="kpi lav">
                <div className="kpi-label">{t`Net`}</div>
                <div className="kpi-value">
                  {formatMoney(totals.netMinor, totals.currency, totals.fractionDigits, true)}
                </div>
                <div className="kpi-foot">{t`Income minus expenses`}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t`Transactions`}</div>
                <div className="kpi-value">{totals.count}</div>
                <div className="kpi-foot">{t`In this month`}</div>
              </div>
            </div>
          ) : null}

          <div className="card report-card">
            <div className="card-head">
              <div>
                <h2>{titleFor(by, type)}</h2>
                <p>
                  {data && data.items.length > 0
                    ? t`${data.items.length} groups · ${formatMoney(
                        data.totalMinor,
                        account.currency,
                        account.fractionDigits,
                      )} total`
                    : t`No activity for this selection`}
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
                      <span>{t`${item.count} transactions`}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card-note">
                {t`Nothing was recorded for this month. Try another month or change the type.`}
              </p>
            )}
          </div>
        </>
      )}
    </>
  )
}
