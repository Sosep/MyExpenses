import { useMemo } from 'react'
import type { Budget, BudgetProgress } from '../types'
import { getBudgetProgress, getBudgets } from '../api'
import { formatMoney } from '../format'
import { useAsync } from '../hooks'

interface BudgetEntry {
  budget: Budget
  progress: BudgetProgress
}

const GROUPING_LABELS: Record<string, string> = {
  DAY: 'Daily',
  WEEK: 'Weekly',
  MONTH: 'Monthly',
  YEAR: 'Yearly',
  NONE: 'One-time',
}

function groupingLabel(grouping: string): string {
  return GROUPING_LABELS[grouping] ?? grouping
}

function progressRatio(progress: BudgetProgress): number {
  if (progress.allocatedMinor <= 0) return progress.spentMinor > 0 ? 1 : 0
  return Math.min(progress.spentMinor / progress.allocatedMinor, 1)
}

function daysLeft(progress: BudgetProgress): number | null {
  if (progress.currentDay < 1 || progress.currentDay > progress.totalDays) return null
  return progress.totalDays - progress.currentDay + 1
}

export function Budgets() {
  const entries = useAsync<BudgetEntry[]>(async () => {
    const budgets = await getBudgets()
    const progress = await Promise.all(
      budgets.map((budget) => getBudgetProgress(budget.id)),
    )
    return budgets
      .map((budget, index) => ({ budget, progress: progress[index] }))
      .filter((entry) => Boolean(entry.progress))
  }, [])

  const items = entries.data ?? []
  const loading = entries.loading && !entries.data

  const summary = useMemo(() => {
    if (items.length === 0) return null
    const currency = items[0].progress.currency
    const period = items[0].progress.periodDescription
    const comparable = items.every(
      (entry) =>
        entry.progress.currency === currency && entry.progress.periodDescription === period,
    )
    if (!comparable) return null
    return items.reduce(
      (total, entry) => ({
        currency,
        fractionDigits: items[0].progress.fractionDigits,
        period,
        allocated: total.allocated + entry.progress.allocatedMinor,
        spent: total.spent + entry.progress.spentMinor,
        remaining: total.remaining + entry.progress.remainingMinor,
      }),
      {
        currency,
        fractionDigits: items[0].progress.fractionDigits,
        period,
        allocated: 0,
        spent: 0,
        remaining: 0,
      },
    )
  }, [items])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p>
            {items.length === 0
              ? 'Spending limits per account and period'
              : `${items.length} ${items.length === 1 ? 'budget' : 'budgets'}`}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={entries.reload}
            disabled={entries.loading}
          >
            {entries.loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {entries.error ? (
        <div className="banner" role="alert">
          <span>{entries.error.message}</span>
          <button type="button" className="btn ghost" onClick={entries.reload}>
            Try again
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <p className="card-note">Loading budgets…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-page">
          <div className="card empty-card">
            <h2>No budgets yet</h2>
            <p>
              Create a budget in the Android app. Its progress for the current period will
              show up here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {summary ? (
            <div className="budget-summary">
              <div className="budget-summary-head">
                <span>{summary.period}</span>
                <span className="muted">All budgets</span>
              </div>
              <div className="budget-summary-figures">
                <span>
                  <strong>{formatMoney(summary.spent, summary.currency, summary.fractionDigits)}</strong> spent
                </span>
                <span>
                  <strong>{formatMoney(summary.allocated, summary.currency, summary.fractionDigits)}</strong>{' '}
                  allocated
                </span>
                <span className={summary.remaining < 0 ? 'over' : 'positive'}>
                  {summary.remaining < 0
                    ? `${formatMoney(
                        Math.abs(summary.remaining),
                        summary.currency,
                        summary.fractionDigits,
                      )} over`
                    : `${formatMoney(summary.remaining, summary.currency, summary.fractionDigits)} left`}
                </span>
              </div>
              <div className="budget-bar">
                <div
                  className={`budget-fill ${summary.remaining < 0 ? 'over' : ''}`}
                  style={{
                    width: `${Math.min(
                      summary.allocated > 0 ? (summary.spent / summary.allocated) * 100 : 0,
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="budget-grid">
            {items.map(({ budget, progress }) => {
              const ratio = progressRatio(progress)
              const over = progress.remainingMinor < 0
              const days = daysLeft(progress)
              return (
                <article key={budget.id} className="card budget-card">
                  <header className="budget-card-head">
                    <div>
                      <h2>{budget.title}</h2>
                      <p>
                        {budget.accountName ?? 'Account'} · {groupingLabel(budget.grouping)}
                      </p>
                    </div>
                    {over ? <span className="budget-chip over">Over</span> : null}
                  </header>

                  <div className="budget-period">{progress.periodDescription}</div>

                  <div className="budget-figures">
                    <span>
                      {formatMoney(
                        progress.spentMinor,
                        progress.currency,
                        progress.fractionDigits,
                      )}{' '}
                      of{' '}
                      {formatMoney(
                        progress.allocatedMinor,
                        progress.currency,
                        progress.fractionDigits,
                      )}
                    </span>
                    <span className={over ? 'over' : 'positive'}>
                      {over
                        ? `Over by ${formatMoney(
                            Math.abs(progress.remainingMinor),
                            progress.currency,
                            progress.fractionDigits,
                          )}`
                        : `${formatMoney(
                            progress.remainingMinor,
                            progress.currency,
                            progress.fractionDigits,
                          )} left`}
                    </span>
                  </div>

                  <div
                    className="budget-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-label={`${budget.title} spent`}
                  >
                    <div
                      className={`budget-fill ${over ? 'over' : ''}`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  <footer className="budget-card-foot">
                    <span>{Math.round(ratio * 100)}% used</span>
                    {days !== null ? (
                      <span>
                        {days} {days === 1 ? 'day' : 'days'} left
                      </span>
                    ) : null}
                  </footer>

                  {budget.description ? (
                    <p className="budget-description">{budget.description}</p>
                  ) : null}
                </article>
              )
            })}
          </div>

          {!summary ? (
            <p className="budget-note">
              Budgets with different currencies or periods are shown separately.
            </p>
          ) : null}
        </>
      )}
    </>
  )
}
