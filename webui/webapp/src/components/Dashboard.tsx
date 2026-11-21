import { useMemo } from 'react'
import type { Account, Transaction } from '../types'
import { describeError, getGrouped, getPortfolioAssets, getTransactions } from '../api'
import {
  currentMonth,
  formatDate,
  formatMonthKey,
  kindLabel,
  lastMonths,
  monthRange,
} from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { Money, useAmounts } from '../privacy'
import { fillSeries } from '../series'
import { Chart } from './Chart'

interface DashboardProps {
  account: Account
  onOpenTransactions: () => void
  onNewTransaction: () => void
}

function description(transaction: Transaction): string {
  if (transaction.payee?.label) return transaction.payee.label
  if (transaction.comment) return transaction.comment
  return kindLabel(transaction.kind)
}

export function Dashboard({
  account,
  onOpenTransactions,
  onNewTransaction,
}: DashboardProps) {
  // A portfolio's overview is its valuation: what it is worth, in cash and in
  // assets, at the latest stored prices. The income/expense chart below is
  // about flows, which the portfolio tracks through the transactions screen.
  if (account.portfolioRole === 'CONTAINER') {
    return (
      <PortfolioOverview
        account={account}
        onOpenTransactions={onOpenTransactions}
      />
    )
  }
  return (
    <AccountOverview
      account={account}
      onOpenTransactions={onOpenTransactions}
      onNewTransaction={onNewTransaction}
    />
  )
}

