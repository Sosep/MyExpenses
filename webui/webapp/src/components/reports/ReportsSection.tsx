import { useEffect, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account } from '../../types'
import { todayIso } from '../../format'
import {
  readReportPreferences,
  rememberReportPreferences,
} from '../../preferences'
import { STORAGE_KEYS } from '../../uiPreferences'
import type {
  ReportBalanceRange,
  ReportCompare,
  ReportPeriod,
  ReportTab,
} from '../../preferences'
import {
  balanceRange as balanceRangeFor,
  evolutionGrouping,
  previousRange,
  reportRange,
} from '../../reportUi'
import { AccountsTab } from './AccountsTab'
import type { BalanceMode } from './BalanceCard'
import { BudgetsTab } from './BudgetsTab'
import { FlowsTab } from './FlowsTab'
import { InvestmentsTab } from './InvestmentsTab'
import { SummaryTab } from './SummaryTab'

export const REPORT_TAB_VALUES: readonly ReportTab[] = [
  'summary',
  'expenses',
  'income',
  'accounts',
  'investments',
  'budgets',
]
const PERIOD_VALUES: readonly ReportPeriod[] = [
  'week',
  'month',
  'quarter',
  'year',
  'lastYear',
  'custom',
]
const COMPARE_VALUES: readonly ReportCompare[] = ['none', 'previous']
const BALANCE_RANGES: readonly ReportBalanceRange[] = [
  'm1',
  'm3',
  'm6',
  'y1',
  'y2',
  'y5',
  'all',
  'custom',
]

function reportTabLabel(tab: ReportTab): string {
  switch (tab) {
    case 'summary':
      return t`Summary`
    case 'expenses':
      return t`Spending`
    case 'income':
      return t`Income`
    case 'accounts':
      return t`Accounts`
    case 'investments':
      return t`Investments`
    default:
      return t`Budgets`
  }
}

function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case 'week':
      return t`This week`
    case 'month':
      return t`This month`
    case 'quarter':
      return t`This quarter`
    case 'year':
      return t`This year`
    case 'lastYear':
      return t`Last year`
    default:
      return t`Custom`
  }
}

function startOfMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function urlIds(search: string, name: string): number[] {
  return new URLSearchParams(search)
    .getAll(name)
    .flatMap((value) => value.split(','))
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
}

interface ReportsSectionProps {
  accounts: Account[]
  homeCurrency: string
  onNavigate: (url: string) => void
}

