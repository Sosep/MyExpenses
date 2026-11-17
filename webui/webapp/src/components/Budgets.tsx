import { useMemo, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, Budget, BudgetProgress } from '../types'
import { describeError, getBudgetProgress, getBudgets } from '../api'
import { addMonths, currentMonth, formatMoney, formatMonthKey, formatPercent } from '../format'
import { useAsync } from '../hooks'
import { BudgetEditor } from './BudgetEditor'
import { BudgetHistoryPanel } from './BudgetHistoryPanel'
import { IconChevronLeft, IconChevronRight } from './Icons'

interface BudgetEntry {
  budget: Budget
  progress: BudgetProgress
}

interface BudgetsProps {
  accounts: Account[]
  defaultAccountId: number
  onDataChanged: (message: string) => void
}

function groupingLabel(grouping: string): string {
  switch (grouping) {
    case 'DAY':
      return t`Daily`
    case 'WEEK':
      return t`Weekly`
    case 'MONTH':
      return t`Monthly`
    case 'YEAR':
      return t`Yearly`
    case 'NONE':
      return t`One-time`
    default:
      return grouping
  }
}

function summaryPercent(spent: number, allocated: number): number {
  return allocated > 0 ? Math.round((spent / allocated) * 100) : 0
}

function summaryState(spent: number, allocated: number): string {
  const percent = summaryPercent(spent, allocated)
  if (percent > 100) return 'over'
  if (percent >= 80) return 'warn'
  return ''
}

function progressRatio(progress: BudgetProgress): number {
  if (progress.allocatedMinor <= 0) return progress.spentMinor > 0 ? 1 : 0
  return Math.min(progress.spentMinor / progress.allocatedMinor, 1)
}

function daysLeft(progress: BudgetProgress): number | null {
  if (progress.currentDay < 1 || progress.currentDay > progress.totalDays) return null
  return progress.totalDays - progress.currentDay + 1
}