function PortfolioOverview({
  account,
  onOpenTransactions,
}: {
  account: Account
  onOpenTransactions: () => void
}) {
  const assets = useAsync(
    () => getPortfolioAssets(account.id),
    ['portfolio-assets', account.id],
  )
  const amounts = useAmounts()
  const data = assets.data
  const assetValuation = data
    ? data.assets.reduce((total, asset) => total + asset.valuationMinor, 0)
    : 0

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Overview`}</h1>
          <p>{account.label}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={onOpenTransactions}>
            {t`Transactions`}
          </button>
          <button type="button" className="btn" onClick={() => assets.reload()}>
            {t`Refresh`}
          </button>
        </div>
      </div>

      {assets.error ? (
        <div className="banner" role="alert">
          <span>{describeError(assets.error, t`Could not load the portfolio.`)}</span>
          <button type="button" className="btn ghost banner-action" onClick={() => assets.reload()}>
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <div className="kpis">
        <div className="hero">
          <div className="accent-bar" />
          <div className="kpi-label">{t`Valuation`}</div>
          <div className="hero-value">
            {data ? (
              <Money
                scope="totals"
                amountMinor={data.valuationMinor}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
              />
            ) : (
              '—'
            )}
          </div>
          <div className="hero-delta">{t`At the latest stored prices`}</div>
        </div>
        <div className="kpi mint">
          <div className="kpi-label">{t`Cash`}</div>
          <div className="kpi-value">
            {data ? (
              <Money
                scope="totals"
                amountMinor={data.cashMinor}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
              />
            ) : (
              '—'
            )}
          </div>
          <div className="kpi-foot">{t`Portfolio cash`}</div>
        </div>
        <div className="kpi lav">
          <div className="kpi-label">{t`Assets`}</div>
          <div className="kpi-value">
            {data ? (
              <Money
                scope="totals"
                amountMinor={assetValuation}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
              />
            ) : (
              '—'
            )}
          </div>
          <div className="kpi-foot">{data ? `${data.assets.length}` : ''}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t`Assets`}</h2>
            <p>{t`Quantity at the latest price`}</p>
          </div>
          <span className="card-note">{account.currency}</span>
        </div>
        {assets.loading ? (
          <div className="panel-loading">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        ) : data && data.assets.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t`Asset`}</th>
                <th className="num">{t`Quantity`}</th>
                <th className="num hide-sm">{t`Price`}</th>
                <th className="num">{t`Valuation`}</th>
              </tr>
            </thead>
            <tbody>
              {data.assets.map((asset) => {
                const share =
                  assetValuation > 0 ? Math.round((asset.valuationMinor * 100) / assetValuation) : 0
                return (
                  <tr key={asset.id} data-asset-symbol={asset.symbol}>
                    <td>
                      <div className="desc">{asset.label}</div>
                      <div className="sub">{asset.symbol}</div>
                    </td>
                    <td className="num">
                      <Money
                        amountMinor={asset.quantityMinor}
                        currency={asset.symbol}
                        fractionDigits={asset.fractionDigits}
                      />
                    </td>
                    <td className="num hide-sm">
                      {asset.priceMinor === null
                        ? '—'
                        : amounts.totals
                          ? '••••'
                          : `${(
                              asset.priceMinor *
                              Math.pow(10, asset.fractionDigits - account.fractionDigits)
                            ).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${
                              account.currency
                            }`}
                    </td>
                    <td className="num">
                      <Money
                        scope="totals"
                        amountMinor={asset.valuationMinor}
                        currency={account.currency}
                        fractionDigits={account.fractionDigits}
                      />
                      <span className="asset-share" role="presentation">
                        <span
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <h3>{t`No assets yet`}</h3>
            <p>{t`The first buy creates the asset here.`}</p>
          </div>
        )}
      </section>
    </>
  )
}

function AccountOverview({
  account,
  onOpenTransactions,
  onNewTransaction,
}: DashboardProps) {
  const months = lastMonths(12)
  const fromMonth = months.from.slice(0, 7)
  const groups = useAsync(
    () => getGrouped(account.id, 'MONTH', months.from, months.to),
    ['dashboard-groups', account.id, months.from, months.to],
  )
  const thisMonth = monthRange(currentMonth())
  const recent = useAsync(
    () => getTransactions(account.id, thisMonth.from, thisMonth.to, 'both', 8, 0),
    ['dashboard-recent', account.id, thisMonth.from, thisMonth.to],
  )

  const series = useMemo(
    () => fillSeries(groups.data ?? [], fromMonth, 12),
    [groups.data, fromMonth],
  )
  const current = series[series.length - 1]
  const income = current?.incomeMinor ?? 0
  const expenses = current?.expensesMinor ?? 0
  const saved = income + expenses
  const month = currentMonth()
  const loading = groups.loading || recent.loading
  const error = groups.error ?? recent.error

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Overview`}</h1>
          <p>
            {formatMonthKey(month)} · {account.label}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={onOpenTransactions}>
            {t`Transactions`}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              groups.reload()
              recent.reload()
            }}
          >
            {t`Refresh`}
          </button>
          <button
            type="button"
            className="btn primary new-transaction"
            onClick={onNewTransaction}
          >
            {t`New transaction`}
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner" role="alert">
          <span>{describeError(error, t`Could not load the overview.`)}</span>
          <button
            type="button"
            className="btn ghost banner-action"
            onClick={() => {
              groups.reload()
              recent.reload()
            }}
          >
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <div className="kpis">
        <div className="hero">
          <div className="accent-bar" />
          <div className="kpi-label">{t`Net worth`}</div>
          <div className="hero-value">
            <Money
              scope="totals"
              amountMinor={account.currentBalanceMinor}
              currency={account.currency}
              fractionDigits={account.fractionDigits}
            />
          </div>
          <div className="hero-delta">
            <span className={saved >= 0 ? 'amount-pos' : 'amount-neg'}>
              <Money
                scope="totals"
                amountMinor={saved}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
                showSign
              />
            </span>{' '}
            {t`saved this month`}
          </div>
        </div>
        <div className="kpi mint">
          <div className="kpi-label">{t`Income`}</div>
          <div className="kpi-value">
            {loading ? (
              '—'
            ) : (
              <Money
                scope="totals"
                amountMinor={income}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
              />
            )}
          </div>
          <div className="kpi-foot">{t`This month`}</div>
        </div>
        <div className="kpi rose">
          <div className="kpi-label">{t`Expenses`}</div>
          <div className="kpi-value">
            {loading ? (
              '—'
            ) : (
              <Money
                scope="totals"
                amountMinor={expenses}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
              />
            )}
          </div>
          <div className="kpi-foot">{t`This month`}</div>
        </div>
        <div className="kpi lav">
          <div className="kpi-label">{t`Saved`}</div>
          <div className="kpi-value">
            {loading ? (
              '—'
            ) : (
              <Money
                scope="totals"
                amountMinor={saved}
                currency={account.currency}
                fractionDigits={account.fractionDigits}
                showSign
              />
            )}
          </div>
          <div className="kpi-foot">{t`Income minus expenses`}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t`Income and expenses`}</h2>
            <p>{t`Last 12 months`}</p>
          </div>
          <span className="card-note">{account.currency}</span>
        </div>
        <div className="chart-wrap">
          {groups.loading ? (
            <div className="skeleton chart-skeleton" />
          ) : (
            <Chart
              series={series}
              currency={account.currency}
              fractionDigits={account.fractionDigits}
            />
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t`Recent transactions`}</h2>
            <p>{formatMonthKey(month)}</p>
          </div>
          <button type="button" className="link" onClick={onOpenTransactions}>
            {t`View all`}
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Description`}</th>
              <th className="hide-sm">{t`Category`}</th>
              <th className="num">{t`Amount`}</th>
            </tr>
          </thead>
          <tbody>
            {recent.loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={4}>
                    <div className="skeleton skeleton-row" />
                  </td>
                </tr>
              ))
            ) : recent.data && recent.data.items.length > 0 ? (
              recent.data.items.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="date">{formatDate(transaction.date)}</td>
                  <td>
                    <div className="desc">{description(transaction)}</div>
                  </td>
                  <td className="hide-sm">
                    {transaction.category?.path ?? kindLabel(transaction.kind)}
                  </td>
                  <td
                    className={`num ${
                      transaction.kind === 'TRANSFER'
                        ? 'amount-neutral'
                        : transaction.amountMinor > 0
                          ? 'amount-pos'
                          : 'amount-neg'
                    }`}
                  >
                    <Money
                      amountMinor={transaction.amountMinor}
                      currency={transaction.currency}
                      fractionDigits={transaction.fractionDigits}
                      showSign
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="empty">
                    <h3>{t`No transactions this month`}</h3>
                    <p>{t`Record one in the app and it will show up here.`}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
