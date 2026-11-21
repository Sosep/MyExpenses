import { useState } from 'react'
import { plural, t } from '@lingui/core/macro'
import type { Account, BreakdownItem } from '../../types'
import { describeError, getBreakdown, getCategories, getReportSummary } from '../../api'
import { formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { useHistoryPanel } from '../../navigation'
import { Money } from '../../privacy'
import type { ChartGrouping } from '../Chart'
import { MultiPicker } from '../MultiPicker'
import { ReportPanel } from '../ReportPanel'
import { SearchSelect } from '../SearchSelect'
import { BreakdownCard, Card, Delta, EvolutionCard, Kpi } from './shared'

interface FlowsTabProps {
  type: 'expense' | 'income'
  accounts: Account[]
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
  accounts,
  range,
  previousRange,
  compare,
  grouping,
  homeCurrency,
  categoryIds,
  onCategoryIds,
}: FlowsTabProps) {
  const [selected, setSelected] = useState<BreakdownItem | null>(null)
  const [accountFilter, setAccountFilter] = useState('all')
  const closeSelected = useHistoryPanel(selected !== null, () => setSelected(null))
  const accountId: number | 'all' =
    accountFilter === 'all' ? 'all' : Number(accountFilter)
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
  const days = Math.max(1, daysBetween(range.from, range.to) || 0)
  const average = total / days
  const useMonthlyAverage = days > 31
  const monthly = total / (days / 30.44)
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
  const accountOptions = [
    { value: 'all', label: t`All accounts` },
    ...accounts.map((account) => ({
      value: String(account.id),
      label: account.label,
    })),
  ]
  const childrenOf = (id: number) =>
    (categories.data ?? []).some((category) => category.parentId === id)
  const canDrill = (item: BreakdownItem) =>
    childrenOf(item.id) &&
    !(categoryIds.length === 1 && categoryIds[0] === item.id)

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
          foot={t`${plural(days, {
            one: '# day in the period',
            other: '# days in the period',
          })}`}
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
                    (netIncome / Math.max(netIncome + Math.abs(netExpenses), 1)) * 100,
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
        homeCurrency={accountId === 'all' ? homeCurrency : currency}
        accountId={accountId}
      />

      <Card title={t`Filters`}>
        <div className="report-filters flows-filters">
          <label className="field compact-field">
            <span>{t`Account`}</span>
            <SearchSelect
              ariaLabel={t`Filter by account`}
              value={accountFilter}
              options={accountOptions}
              onChange={setAccountFilter}
            />
          </label>
          <MultiPicker
            ariaLabel={t`Filter by category`}
            options={categoryOptions}
            values={categoryIds.map(String)}
            onChange={(values) => onCategoryIds([...new Set(values.map(Number))])}
          />
          {accountFilter !== 'all' || categoryIds.length > 0 ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setAccountFilter('all')
                onCategoryIds([])
              }}
            >
              {t`Reset filters`}
            </button>
          ) : null}
        </div>
      </Card>

      <BreakdownCard
        title={title}
        description={
          breakdown.data
            ? t`${plural(breakdown.data.items.length, {
                one: '# group',
                other: '# groups',
              })} · ${range.from} – ${range.to} · percentages on the filtered total`
            : t`Grouped by category, including split parts`
        }
        items={breakdown.data?.items ?? []}
        currency={breakdown.data?.currency ?? currency}
        fractionDigits={breakdown.data?.fractionDigits ?? fractionDigits}
        type={type}
        canDrill={canDrill}
        onOpen={setSelected}
        onDrill={(item) => onCategoryIds([item.id])}
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