export function Budgets({
  accounts,
  defaultAccountId,
  onDataChanged,
}: BudgetsProps) {
  const [editor, setEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; entry: BudgetEntry } | null
  >(null)
  const [month, setMonth] = useState(currentMonth())
  const current = currentMonth()
  const atCurrentMonth = month >= current
  const [historyBudget, setHistoryBudget] = useState<Budget | null>(null)
  const [year, monthNumber] = month.split('-').map(Number)
  const entries = useAsync<BudgetEntry[]>(async () => {
    const budgets = await getBudgets()
    const progress = await Promise.all(
      budgets.map((budget) =>
        budget.grouping === 'MONTH'
          ? getBudgetProgress(budget.id, year, monthNumber - 1)
          : getBudgetProgress(budget.id),
      ),
    )
    return budgets
      .map((budget, index) => ({ budget, progress: progress[index] }))
      .filter((entry) => Boolean(entry.progress))
  }, ['budgets', month])

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
          <h1>{t`Budgets`}</h1>
          <p>
            {items.length === 0
              ? t`Spending limits per account and period`
              : t`${items.length} budgets · ${formatMonthKey(month)}`}
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
            <span>{formatMonthKey(month)}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t`Next month`}
              title={atCurrentMonth ? t`There is no later period` : undefined}
              disabled={atCurrentMonth}
            >
              <IconChevronRight />
            </button>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={entries.reload}
            disabled={entries.loading}
          >
            {entries.loading ? t`Refreshing…` : t`Refresh`}
          </button>
          <button type="button" className="btn primary" onClick={() => setEditor({ mode: 'create' })}>
            {t`New budget`}
          </button>
        </div>
      </div>

      {entries.error ? (
        <div className="banner" role="alert">
          <span>{describeError(entries.error, t`Could not load the budgets.`)}</span>
          <button type="button" className="btn ghost" onClick={entries.reload}>
            {t`Try again`}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <p className="card-note">{t`Loading budgets…`}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-page">
          <div className="card empty-card">
            <h2>{t`No budgets yet`}</h2>
            <p>
              {t`Create a budget in the Android app. Its progress for the current period will show up here.`}
            </p>
          </div>
        </div>
      ) : (
        <>
          {summary ? (
            <div className="budget-summary">
              <div className="budget-summary-head">
                <span>{summary.period}</span>
                <span className="muted">{t`All budgets`}</span>
              </div>
              <div className="budget-summary-figures">
                <span>
                  <strong>{formatMoney(summary.spent, summary.currency, summary.fractionDigits)}</strong> {t`spent`}
                </span>
                <span>
                  <strong>{formatMoney(summary.allocated, summary.currency, summary.fractionDigits)}</strong>{' '}
                  {t`allocated`}
                </span>
                <span className={summary.remaining < 0 ? 'over' : 'positive'}>
                  {summary.remaining < 0
                    ? t`${formatMoney(
                        Math.abs(summary.remaining),
                        summary.currency,
                        summary.fractionDigits,
                      )} over`
                    : t`${formatMoney(
                        summary.remaining,
                        summary.currency,
                        summary.fractionDigits,
                      )} left`}
                </span>
              </div>
              <div className="budget-summary-bar">
                <div className="budget-bar">
                  <div
                    className={`budget-fill ${summaryState(summary.spent, summary.allocated)}`}
                    style={{
                      width: `${Math.min(
                        summary.allocated > 0 ? (summary.spent / summary.allocated) * 100 : 0,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="budget-summary-pct">
                  {formatPercent(summaryPercent(summary.spent, summary.allocated), 0)}
                </span>
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
                        {budget.accountName ?? t`Account`} · {groupingLabel(budget.grouping)}
                      </p>
                    </div>
                    {over ? <span className="budget-chip over">{t`Over`}</span> : null}
                  </header>

                  <div className="budget-period">{progress.periodDescription}</div>

                  <div className="budget-figures">
                    <span>
                      {formatMoney(
                        progress.spentMinor,
                        progress.currency,
                        progress.fractionDigits,
                      )}{' '}
                      {t`of`}{' '}
                      {formatMoney(
                        progress.allocatedMinor,
                        progress.currency,
                        progress.fractionDigits,
                      )}
                    </span>
                    <span className={over ? 'over' : 'positive'}>
                      {over
                        ? t`Over by ${formatMoney(
                            Math.abs(progress.remainingMinor),
                            progress.currency,
                            progress.fractionDigits,
                          )}`
                        : t`${formatMoney(
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
                    aria-label={t`${budget.title} spent`}
                  >
                    <div
                      className={`budget-fill ${summaryState(progress.spentMinor, progress.allocatedMinor)}`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>

                  <footer className="budget-card-foot">
                    <span>{t`${formatPercent(ratio * 100, 0)} used`}</span>
                    {days !== null ? (
                      <span>
                        {t`${days} days left`}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="btn ghost budget-history-btn"
                      data-action="budget-history"
                      onClick={() => setHistoryBudget(budget)}
                    >
                      {t`History`}
                    </button>
                    <button
                      type="button"
                      className="btn ghost budget-edit"
                      onClick={() => setEditor({ mode: 'edit', entry: { budget, progress } })}
                    >
                      {t`Edit`}
                    </button>
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
              {t`Budgets with different currencies or periods are shown separately.`}
            </p>
          ) : null}
        </>
      )}

      {historyBudget ? (
        <BudgetHistoryPanel
          budget={historyBudget}
          onClose={() => setHistoryBudget(null)}
        />
      ) : null}

      {editor ? (
        <BudgetEditor
          mode={editor.mode}
          budget={editor.mode === 'edit' ? editor.entry.budget : undefined}
          progress={editor.mode === 'edit' ? editor.entry.progress : undefined}
          accounts={accounts}
          defaultAccountId={
            editor.mode === 'edit' ? editor.entry.budget.accountId : defaultAccountId
          }
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null)
            onDataChanged(message)
          }}
        />
      ) : null}
    </>
  )
}
