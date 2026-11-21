import type { ReactNode } from 'react'
import { plural, t } from '@lingui/core/macro'
import type { BreakdownItem, Group } from '../../types'
import { describeError, getGrouped } from '../../api'
import { formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { Money } from '../../privacy'
import { percentChange } from '../../reportUi'
import { Chart } from '../Chart'
import type { ChartGrouping } from '../Chart'

export function Kpi({
  label,
  value,
  foot,
  tone,
}: {
  label: string
  value: ReactNode
  foot?: ReactNode
  tone?: 'mint' | 'rose' | 'lav' | 'sky'
}) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {foot ? <div className="kpi-foot">{foot}</div> : null}
    </div>
  )
}

/**
 * The direction is written as an arrow and a percentage, never as color alone.
 * `lowerIsBetter` only changes the copy, not the color.
 */
export function Delta({
  current,
  previous,
  compare,
  lowerIsBetter = false,
}: {
  current: number
  previous: number | null
  compare: boolean
  lowerIsBetter?: boolean
}) {
  if (!compare) return null
  const change = previous === null ? null : percentChange(current, previous)
  if (change === null) {
    return <span className="delta">{t`No previous period to compare`}</span>
  }
  if (change === 0) {
    return <span className="delta">{t`No change vs the previous period`}</span>
  }
  const up = change > 0
  const text = up
    ? t`Up ${formatPercent(Math.abs(change))} vs the previous period`
    : t`Down ${formatPercent(Math.abs(change))} vs the previous period`
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <span aria-hidden="true">{up ? '↑' : '↓'}</span> {text}
      {lowerIsBetter ? <span className="sr-only">{t`Lower is better`}</span> : null}
    </span>
  )
}

export function Card({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card report-card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="card-head-action">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function EvolutionCard({
  type,
  range,
  previousRange,
  compare,
  grouping,
  homeCurrency,
  accountId = 'all',
}: {
  type: 'income' | 'expense' | 'both'
  range: { from: string; to: string }
  previousRange: { from: string; to: string }
  compare: boolean
  grouping: ChartGrouping
  homeCurrency: string
  accountId?: number | 'all'
}) {
  const current = useAsync(
    () => getGrouped(accountId, grouping, range.from, range.to, type),
    ['report-evolution', accountId, type, grouping, range.from, range.to],
  )
  const previous = useAsync(
    () =>
      compare
        ? getGrouped(accountId, grouping, previousRange.from, previousRange.to, type)
        : Promise.resolve<Group[]>([]),
    [
      'report-evolution-previous',
      accountId,
      type,
      grouping,
      compare,
      previousRange.from,
      previousRange.to,
    ],
  )
  const error = current.error ?? previous.error
  const title =
    type === 'income'
      ? t`How my income evolves`
      : type === 'expense'
        ? t`How my spending evolves`
        : t`Income and expenses over time`
  return (
    <Card
      title={title}
      description={t`${range.from} – ${range.to} · ${homeCurrency}`}
    >
      {error ? (
        <div className="banner" role="alert">
          {describeError(error, t`Could not load the evolution.`)}
        </div>
      ) : current.loading && !current.data ? (
        <p className="card-note">{t`Loading…`}</p>
      ) : (
        <div className="chart-wrap">
          <Chart
            series={current.data ?? []}
            previous={compare ? (previous.data ?? []) : []}
            grouping={grouping}
            currency={homeCurrency}
            fractionDigits={2}
            ariaLabel={title}
          />
        </div>
      )}
    </Card>
  )
}

export function BreakdownCard({
  title,
  description,
  items,
  currency,
  fractionDigits,
  type,
  onOpen,
  onDrill,
  canDrill,
  drillLabel,
}: {
  title: string
  description?: ReactNode
  items: BreakdownItem[]
  currency: string
  fractionDigits: number
  type: 'expense' | 'income'
  onOpen?: (item: BreakdownItem) => void
  onDrill?: (item: BreakdownItem) => void
  canDrill?: (item: BreakdownItem) => boolean
  drillLabel?: string
}) {
  return (
    <Card title={title} description={description}>
      {items.length === 0 ? (
        <p className="card-note report-note">
          {t`Nothing was recorded for this selection. Try another period or clear a filter.`}
        </p>
      ) : (
        <div className="breakdown">
          {items.map((item) => (
            <div key={`${item.id}-${item.label}`} className="breakdown-item">
              <div className="breakdown-row">
                <div className="breakdown-main">
                  <span className="breakdown-label">{item.label}</span>
                  <span className="breakdown-amount">
                    <Money
                      scope="totals"
                      amountMinor={item.amountMinor}
                      currency={currency}
                      fractionDigits={fractionDigits}
                    />
                  </span>
                </div>
                <div className="breakdown-bar">
                  <div
                    className={`breakdown-fill ${type}`}
                    style={{ width: `${Math.max(item.share, 1)}%` }}
                  />
                </div>
                <div className="breakdown-meta">
                  <span>{formatPercent(item.share)}</span>
                  <span>
                    {t`${plural(item.count, {
                      one: '# transaction',
                      other: '# transactions',
                    })}`}
                  </span>
                </div>
              </div>
              {onOpen || onDrill ? (
                <div className="breakdown-actions">
                  {onDrill && item.id > 0 && (!canDrill || canDrill(item)) ? (
                    <button
                      type="button"
                      className="link"
                      onClick={() => onDrill(item)}
                    >
                      {drillLabel ?? t`View subcategories`}
                    </button>
                  ) : null}
                  {onOpen ? (
                    <button type="button" className="link" onClick={() => onOpen(item)}>
                      {t`View operations`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
