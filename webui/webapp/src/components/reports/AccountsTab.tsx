import { t } from '@lingui/core/macro'
import type { Account } from '../../types'
import { getBalanceSeries } from '../../api'
import { useAsync } from '../../hooks'
import { Money } from '../../privacy'
import type { ReportBalanceRange } from '../../preferences'
import { BalanceCard } from './BalanceCard'
import type { BalanceMode } from './BalanceCard'
import { Card } from './shared'

interface AccountsTabProps {
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
}

export function AccountsTab({
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
}: AccountsTabProps) {
  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const balances = useAsync(
    () =>
      selectedIds.length === 0
        ? Promise.resolve(null)
        : getBalanceSeries(selectedIds, range.from, range.to, 'auto'),
    ['balance-series', selectedIds.join(','), range.from, range.to, 'auto'],
  )
  const byCurrency = new Map<string, number>()
  reportAccounts.forEach((account) => {
    byCurrency.set(
      account.currency,
      (byCurrency.get(account.currency) ?? 0) + account.currentBalanceMinor,
    )
  })
  const rows = (balances.data?.accounts ?? []).map((entry) => {
    const start = entry.startBalanceMinor
    const end = entry.series[entry.series.length - 1]?.balanceMinor ?? start
    const current =
      reportAccounts.find((account) => account.id === entry.id)?.currentBalanceMinor ?? end
    return { ...entry, start, end, current, change: end - start }
  })

  return (
    <>
      <div className="kpis">
        {[...byCurrency.entries()].map(([currency, value], index) => (
          <div className={`kpi ${index === 0 ? 'mint' : index === 1 ? 'sky' : 'lav'}`} key={currency}>
            <div className="kpi-label">{t`Money available (${currency})`}</div>
            <div className="kpi-value">
              <Money
                scope="totals"
                amountMinor={value}
                currency={currency}
                fractionDigits={
                  reportAccounts.find((account) => account.currency === currency)
                    ?.fractionDigits ?? 2
                }
              />
            </div>
            <div className="kpi-foot">
              {reportAccounts.filter((account) => account.currency === currency).length}{' '}
              {t`accounts`}
            </div>
          </div>
        ))}
      </div>

      <BalanceCard
        accounts={reportAccounts}
        selectedIds={selectedIds}
        onSelectedIds={onSelectedIds}
        rangeKey={rangeKey}
        onRangeKey={onRangeKey}
        custom={custom}
        onCustom={onCustom}
        range={range}
        mode={mode}
        onMode={onMode}
      />

      <Card
        title={t`Accounts`}
        description={t`The current balance and the movement of the selected period.`}
      >
        <div className="table-scroll">
          <table className="table report-table">
            <thead>
              <tr>
                <th>{t`Account`}</th>
                <th className="num">{t`Current balance`}</th>
                <th className="num">{t`Money in`}</th>
                <th className="num">{t`Money out`}</th>
                <th className="num">{t`Balance change`}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.label}</strong>
                    <div className="card-note">{entry.currency}</div>
                  </td>
                  <td className="num">
                    <Money
                      scope="totals"
                      amountMinor={entry.current}
                      currency={entry.currency}
                      fractionDigits={entry.fractionDigits}
                    />
                  </td>
                  <td className="num">
                    <Money
                      scope="totals"
                      amountMinor={entry.periodIncomeMinor}
                      currency={entry.currency}
                      fractionDigits={entry.fractionDigits}
                    />
                  </td>
                  <td className="num">
                    <Money
                      scope="totals"
                      amountMinor={entry.periodExpensesMinor}
                      currency={entry.currency}
                      fractionDigits={entry.fractionDigits}
                    />
                  </td>
                  <td className="num">
                    <Money
                      scope="totals"
                      amountMinor={entry.change}
                      currency={entry.currency}
                      fractionDigits={entry.fractionDigits}
                      showSign
                    />
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        onSelectedIds([entry.id])
                        onMode('perAccount')
                      }}
                    >
                      {t`Show in chart`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="card-note report-note">{t`Choose one or more accounts to compare them.`}</p>
        ) : null}
      </Card>
    </>
  )
}
