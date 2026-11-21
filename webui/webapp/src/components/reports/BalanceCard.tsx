import { useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, BalanceSeries } from '../../types'
import { describeError, getBalanceSeries } from '../../api'
import { formatDate, formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { Money } from '../../privacy'
import type { ReportBalanceRange } from '../../preferences'
import { sumLastBalances } from '../../reportUi'
import { MultiPicker } from '../MultiPicker'
import { LineChart } from '../LineChart'
import type { LineSeries } from '../LineChart'
import { Card } from './shared'

export type BalanceMode = 'total' | 'perAccount'
type Granularity = 'auto' | 'day' | 'week' | 'month'

const COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)']

const RANGES: readonly ReportBalanceRange[] = [
  'm1',
  'm3',
  'm6',
  'y1',
  'y2',
  'y5',
  'all',
  'custom',
]

function rangeLabel(range: ReportBalanceRange): string {
  switch (range) {
    case 'm1':
      return t`1 month`
    case 'm3':
      return t`3 months`
    case 'm6':
      return t`6 months`
    case 'y1':
      return t`1 year`
    case 'y2':
      return t`2 years`
    case 'y5':
      return t`5 years`
    case 'all':
      return t`All history`
    default:
      return t`Custom`
  }
}

interface BalanceCardProps {
  accounts: Account[]
  selectedIds: number[]
  onSelectedIds: (ids: number[]) => void
  rangeKey: ReportBalanceRange
  onRangeKey: (range: ReportBalanceRange) => void
  custom: { from: string; to: string }
  onCustom: (range: { from: string; to: string }) => void
  range: { from: string; to: string }
  mode: BalanceMode
  onMode: (mode: BalanceMode) => void
  compact?: boolean
}