export function ReportsSection({
  accounts,
  homeCurrency,
  onNavigate,
}: ReportsSectionProps) {
  const [today] = useState(() => todayIso())
  const [initial] = useState(() => readReportPreferences(startOfMonth(), today))
  const [search] = useState(() => window.location.search)
  const [tab, setTab] = useState<ReportTab>(
    () => oneOf(new URLSearchParams(search).get('tab'), REPORT_TAB_VALUES) ?? initial.tab,
  )
  const [period, setPeriod] = useState<ReportPeriod>(
    () => oneOf(new URLSearchParams(search).get('period'), PERIOD_VALUES) ?? initial.period,
  )
  const [compare, setCompare] = useState<ReportCompare>(
    () => oneOf(new URLSearchParams(search).get('compare'), COMPARE_VALUES) ?? initial.compare,
  )
  const [custom, setCustom] = useState({ from: initial.customFrom, to: initial.customTo })
  const [balanceRange, setBalanceRange] = useState<ReportBalanceRange>(
    () =>
      oneOf(new URLSearchParams(search).get('balanceRange'), BALANCE_RANGES) ??
      initial.balanceRange,
  )
  const [balanceCustom, setBalanceCustom] = useState({
    from: initial.balanceFrom,
    to: initial.balanceTo,
  })
  const [balanceMode, setBalanceMode] = useState<BalanceMode>(
    () => (new URLSearchParams(search).get('balanceMode') === 'perAccount' ? 'perAccount' : 'total'),
  )
  const [categoryIds, setCategoryIds] = useState<number[]>(() =>
    urlIds(search, 'reportCategory'),
  )

  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const known = new Set(reportAccounts.map((account) => account.id))
    const fromUrl = urlIds(search, 'reportAccount').filter((id) => known.has(id))
    const stored = initial.accountIds.filter((id) => known.has(id))
    if (fromUrl.length > 0) return fromUrl
    // An empty stored selection is a real choice; only the very first visit
    // starts with every account in the chart.
    const hasStored = localStorage.getItem(STORAGE_KEYS.reportAccountIds) !== null
    return hasStored ? stored : reportAccounts.map((account) => account.id)
  })

  const range = reportRange(period, custom)
  const previous = previousRange(range.from, range.to)
  const balanceCustomRange = balanceRangeFor(balanceRange, balanceCustom)
  const grouping = evolutionGrouping(range.from, range.to)

  useEffect(() => {
    rememberReportPreferences({
      tab,
      period,
      customFrom: custom.from,
      customTo: custom.to,
      compare,
      balanceRange,
      balanceFrom: balanceCustom.from,
      balanceTo: balanceCustom.to,
      accountIds: selectedIds,
    })
  }, [tab, period, custom, compare, balanceRange, balanceCustom, selectedIds])

  // The URL is the deep link QA and the browser history use. Filter changes
  // replace the current entry: only a view change is a navigation step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    params.set('period', period)
    params.set('compare', compare)
    params.set('balanceRange', balanceRange)
    params.set('balanceMode', balanceMode)
    // Only a custom range needs the dates; a preset would otherwise leak into
    // the transaction list's own `from`/`to`.
    if (period === 'custom') {
      params.set('from', custom.from)
      params.set('to', custom.to)
    } else {
      params.delete('from')
      params.delete('to')
    }
    if (balanceRange === 'custom') {
      params.set('balanceFrom', balanceCustom.from)
      params.set('balanceTo', balanceCustom.to)
    } else {
      params.delete('balanceFrom')
      params.delete('balanceTo')
    }
    params.delete('reportAccount')
    selectedIds.forEach((id) => params.append('reportAccount', String(id)))
    params.delete('reportCategory')
    categoryIds.forEach((id) => params.append('reportCategory', String(id)))
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${params.toString()}`,
    )
  }, [
    tab,
    period,
    compare,
    balanceRange,
    balanceMode,
    custom,
    balanceCustom,
    selectedIds,
    categoryIds,
  ])

  function openTab(next: ReportTab, categoryId?: number) {
    if (categoryId !== undefined) setCategoryIds([categoryId])
    setTab(next)
    window.scrollTo?.({ top: 0 })
  }

  const accountLabel =
    selectedIds.length === 0
      ? t`No accounts selected`
      : selectedIds.length === 1
        ? (accounts.find((account) => account.id === selectedIds[0])?.label ?? t`1 account`)
        : t`${selectedIds.length} accounts`

  return (
    <div className="reports-section">
      <div className="page-head">
        <div>
          <h1>{t`Reports`}</h1>
          <p>
            {t`${periodLabel(period)} · ${accountLabel}`}
            {period === 'custom' ? ` · ${range.from} – ${range.to}` : ''}
          </p>
        </div>
        <div className="page-actions report-global-filters">
          <div className="segmented period-segmented" role="group" aria-label={t`Period`}>
            {(['week', 'month', 'quarter', 'year', 'lastYear', 'custom'] as const).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  className={period === option ? 'active' : ''}
                  aria-pressed={period === option}
                  onClick={() => setPeriod(option)}
                >
                  {periodLabel(option)}
                </button>
              ),
            )}
          </div>
          <label className="field compact-field">
            <span>{t`Compare with`}</span>
            <select
              value={compare}
              onChange={(event) => setCompare(event.target.value as ReportCompare)}
            >
              <option value="none">{t`Nothing`}</option>
              <option value="previous">{t`Previous period`}</option>
            </select>
          </label>
          {period === 'custom' ? (
            <>
              <label className="field compact-field">
                <span>{t`From`}</span>
                <input
                  type="date"
                  value={custom.from}
                  onChange={(event) => setCustom({ ...custom, from: event.target.value })}
                />
              </label>
              <label className="field compact-field">
                <span>{t`To`}</span>
                <input
                  type="date"
                  value={custom.to}
                  onChange={(event) => setCustom({ ...custom, to: event.target.value })}
                />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <nav className="report-tabs" aria-label={t`Reports sections`}>
        {REPORT_TAB_VALUES.map((option) => (
          <button
            key={option}
            type="button"
            className={tab === option ? 'active' : ''}
            aria-current={tab === option ? 'page' : undefined}
            onClick={() => openTab(option)}
          >
            {reportTabLabel(option)}
          </button>
        ))}
      </nav>

      {tab === 'summary' ? (
        <SummaryTab
          accounts={accounts}
          accountIds={selectedIds}
          onAccountIds={setSelectedIds}
          range={range}
          previousRange={previous}
          compare={compare === 'previous'}
          grouping={grouping}
          homeCurrency={homeCurrency}
          balanceRange={balanceRange}
          onBalanceRange={setBalanceRange}
          balanceCustom={balanceCustom}
          onBalanceCustom={setBalanceCustom}
          balanceRangeValue={balanceCustomRange}
          balanceMode={balanceMode}
          onBalanceMode={setBalanceMode}
          onOpenTab={openTab}
        />
      ) : tab === 'expenses' || tab === 'income' ? (
        <FlowsTab
          type={tab === 'expenses' ? 'expense' : 'income'}
          accountIds={selectedIds}
          range={range}
          previousRange={previous}
          compare={compare === 'previous'}
          grouping={grouping}
          homeCurrency={homeCurrency}
          categoryIds={categoryIds}
          onCategoryIds={setCategoryIds}
        />
      ) : tab === 'accounts' ? (
        <AccountsTab
          accounts={accounts}
          selectedIds={selectedIds}
          onSelectedIds={setSelectedIds}
          rangeKey={balanceRange}
          onRangeKey={setBalanceRange}
          custom={balanceCustom}
          onCustom={setBalanceCustom}
          range={balanceCustomRange}
          mode={balanceMode}
          onMode={setBalanceMode}
        />
      ) : tab === 'investments' ? (
        <InvestmentsTab homeCurrency={homeCurrency} />
      ) : (
        <BudgetsTab accounts={accounts} onNavigate={onNavigate} />
      )}
    </div>
  )
}
