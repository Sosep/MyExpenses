import { useState } from 'react'
import { t } from '@lingui/core/macro'
import type { BreakdownItem } from '../../types'
import { describeError, getBreakdown, getCategories, getReportSummary } from '../../api'
import { formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { useHistoryPanel } from '../../navigation'
import { Money } from '../../privacy'
import type { ChartGrouping } from '../Chart'
import { MultiPicker } from '../MultiPicker'
import { ReportPanel } from '../ReportPanel'
import { BreakdownCard, Card, Delta, EvolutionCard, Kpi } from './shared'

interface FlowsTabProps {
  type: 'expense' | 'income'
  accountIds: number[]
  range: { from: string; to: string }
  previousRange: { from: string; to: string }
  compare: boolean
  grouping: ChartGrouping
  homeCurrency: string
  categoryIds: number[]
  onCategoryIds: (ids: number[]) => void
}

function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
        86400000,
    ) + 1
  )
}

export function FlowsTab({
  type,
  accountIds,
  range,
  previousRange,
  compare,
  grouping,
  homeCurrency,
  categoryIds,
  onCategoryIds,
}: FlowsTabProps) {
  const [selected, setSelected] = useState<BreakdownItem | null>(null)
  const closeSelected = useHistoryPanel(selected !== null, () => setSelected(null))
  const accountId: number | 'all' = accountIds.length === 1 ? accountIds[0] : 'all'
  const reportAccountId = accountId === 'all' ? 0 : accountId
  const categories = useAsync(() => getCategories(), ['report-categories'])
  const summary = useAsync(
    () => getReportSummary(reportAccountId, range.from, range.to),
    ['report-summary', reportAccountId, range.from, range.to],
  )
  const previous = useAsync(
    () =>
      compare
        ? getReportSummary(reportAccountId, previousRange.from, previousRange.to)
        : Promise.resolve(null),
    ['report-summary-previous', reportAccountId, compare, previousRange.from, previousRange.to],
  )
  const breakdown = useAsync(
    () => getBreakdown(accountId, 'category', type, range.from, range.to, categoryIds),
    [
      'report-breakdown',
      accountId,
      type,
      range.from,
      range.to,
      categoryIds.join(','),
    ],
  )

  const totals = summary.data
  const returns = totals?.returnsMinor ?? 0
  const netExpenses = totals ? Math.abs(totals.expensesMinor) - returns : 0
  const netIncome = totals ? totals.incomeMinor - returns : 0
  const total = type === 'expense' ? netExpenses : netIncome
  const previousTotal = previous.data
    ? type === 'expense'
      ? Math.abs(previous.data.expensesMinor) - previous.data.returnsMinor
      : previous.data.incomeMinor - previous.data.returnsMinor
    : null
  const days = daysBetween(range.from, range.to)
  const average = days > 0 ? total / days : 0
  const useMonthlyAverage = days > 31
  const monthly = days > 0 ? total / (days / 30.44) : 0
  const currency = totals?.currency ?? homeCurrency
  const fractionDigits = totals?.fractionDigits ?? 2
  const error = summary.error ?? breakdown.error

  const label = type === 'expense' ? t`Spent` : t`Income`
  const title = type === 'expense' ? t`Spending by category` : t`Income by category`
  const categoryOptions =
    categories.data?.map((category) => ({
      value: String(category.id),
      label: category.label,
    })) ?? []

  return (
    <>
      {error ? (
        <div className="banner" role="alert">
          {describeError(error, t`Could not load this report.`)}
        </div>
      ) : null}
      <div className="kpis">
        <Kpi
          label={label}
          tone={type === 'expense' ? 'rose' : 'mint'}
          value={
            <Money
              scope="totals"
              amountMinor={total}
              currency={currency}
              fractionDigits={fractionDigits}
            />
          }
          foot={
            <Delta
              current={total}
              previous={previousTotal}
              compare={compare}
              lowerIsBetter={type === 'expense'}
            />
          }
        />
        <Kpi
          label={useMonthlyAverage ? t`Monthly average` : t`Daily average`}
          tone="sky"
          value={
            <Money
              scope="totals"
              amountMinor={useMonthlyAverage ? monthly : average}
              currency={currency}
              fractionDigits={fractionDigits}
            />
          }
          foot={t`${days} days in the period`}
        />
        <Kpi
          label={t`Operations`}
          tone="lav"
          value={totals?.count ?? 0}
          foot={t`${range.from} – ${range.to}`}
        />
        {type === 'expense' ? (
          <Kpi
            label={t`Refunds`}
            tone="lav"
            value={
              <Money
                scope="totals"
                amountMinor={returns}
                currency={currency}
                fractionDigits={fractionDigits}
              />
            }
            foot={t`Already subtracted from what you spent`}
          />
        ) : (
          <Kpi
            label={t`Share of total`}
            tone="lav"
            value={
              breakdown.data && totals && totals.incomeMinor + totals.expensesMinor !== 0
                ? formatPercent(
                    (netIncome / Math.max(netIncome + Math.abs(totals.expensesMinor), 1)) * 100,
                  )
                : '—'
            }
            foot={t`Income compared with spending`}
          />
        )}
      </div>

      <EvolutionCard
        type={type}
        range={range}
        previousRange={previousRange}
        compare={compare}
        grouping={grouping}
        homeCurrency={homeCurrency}
      />

      <Card title={t`Filters`}>
        <div className="report-filters">
          <MultiPicker
            ariaLabel={t`Filter by category`}
            options={categoryOptions}
            values={categoryIds.map(String)}
            onChange={(values) => onCategoryIds(values.map(Number))}
          />
          {categoryIds.length > 0 ? (
            <button type="button" className="btn ghost" onClick={() => onCategoryIds([])}>
              {t`Reset filters`}
            </button>
          ) : null}
        </div>
      </Card>

      <BreakdownCard
        title={title}
        description={
          breakdown.data
            ? t`${breakdown.data.items.length} groups · ${range.from} – ${range.to} · percentages on the filtered total`
            : t`Grouped by category, including split parts`
        }
        items={breakdown.data?.items ?? []}
        currency={breakdown.data?.currency ?? currency}
        fractionDigits={breakdown.data?.fractionDigits ?? fractionDigits}
        type={type}
        onOpen={setSelected}
        onDrill={(item) => onCategoryIds([...categoryIds, item.id])}
      />

      {selected ? (
        <ReportPanel
          accountId={reportAccountId}
          by="category"
          type={type}
          from={range.from}
          to={range.to}
          item={selected}
          onClose={closeSelected}
        />
      ) : null}
    </>
  )
}
