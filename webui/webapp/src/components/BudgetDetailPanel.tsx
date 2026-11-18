import { useEffect, useMemo, useRef } from 'react'
import { t } from '@lingui/core/macro'
import type { Budget, BudgetProgress } from '../types'
import { describeError, getBudgetBreakdown, getBudgetHistory } from '../api'
import { daysLeft, groupingLabel, progressRatio } from '../budgetUi'
import { useFocusTrap } from '../useFocusTrap'
import { formatMoney, formatMonthShort, formatPercent, statusLabel } from '../format'
import { useAsync } from '../hooks'
import { loadReferences } from '../references'
import { IconX } from './Icons'

interface BudgetDetailPanelProps {
  budget: Budget
  progress: BudgetProgress
  onEdit: () => void
  onClose: () => void
  /** Push a URL the SPA router understands (the movements of a category). */
  onNavigate: (url: string) => void
}

/**
 * Read-only view of a budget: progress, where the money went and the 12-month
 * series. The figure on the card is the same one shown here; the rows of the
 * breakdown add up to their own total, never to a second one.
 */
export function BudgetDetailPanel({
  budget,
  progress,
  onEdit,
  onClose,
  onNavigate,
}: BudgetDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const breakdown = useAsync(
    () =>
      getBudgetBreakdown(
        budget.id,
        progress.periodYear ?? undefined,
        progress.periodSecond ?? undefined,
      ),
    ['budget-breakdown', budget.id, progress.periodYear, progress.periodSecond],
  )
  const history = useAsync(() => getBudgetHistory(budget.id, 12), [
    'budget-history',
    budget.id,
  ])
  const references = useAsync(loadReferences, ['references'])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const money = (value: number) => formatMoney(value, progress.currency, progress.fractionDigits)
  const over = progress.remainingMinor < 0
  const ratio = progressRatio(progress)
  const days = daysLeft(progress)
  const state = over ? 'over' : ratio >= 0.8 ? 'warn' : ''

  const categories = breakdown.data?.categories ?? []
  const totalSpent = breakdown.data?.totalSpentMinor ?? progress.spentMinor

  const historyItems = history.data ?? []
  const historyMax = historyItems.reduce(
    (max, point) => Math.max(max, point.allocatedMinor, point.spentMinor),
    0,
  )

  // The filter line: the same labels the editor offers, so "why these numbers"
  // has an answer without opening it.
  const filterText = useMemo(() => {
    const criteria = budget.criteria
    if (!criteria) {
      return budget.criteriaUnsupported
        ? t`Filter set in the Android app`
        : t`No filter: the whole account`
    }
    const names = (ids: number[], list: { id: number; label: string }[]) =>
      ids.map((id) => list.find((item) => item.id === id)?.label ?? String(id))
    const parts: string[] = []
    if (criteria.categoryIds.length > 0) {
      parts.push(names(criteria.categoryIds, references.data?.categories ?? []).join(', '))
    }
    if (criteria.payeeIds.length > 0) {
      parts.push(
        criteria.payeeIds
          .map(
            (id) =>
              references.data?.payees.find((payee) => payee.id === id)?.name ?? String(id),
          )
          .join(', '),
      )
    }
    if (criteria.methodIds.length > 0) {
      parts.push(names(criteria.methodIds, references.data?.methods ?? []).join(', '))
    }
    if (criteria.tagIds.length > 0) {
      parts.push(names(criteria.tagIds, references.data?.tags ?? []).join(', '))
    }
    if (criteria.statuses.length > 0) {
      parts.push(criteria.statuses.map((status) => statusLabel(status)).join(', '))
    }
    return parts.length > 0 ? t`Filter: ${parts.join(' · ')}` : t`No filter: the whole account`
  }, [budget.criteria, budget.criteriaUnsupported, references.data])

  /** The row and every category hanging from it, which is what the row sums. */
  const drilldownUrl = (categoryId: number): string | null => {
    const data = breakdown.data
    if (!data) return null
    const params = new URLSearchParams()
    params.set('view', 'transactions')
    // A custom range is what the transactions screen reads back from the URL.
    params.set('preset', 'custom')
    params.set('from', data.periodStart)
    params.set('to', data.periodEnd)
    if (categoryId <= 0) {
      params.set('uncategorized', 'true')
    } else {
      const collected: number[] = []
      const walk = (id: number) => {
        collected.push(id)
        for (const row of data.categories) {
          if (row.parentId === id) walk(row.categoryId)
        }
      }
      walk(categoryId)
      for (const id of collected) params.append('categoryId', String(id))
    }
    const criteria = budget.criteria
    if (criteria) {
      for (const id of criteria.payeeIds) params.append('payeeId', String(id))
      for (const id of criteria.methodIds) params.append('methodId', String(id))
      for (const id of criteria.tagIds) params.append('tagId', String(id))
      for (const status of criteria.statuses) params.append('status', status)
    }
    return `${window.location.pathname}?${params.toString()}`
  }

  const defaultAllocation = budget.allocationMinor
  const periodAllocation = progress.periodAllocationMinor
  const inherited =
    periodAllocation === null &&
    defaultAllocation !== null &&
    progress.allocatedMinor !== defaultAllocation

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        ref={panelRef}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t`Budget detail`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{t`Budget`}</div>
            <h2>{budget.title}</h2>
            <p className="panel-date">
              {budget.accountName ?? t`Account`} · {groupingLabel(budget.grouping)}
            </p>
            <p className="budget-detail-filter">{filterText}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close details`}>
            <IconX />
          </button>
        </div>

        <div className="panel-body">
          <div>
            <div className="budget-period">{progress.periodDescription}</div>
            <div className="budget-detail-hero">
              <span className="budget-detail-amount">
                {money(progress.spentMinor)} <small>{t`of`} {money(progress.allocatedMinor)}</small>
              </span>
              <span className={over ? 'over' : 'positive'}>
                {over
                  ? t`Over by ${money(Math.abs(progress.remainingMinor))}`
                  : t`${money(progress.remainingMinor)} left`}
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
              <div className={`budget-fill ${state}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
            <div className="budget-figures">
              <span>{t`${formatPercent(ratio * 100, 0)} used`}</span>
              {days !== null ? <span>{t`${days} days left`}</span> : null}
            </div>
          </div>

          {breakdown.error ? (
            <div className="banner" role="alert">
              <span>{describeError(breakdown.error, t`Could not load the breakdown.`)}</span>
              <button type="button" className="btn ghost" onClick={breakdown.reload}>
                {t`Try again`}
              </button>
            </div>
          ) : null}

          {breakdown.loading && !breakdown.data ? (
            <p className="budget-detail-note">{t`Loading…`}</p>
          ) : null}

          {categories.length > 0 ? (
            <section className="budget-detail-section">
              <div className="panel-kicker">{t`Spending by category`}</div>
              {categories.map((category) => {
                const percent =
                  totalSpent > 0 ? Math.round((category.spentMinor / totalSpent) * 100) : 0
                const indent = Math.max(category.level - 1, 0) * 14
                const url = drilldownUrl(category.categoryId)
                const label = category.label ?? t`Uncategorized`
                const body = (
                  <>
                    <div className="budget-cat-row" style={{ paddingLeft: `${indent}px` }}>
                      <span className="budget-cat-label">{label}</span>
                      <span className="budget-cat-pct">{formatPercent(percent, 0)}</span>
                      <span className="budget-cat-amount">{money(category.spentMinor)}</span>
                    </div>
                    <div
                      className="budget-bar budget-cat-bar"
                      style={{ marginLeft: `${indent}px` }}
                    >
                      <div className="budget-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </>
                )
                return url ? (
                  <a
                    key={category.categoryId}
                    className="budget-cat-link"
                    href={url}
                    aria-label={t`Movements of ${label}`}
                    onClick={(event) => {
                      event.preventDefault()
                      onNavigate(url)
                    }}
                  >
                    {body}
                  </a>
                ) : (
                  <div key={category.categoryId}>{body}</div>
                )
              })}
            </section>
          ) : null}

          <section className="budget-detail-section">
            <div className="panel-kicker">{t`Period amount`}</div>
            <div className="budget-detail-total">{money(progress.allocatedMinor)}</div>
            <p className="budget-detail-note">
              {periodAllocation !== null
                ? t`Set for this period`
                : inherited
                  ? t`Carried over from an earlier period`
                  : t`Default amount`}
              {defaultAllocation !== null && (inherited || periodAllocation !== null)
                ? ` · ${t`default`} ${money(defaultAllocation)}`
                : ''}
            </p>
          </section>

          <section className="budget-detail-section">
            <div className="panel-kicker">{t`Last 12 months`}</div>
            {history.error ? (
              <div className="banner" role="alert">
                {describeError(history.error, t`Could not load the history.`)}
              </div>
            ) : null}
            {historyItems.length === 0 && !history.loading ? (
              <p className="budget-detail-note">{t`No history yet.`}</p>
            ) : null}
            <div className="budget-history">
              {historyItems.map((point) => {
                const pointOver = point.remainingMinor < 0
                const pointRatio =
                  point.allocatedMinor > 0
                    ? Math.min(point.spentMinor / point.allocatedMinor, 1)
                    : point.spentMinor > 0
                      ? 1
                      : 0
                const scale =
                  historyMax > 0 ? Math.max(point.allocatedMinor, point.spentMinor) / historyMax : 0
                const label =
                  point.periodYear != null && point.periodSecond != null
                    ? `${formatMonthShort(point.periodYear, point.periodSecond)} ${String(
                        point.periodYear,
                      ).slice(2)}`
                    : point.periodDescription
                const percent =
                  point.allocatedMinor > 0
                    ? Math.round((point.spentMinor / point.allocatedMinor) * 100)
                    : 0
                return (
                  <div key={`${point.periodDescription}-${point.periodYear}-${point.periodSecond}`}>
                    <div className="budget-history-head">
                      <span className="budget-history-label">
                        {label}
                        <span className="budget-history-pct">{formatPercent(percent, 0)}</span>
                      </span>
                      {pointOver ? <span className="budget-chip over">{t`Over`}</span> : null}
                      <span className={pointOver ? 'over' : 'positive'}>
                        {money(point.spentMinor)} / {money(point.allocatedMinor)}
                      </span>
                    </div>
                    <div
                      className="budget-history-track"
                      style={{ width: `${Math.max(scale * 100, 2)}%` }}
                    >
                      <div
                        className={`budget-history-fill ${
                          pointOver ? 'over' : percent >= 80 ? 'warn' : ''
                        }`}
                        style={{ width: `${Math.round(pointRatio * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="panel-footer">
          <div className="panel-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              {t`Close`}
            </button>
            <button type="button" className="btn primary" onClick={onEdit}>
              {t`Edit`}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
