import { t } from '@lingui/core/macro'
import type { Group } from '../types'
import { formatMoney, formatMonth, formatMonthShort } from '../format'

interface ChartProps {
  series: Group[]
  currency: string
  fractionDigits: number
}

export function Chart({ series, currency, fractionDigits }: ChartProps) {
  // A month without expenses arrives without the field (or null). Treating it as
  // zero keeps one missing value from turning every bar height into NaN.
  const amount = (value?: number | null): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : 0

  const max = series.reduce(
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
        aria-label={t`Income and expenses over the last twelve months`}
      >
        {series.map((group) => (
          <div
            className="chart-col"
            key={`${group.year}-${group.second}`}
            title={t`${formatMonth(group.year, group.second)} — income ${formatMoney(
              group.incomeMinor,
              currency,
              fractionDigits,
            )}, expenses ${formatMoney(
              group.expensesMinor,
              currency,
              fractionDigits,
            )}`}
          >
            <div className="chart-half top">
              <div className="bar income" style={{ height: `${height(group.incomeMinor)}%` }} />
            </div>
            <div className="chart-zero" />
            <div className="chart-half bottom">
              <div
                className="bar expense"
                style={{ height: `${height(group.expensesMinor)}%` }}
              />
            </div>
            <span className="chart-label">{formatMonthShort(group.year, group.second)}</span>
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
      </div>
    </div>
  )
}
