import { t } from '@lingui/core/macro'
import type { Group } from '../types'
import { formatDate, formatMonth, formatMonthShort } from '../format'
import { useMoney } from '../privacy'

export type ChartGrouping = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

interface ChartProps {
  series: Group[]
  previous?: Group[]
  grouping?: ChartGrouping
  currency: string
  fractionDigits: number
  ariaLabel?: string
}

function labelFor(group: Group, grouping: ChartGrouping): string {
  if (grouping === 'MONTH') return formatMonthShort(group.year, group.second)
  if (grouping === 'YEAR') return String(group.year)
  if (group.firstDate) {
    return formatDate(group.firstDate, { day: '2-digit', month: 'short' })
  }
  return String(group.second)
}

function fullLabelFor(group: Group, grouping: ChartGrouping): string {
  if (grouping === 'MONTH') return formatMonth(group.year, group.second)
  if (grouping === 'YEAR') return String(group.year)
  if (group.firstDate) {
    return formatDate(group.firstDate, { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return String(group.second)
}

export function Chart({
  series,
  previous = [],
  grouping = 'MONTH',
  currency,
  fractionDigits,
  ariaLabel,
}: ChartProps) {
  const money = useMoney('totals')
  // A month without expenses arrives without the field (or null). Treating it as
  // zero keeps one missing value from turning every bar height into NaN.
  const amount = (value?: number | null): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : 0

  const max = [...series, ...previous].reduce(
    (current, group) => Math.max(current, amount(group.incomeMinor), amount(group.expensesMinor)),
    0,
  )

  if (series.length === 0 || max === 0) {
    return (
      <div className="empty">
        <h3>{t`No activity yet`}</h3>
        <p>{t`Transactions will appear here as soon as you record them in the app.`}</p>
      </div>
    )
  }

  const height = (value?: number | null) => {
    const magnitude = amount(value)
    if (magnitude === 0) return 0
    return Math.max(2, Math.min(96, (magnitude / max) * 96))
  }

  return (
    <div>
      <div
        className="chart"
        role="img"
        aria-label={ariaLabel ?? t`Income and expenses for the selected period`}
      >
        {series.map((group, index) => (
          <div
            className="chart-col"
            key={`${group.year}-${group.second}-${group.firstDate ?? index}`}
            title={t`${fullLabelFor(group, grouping)} — income ${money(
              group.incomeMinor,
              currency,
              fractionDigits,
            )}, expenses ${money(group.expensesMinor, currency, fractionDigits)}`}
          >
            <div className="chart-half top">
              {previous[index] ? (
                <div
                  className="bar income ghost"
                  style={{ height: `${height(previous[index].incomeMinor)}%` }}
                />
              ) : null}
              <div className="bar income" style={{ height: `${height(group.incomeMinor)}%` }} />
            </div>
            <div className="chart-zero" />
            <div className="chart-half bottom">
              {previous[index] ? (
                <div
                  className="bar expense ghost"
                  style={{ height: `${height(previous[index].expensesMinor)}%` }}
                />
              ) : null}
              <div
                className="bar expense"
                style={{ height: `${height(group.expensesMinor)}%` }}
              />
            </div>
            <span className="chart-label">{labelFor(group, grouping)}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span>
          <i className="dot dot-positive" />
          {t`Income`}
        </span>
        <span>
          <i className="dot dot-negative" />
          {t`Expenses`}
        </span>
        {previous.length > 0 ? (
          <span>
            <i className="dot dot-ghost" />
            {t`Previous period`}
          </span>
        ) : null}
      </div>
    </div>
  )
}