export function BalanceCard({
  accounts,
  selectedIds,
  onSelectedIds,
  rangeKey,
  onRangeKey,
  custom,
  onCustom,
  range,
  mode,
  onMode,
  compact = false,
}: BalanceCardProps) {
  const [granularity, setGranularity] = useState<Granularity>('auto')
  const [currency, setCurrency] = useState<string | null>(null)
  const data = useAsync<BalanceSeries | null>(
    () =>
      selectedIds.length === 0
        ? Promise.resolve(null)
        : getBalanceSeries(selectedIds, range.from, range.to, granularity),
    ['balance-series', selectedIds.join(','), range.from, range.to, granularity],
  )

  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const activeCurrency =
    data.data?.currencies.find((entry) => entry.code === currency)?.code ??
    data.data?.currencies[0]?.code ??
    null
  const total = data.data?.totals.find((entry) => entry.currency === activeCurrency)
  const visibleAccounts =
    data.data?.accounts.filter((entry) => entry.currency === activeCurrency) ?? []
  // The summary describes exactly the max six series the chart draws.
  const chartedAccounts = visibleAccounts.slice(0, 6)
  const series: LineSeries[] =
    mode === 'total'
      ? total
        ? [
            {
              key: `total-${total.currency}`,
              label: t`Total of ${visibleAccounts.length} accounts`,
              color: COLORS[0],
              points: total.series.map((point) => ({
                date: point.date,
                valueMinor: point.balanceMinor,
              })),
            },
          ]
        : []
      : chartedAccounts.map((entry, index) => ({
          key: String(entry.id),
          label: `${entry.label} (${entry.currency})`,
          color: COLORS[index % COLORS.length],
          points: entry.series.map((point) => ({
            date: point.date,
            valueMinor: point.balanceMinor,
          })),
        }))

  const startBalance =
    mode === 'total'
      ? (total?.startBalanceMinor ?? 0)
      : chartedAccounts.reduce((sum, entry) => sum + entry.startBalanceMinor, 0)
  const lastPoint = series[0]?.points[series[0].points.length - 1]
  // In By-account mode the closing figure is the sum of the same accounts the
  // chart draws, not only the first series.
  const endBalance =
    mode === 'total'
      ? (lastPoint?.valueMinor ?? startBalance)
      : sumLastBalances(chartedAccounts)
  const change = endBalance - startBalance
  const changePercent = startBalance !== 0 ? (change / Math.abs(startBalance)) * 100 : null
  const firstDate = visibleAccounts
    .map((entry) => entry.firstTransactionDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const firstCurrency = data.data?.currencies.find((entry) => entry.code === activeCurrency)
  const noMovements =
    visibleAccounts.length > 0 &&
    visibleAccounts.every(
      (entry) => entry.periodIncomeMinor === 0 && entry.periodExpensesMinor === 0,
    )

  return (
    <Card
      title={t`How my balances evolve`}
      description={t`See how the money in your accounts has changed over time.`}
      action={
        <div className="segmented" role="group" aria-label={t`Scope`}>
          <button
            type="button"
            className={mode === 'total' ? 'active' : ''}
            aria-pressed={mode === 'total'}
            onClick={() => onMode('total')}
          >
            {t`Total`}
          </button>
          <button
            type="button"
            className={mode === 'perAccount' ? 'active' : ''}
            aria-pressed={mode === 'perAccount'}
            onClick={() => onMode('perAccount')}
          >
            {t`By account`}
          </button>
        </div>
      }
    >
      <div className={`balance-controls ${compact ? 'compact' : ''}`}>
        <label className="field compact-field">
          <span>{t`Range`}</span>
          <select
            value={rangeKey}
            onChange={(event) => onRangeKey(event.target.value as ReportBalanceRange)}
          >
            {RANGES.map((option) => (
              <option key={option} value={option}>
                {rangeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        {rangeKey === 'custom' ? (
          <>
            <label className="field compact-field">
              <span>{t`From`}</span>
              <input
                type="date"
                value={custom.from}
                onChange={(event) => onCustom({ ...custom, from: event.target.value })}
              />
            </label>
            <label className="field compact-field">
              <span>{t`To`}</span>
              <input
                type="date"
                value={custom.to}
                onChange={(event) => onCustom({ ...custom, to: event.target.value })}
              />
            </label>
          </>
        ) : null}
        <label className="field compact-field">
          <span>{t`Grouping`}</span>
          <select
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
          >
            <option value="auto">{t`Automatic`}</option>
            <option value="day">{t`Daily`}</option>
            <option value="week">{t`Weekly`}</option>
            <option value="month">{t`Monthly`}</option>
          </select>
        </label>
        {data.data && data.data.currencies.length > 1 ? (
          <label className="field compact-field">
            <span>{t`Currency`}</span>
            <select
              value={activeCurrency ?? ''}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {data.data.currencies.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="balance-accounts">
          <span className="field-label">{t`Accounts`}</span>
          <MultiPicker
            ariaLabel={t`Add an account to the chart`}
            options={reportAccounts.map((account) => ({
              value: String(account.id),
              label: `${account.label} (${account.currency})`,
            }))}
            values={selectedIds.map(String)}
            onChange={(values) => onSelectedIds(values.map(Number))}
          />
        </div>
      </div>

      {data.data?.mixedCurrencies ? (
        <p className="banner info" role="status">
          {t`Historical conversion between currencies is not available. Each currency is shown on its own line.`}
        </p>
      ) : null}
      {data.data?.granularityFallback ? (
        <p className="banner info" role="status">
          {t`That grouping would return too many points, so the automatic one was used.`}
        </p>
      ) : null}
      {firstDate && firstDate > range.from ? (
        <p className="card-note report-note">
          {t`Reliable history starts on ${formatDate(firstDate, { day: '2-digit', month: 'short', year: 'numeric' })}.`}
        </p>
      ) : null}
      {noMovements ? (
        <p className="card-note report-note">
          {t`There were no movements in this range; the line keeps the balance known at the start.`}
        </p>
      ) : null}

      {data.error ? (
        <div className="banner" role="alert">
          {describeError(data.error, t`Could not load the balances.`)}
        </div>
      ) : data.loading && !data.data ? (
        <div className="chart-skeleton skeleton" aria-hidden="true" />
      ) : activeCurrency ? (
        <>
          <div className="chart-wrap">
            <LineChart
              series={series}
              currency={activeCurrency}
              fractionDigits={firstCurrency?.fractionDigits ?? 2}
              ariaLabel={t`Historical balance of the selected accounts`}
              granularity={data.data?.granularity}
            />
          </div>
          <div className="balance-summary">
            <div>
              <span className="field-label">{t`Starting balance`}</span>
              <strong>
                <Money
                  scope="totals"
                  amountMinor={startBalance}
                  currency={activeCurrency}
                  fractionDigits={firstCurrency?.fractionDigits ?? 2}
                />
              </strong>
            </div>
            <div>
              <span className="field-label">{t`Ending balance`}</span>
              <strong>
                <Money
                  scope="totals"
                  amountMinor={endBalance}
                  currency={activeCurrency}
                  fractionDigits={firstCurrency?.fractionDigits ?? 2}
                />
              </strong>
            </div>
            <div>
              <span className="field-label">{t`Balance change`}</span>
              <strong>
                <Money
                  scope="totals"
                  amountMinor={change}
                  currency={activeCurrency}
                  fractionDigits={firstCurrency?.fractionDigits ?? 2}
                  showSign
                />
                {changePercent !== null ? (
                  <span className="delta"> · {formatPercent(changePercent)}</span>
                ) : null}
              </strong>
            </div>
          </div>
          {mode === 'perAccount' && visibleAccounts.length > 6 ? (
            <p className="card-note report-note">
              {t`Showing 6 of ${visibleAccounts.length} accounts. Remove one to add another.`}
            </p>
          ) : null}
        </>
      ) : (
        <div className="empty">
          <h3>{t`No accounts selected`}</h3>
          <p>{t`Choose at least one account to draw its balance.`}</p>
        </div>
      )}
    </Card>
  )
}
