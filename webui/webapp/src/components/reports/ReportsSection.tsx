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
  isValidRange,
  parseReportUrl,
  previousRange,
  reportRange,
  safeRange,
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
type FlowTab = 'expenses' | 'income'

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
  const [url] = useState(() => parseReportUrl(window.location.search))
  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const focusedAccountId =
    url.accountId !== null &&
    reportAccounts.some((account) => account.id === url.accountId)
      ? url.accountId
      : null
  const [tab, setTab] = useState<ReportTab>(() => url.tab ?? initial.tab)
  const [period, setPeriod] = useState<ReportPeriod>(
    () => url.period ?? initial.period,
  )
  const [compare, setCompare] = useState<ReportCompare>(
    () => url.compare ?? initial.compare,
  )
  const [custom, setCustom] = useState(() => url.custom ?? {
    from: initial.customFrom,
    to: initial.customTo,
  })
  // `custom` can be temporarily empty while a native date input is edited; the
  // report always queries the last complete range so it never sends blank
  // dates or divides by NaN.
  const [lastValidCustom, setLastValidCustom] = useState(() =>
    safeRange(url.custom ?? { from: initial.customFrom, to: initial.customTo }, {
      from: startOfMonth(),
      to: today,
    }),
  )
  const [balanceRange, setBalanceRange] = useState<ReportBalanceRange>(
    () => url.balanceRange ?? initial.balanceRange,
  )
  const [balanceCustom, setBalanceCustom] = useState(() => url.balanceCustom ?? {
    from: initial.balanceFrom,
    to: initial.balanceTo,
  })
  const [lastValidBalanceCustom, setLastValidBalanceCustom] = useState(() =>
    safeRange(
      url.balanceCustom ?? { from: initial.balanceFrom, to: initial.balanceTo },
      { from: startOfMonth(), to: today },
    ),
  )
  const [balanceMode, setBalanceMode] = useState<BalanceMode>(() => {
    if (tab === 'accounts' && focusedAccountId !== null) return 'perAccount'
    return url.balanceMode ?? 'total'
  })
  // Filters belong to the view: opening Gastos from the summary must not leave
  // an expense category in Ingresos.
  const [flowCategories, setFlowCategories] = useState<Record<FlowTab, number[]>>(
    () => ({
      expenses: tab === 'expenses' ? url.categoryIds : [],
      income: tab === 'income' ? url.categoryIds : [],
    }),
  )

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const known = new Set(reportAccounts.map((account) => account.id))
    if (tab === 'accounts' && focusedAccountId !== null) return [focusedAccountId]
    const fromUrl = url.accountIds.filter((id) => known.has(id))
    const stored = initial.accountIds.filter((id) => known.has(id))
    if (fromUrl.length > 0) return fromUrl
    // An empty stored selection is a real choice; only the very first visit
    // starts with every account in the chart.
    const hasStored = localStorage.getItem(STORAGE_KEYS.reportAccountIds) !== null
    return hasStored ? stored : reportAccounts.map((account) => account.id)
  })

  const customRange = safeRange(custom, lastValidCustom)
  const range = reportRange(period, customRange)
  const previous = previousRange(range.from, range.to)
  const balanceCustomValue = safeRange(balanceCustom, lastValidBalanceCustom)
  const balanceCustomRange = balanceRangeFor(balanceRange, balanceCustomValue)
  const grouping = evolutionGrouping(range.from, range.to)
  const activeCategoryIds =
    tab === 'expenses'
      ? flowCategories.expenses
      : tab === 'income'
        ? flowCategories.income
        : []

  function updateCustom(next: { from: string; to: string }) {
    setCustom(next)
    if (isValidRange(next)) setLastValidCustom(safeRange(next, lastValidCustom))
  }

  function updateBalanceCustom(next: { from: string; to: string }) {
    setBalanceCustom(next)
    if (isValidRange(next)) {
      setLastValidBalanceCustom(safeRange(next, lastValidBalanceCustom))
    }
  }

  function updateFlowCategories(type: FlowTab, ids: number[]) {
    setFlowCategories((current) => ({ ...current, [type]: ids }))
  }

  useEffect(() => {
    rememberReportPreferences({
      tab,
      period,
      customFrom: customRange.from,
      customTo: customRange.to,
      compare,
      balanceRange,
      balanceFrom: balanceCustomValue.from,
      balanceTo: balanceCustomValue.to,
      accountIds: selectedIds,
    })
  }, [
    tab,
    period,
    customRange.from,
    customRange.to,
    compare,
    balanceRange,
    balanceCustomValue.from,
    balanceCustomValue.to,
    selectedIds,
  ])

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
      params.set('from', customRange.from)
      params.set('to', customRange.to)
    } else {
      params.delete('from')
      params.delete('to')
    }
    if (balanceRange === 'custom') {
      params.set('balanceFrom', balanceCustomValue.from)
      params.set('balanceTo', balanceCustomValue.to)
    } else {
      params.delete('balanceFrom')
      params.delete('balanceTo')
    }
    params.delete('reportAccount')
    selectedIds.forEach((id) => params.append('reportAccount', String(id)))
    params.delete('reportCategory')
    activeCategoryIds.forEach((id) => params.append('reportCategory', String(id)))
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
    customRange.from,
    customRange.to,
    balanceCustomValue.from,
    balanceCustomValue.to,
    selectedIds,
    activeCategoryIds.join(','),
  ])

  function openTab(next: ReportTab, categoryId?: number) {
    if (categoryId !== undefined && (next === 'expenses' || next === 'income')) {
      updateFlowCategories(next, [categoryId])
    }
    setTab(next)
    window.scrollTo?.({ top: 0 })
  }

  // Cuentas, Inversiones and Presupuestos have their own range/filters; the
  // shared period would be inert there and must not be presented.
  const showPeriod = tab === 'summary' || tab === 'expenses' || tab === 'income'

  return (
    <div className="reports-section">
      <div className="page-head">
        <div>
          <h1>{t`Reports`}</h1>
          {showPeriod ? (
            <p>
              {periodLabel(period)}
              {period === 'custom' ? ` · ${range.from} – ${range.to}` : ''}
            </p>
          ) : null}
        </div>
        {showPeriod ? (
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
                    onChange={(event) =>
                      updateCustom({ ...custom, from: event.target.value })
                    }
                  />
                </label>
                <label className="field compact-field">
                  <span>{t`To`}</span>
                  <input
                    type="date"
                    value={custom.to}
                    onChange={(event) =>
                      updateCustom({ ...custom, to: event.target.value })
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}
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
          onBalanceCustom={updateBalanceCustom}
          balanceRangeValue={balanceCustomRange}
          balanceMode={balanceMode}
          onBalanceMode={setBalanceMode}
          onOpenTab={openTab}
        />
      ) : tab === 'expenses' || tab === 'income' ? (
        <FlowsTab
          type={tab === 'expenses' ? 'expense' : 'income'}
          accounts={reportAccounts}
          range={range}
          previousRange={previous}
          compare={compare === 'previous'}
          grouping={grouping}
          homeCurrency={homeCurrency}
          categoryIds={tab === 'expenses' ? flowCategories.expenses : flowCategories.income}
          onCategoryIds={(ids) => updateFlowCategories(tab, ids)}
        />
      ) : tab === 'accounts' ? (
        <AccountsTab
          accounts={accounts}
          selectedIds={selectedIds}
          onSelectedIds={setSelectedIds}
          rangeKey={balanceRange}
          onRangeKey={setBalanceRange}
          custom={balanceCustom}
          onCustom={updateBalanceCustom}
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
