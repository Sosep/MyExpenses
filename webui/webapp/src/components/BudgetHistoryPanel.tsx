import { t } from '@lingui/core/macro'
import type { Budget } from '../types'
import { getBudgetHistory } from '../api'
import { formatMoney, formatMonthShort } from '../format'
import { useAsync } from '../hooks'
import { IconX } from './Icons'

interface BudgetHistoryPanelProps {
  budget: Budget
  onClose: () => void
}

export function BudgetHistoryPanel({ budget, onClose }: BudgetHistoryPanelProps) {
  const history = useAsync(
    () => getBudgetHistory(budget.id, 12),
    ['budget-history', budget.id],
  )
  const items = history.data ?? []
  const max = items.reduce(
    (current, point) => Math.max(current, point.allocatedMinor, point.spentMinor),
    0,
  )

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t`Budget history`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{t`Last 12 months`}</div>
            <h2>{budget.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close details`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          {history.loading ? <p className="card-note">{t`Loading…`}</p> : null}
          {history.error ? <div className="banner">{history.error.message}</div> : null}
          {items.length === 0 && !history.loading ? (
            <p className="card-note">{t`No history yet.`}</p>
          ) : null}
          <div className="budget-history">
            {items.map((point) => {
              const over = point.remainingMinor < 0
              const ratio =
                point.allocatedMinor > 0
                  ? Math.min(point.spentMinor / point.allocatedMinor, 1)
                  : point.spentMinor > 0
                    ? 1
                    : 0
              const scale = max > 0 ? Math.max(point.allocatedMinor, point.spentMinor) / max : 0
              const label =
                point.periodYear !== null && point.periodSecond !== null
                  ? `${formatMonthShort(point.periodYear, point.periodSecond)} ${String(
                      point.periodYear,
                    ).slice(2)}`
                  : point.periodDescription
              return (
                <div key={`${point.periodDescription}-${point.periodYear}-${point.periodSecond}`}>
                  <div className="budget-history-head">
                    <span>{label}</span>
                    <span className={over ? 'over' : 'positive'}>
                      {formatMoney(
                        point.spentMinor,
                        budget.currency,
                        budget.fractionDigits,
                      )}{' '}
                      /{' '}
                      {formatMoney(
                        point.allocatedMinor,
                        budget.currency,
                        budget.fractionDigits,
                      )}
                    </span>
                  </div>
                  <div className="budget-history-track" style={{ width: `${Math.max(scale * 100, 2)}%` }}>
                    <div
                      className={`budget-history-fill ${over ? 'over' : ''}`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
    </>
  )
}
