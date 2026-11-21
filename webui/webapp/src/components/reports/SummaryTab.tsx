import { useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, BreakdownItem } from '../../types'
import {
  describeError,
  getBreakdown,
  getInvestments,
  getReportSummary,
} from '../../api'
import { formatDate, formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { useHistoryPanel } from '../../navigation'
import { Money } from '../../privacy'
import type { ReportBalanceRange, ReportTab } from '../../preferences'
import type { ChartGrouping } from '../Chart'
import { ReportPanel } from '../ReportPanel'
import { BalanceCard } from './BalanceCard'
import type { BalanceMode } from './BalanceCard'
import { loadBudgetProgresses, budgetStateLabel } from './budgetProgress'
import { BreakdownCard, Card, Delta, EvolutionCard, Kpi } from './shared'

interface SummaryTabProps {
  accounts: Account[]
  accountIds: number[]
  onAccountIds: (ids: number[]) => void
  range: { from: string; to: string }
  previousRange: { from: string; to: string }
  compare: boolean
  grouping: ChartGrouping
  homeCurrency: string
  balanceRange: ReportBalanceRange
  onBalanceRange: (range: ReportBalanceRange) => void
  balanceCustom: { from: string; to: string }
  onBalanceCustom: (range: { from: string; to: string }) => void
  balanceRangeValue: { from: string; to: string }
  balanceMode: BalanceMode
  onBalanceMode: (mode: BalanceMode) => void
  onOpenTab: (tab: ReportTab, categoryId?: number) => void
}

export function SummaryTab({
  accounts,
  accountIds,
  onAccountIds,
  range,
  previousRange,
  compare,
  grouping,
  homeCurrency,
  balanceRange,
  onBalanceRange,
  balanceCustom,
  onBalanceCustom,
  balanceRangeValue,
  balanceMode,
  onBalanceMode,
  onOpenTab,
}: SummaryTabProps) {
  const [selected, setSelected] = useState<BreakdownItem | null>(null)
  const closeSelected = useHistoryPanel(selected !== null, () => setSelected(null))
  const summary = useAsync(
    () => getReportSummary(0, range.from, range.to),
    ['report-summary', range.from, range.to],
  )
  const previous = useAsync(
    () =>
      compare
        ? getReportSummary(0, previousRange.from, previousRange.to)
        : Promise.resolve(null),
    ['report-summary-previous', compare, previousRange.from, previousRange.to],
  )
  const breakdown = useAsync(
    () => getBreakdown('all', 'category', 'expense', range.from, range.to),
    ['report-breakdown', range.from, range.to],
  )
  const investments = useAsync(() => getInvestments(), ['report-investments'])
  const budgets = useAsync(() => loadBudgetProgresses(), ['report-budgets'])
  const error = summary.error ?? breakdown.error

  const totals = summary.data
  const returns = totals?.returnsMinor ?? 0
  const income = totals ? totals.incomeMinor - returns : 0
  const spent = totals ? Math.abs(totals.expensesMinor) - returns : 0
  const balance = income - spent
  const savingsRate = income > 0 ? (balance / income) * 100 : null
  const previousIncome = previous.data
    ? previous.data.incomeMinor - previous.data.returnsMinor
    : null
  const previousSpent = previous.data
    ? Math.abs(previous.data.expensesMinor) - previous.data.returnsMinor
    : null
  const previousBalance = previous.data
    ? previousIncome !== null && previousSpent !== null
      ? previousIncome - previousSpent
      : null
    : null
  const previousSavings =
    previous.data && previousIncome !== null && previousIncome > 0
      ? (previousBalance! / previousIncome) * 100
      : null
  const currency = totals?.currency ?? homeCurrency
  const fractionDigits = totals?.fractionDigits ?? 2

  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const balancesByCurrency = new Map<string, number>()
  reportAccounts.forEach((account) => {
    balancesByCurrency.set(
      account.currency,
      (balancesByCurrency.get(account.currency) ?? 0) + account.currentBalanceMinor,
    )
  })
  const investmentTotal =
    investments.data?.totals.find((entry) => entry.currency === homeCurrency) ??
    investments.data?.totals[0]
  const budgetRows = budgets.data ?? []
  const over = budgetRows.filter((entry) => budgetStateLabel(entry.progress) === 'over')
  const warn = budgetRows.filter((entry) => budgetStateLabel(entry.progress) === 'warn')

  return (
    <>
      {error ? (
        <div className="banner" role="alert">
          {describeError(error, t`Could not load the overview.`)}
        </div>
      ) : null}

      <div className="kpis">
        <Kpi
          label={t`Income`}
          tone="mint"
          value={
            <Money
              scope="totals"
              amountMinor={income}
              currency={currency}
              fractionDigits={fractionDigits}
            />
          }
          foot={<Delta current={income} previous={previousIncome} compare={compare} />}
        />
        <Kpi
          label={t`Spent`}
          tone="rose"
          value={
            <Money
              scope="totals"
              amountMinor={spent}
              currency={currency}
              fractionDigits={fractionDigits}
            />
          }
          foot={
            <Delta
              current={spent}
              previous={previousSpent}
              compare={compare}
              lowerIsBetter
            />
          }
        />
        <Kpi
          label={t`Period balance`}
          tone="lav"
          value={
            <Money
              scope="totals"
              amountMinor={balance}
              currency={currency}
              fractionDigits={fractionDigits}
              showSign
            />
          }
          foot={<Delta current={balance} previous={previousBalance} compare={compare} />}
        />
        <Kpi
          label={t`Savings rate`}
          tone="sky"
          value={savingsRate === null ? '—' : formatPercent(savingsRate)}
          foot={
            savingsRate === null
              ? t`Not available without income`
              : compare && previousSavings !== null && previousSavings !== 0
                ? t`${formatPercent(savingsRate - previousSavings)} difference vs the previous period`
                : t`Balance divided by income`
          }
        />
      </div>

      <BalanceCard
        accounts={reportAccounts}
        selectedIds={accountIds}
        onSelectedIds={onAccountIds}
        rangeKey={balanceRange}
        onRangeKey={onBalanceRange}
        custom={balanceCustom}
        onCustom={onBalanceCustom}
        range={balanceRangeValue}
        mode={balanceMode}
        onMode={onBalanceMode}
        compact
      />

      <EvolutionCard
        type="both"
        range={range}
        previousRange={previousRange}
        compare={compare}
        grouping={grouping}
        homeCurrency={homeCurrency}
      />

      <BreakdownCard
        title={t`Main spending categories`}
        description={t`The categories that took the largest share of your spending.`}
        items={(breakdown.data?.items ?? []).slice(0, 6)}
        currency={breakdown.data?.currency ?? currency}
        fractionDigits={breakdown.data?.fractionDigits ?? fractionDigits}
        type="expense"
        drillLabel={t`Open in spending`}
        onDrill={(item) => onOpenTab('expenses', item.id)}
        onOpen={setSelected}
      />

      <div className="report-grid">
        <Card
          title={t`Money available`}
          description={t`The balance of your accounts right now.`}
          action={
            <button type="button" className="link" onClick={() => onOpenTab('accounts')}>
              {t`See accounts`}
            </button>
          }
        >
          <div className="summary-rows">
            {[...balancesByCurrency.entries()].map(([code, value]) => (
              <div className="summary-row" key={code}>
                <span>{code}</span>
                <strong>
                  <Money
                    scope="totals"
                    amountMinor={value}
                    currency={code}
                    fractionDigits={
                      reportAccounts.find((account) => account.currency === code)
                        ?.fractionDigits ?? 2
                    }
                  />
                </strong>
              </div>
            ))}
            {balancesByCurrency.size === 0 ? <p className="card-note">{t`No accounts.`}</p> : null}
          </div>
        </Card>

        <Card
          title={t`Money invested`}
          description={t`Valued with the last price you entered, not a live quote.`}
          action={
            <button type="button" className="link" onClick={() => onOpenTab('investments')}>
              {t`See investments`}
            </button>
          }
        >
          {investments.loading && !investments.data ? (
            <p className="card-note">{t`Loading…`}</p>
          ) : investmentTotal ? (
            <div className="summary-rows">
              <div className="summary-row">
                <span>{t`Current value`}</span>
                <strong>
                  <Money
                    scope="totals"
                    amountMinor={investmentTotal.valuationMinor}
                    currency={investmentTotal.currency}
                    fractionDigits={investmentTotal.fractionDigits}
                  />
                </strong>
              </div>
              <div className="summary-row">
                <span>{t`Amount invested`}</span>
                <strong>
                  {investmentTotal.costKnown && investmentTotal.costMinor !== null ? (
                    <Money
                      scope="totals"
                      amountMinor={investmentTotal.costMinor}
                      currency={investmentTotal.currency}
                      fractionDigits={investmentTotal.fractionDigits}
                    />
                  ) : (
                    t`Unknown`
                  )}
                </strong>
              </div>
              <div className="summary-row">
                <span>{t`Last manual valuation`}</span>
                <strong>
                  {investments.data ? lastDate(investments.data) : '—'}
                </strong>
              </div>
            </div>
          ) : (
            <p className="card-note report-note">{t`You have no portfolios yet.`}</p>
          )}
        </Card>

        <Card
          title={t`Budgets`}
          description={t`How your spending limits are doing.`}
          action={
            <button type="button" className="link" onClick={() => onOpenTab('budgets')}>
              {t`See budgets`}
            </button>
          }
        >
          <div className="summary-rows">
            <div className="summary-row">
              <span>{t`Within the limit`}</span>
              <strong>{budgetRows.length - over.length - warn.length}</strong>
            </div>
            <div className="summary-row">
              <span>{t`Close to the limit`}</span>
              <strong>{warn.length}</strong>
            </div>
            <div className="summary-row">
              <span>{t`Over the limit`}</span>
              <strong>{over.length}</strong>
            </div>
          </div>
        </Card>
      </div>

      {selected ? (
        <ReportPanel
          accountId={0}
          by="category"
          type="expense"
          from={range.from}
          to={range.to}
          item={selected}
          onClose={closeSelected}
        />
      ) : null}
    </>
  )
}

function lastDate(data: { portfolios: { lastValuationDate: string | null }[] }): string {
  const dates = data.portfolios
    .map((portfolio) => portfolio.lastValuationDate)
    .filter((date): date is string => Boolean(date))
    .sort()
  return dates.at(-1) ? formatDate(dates.at(-1)!, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
