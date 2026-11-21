import { Fragment, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { InvestmentAsset, InvestmentPortfolio } from '../../types'
import { describeError, getInvestments, getPrices } from '../../api'
import { formatDate, formatMoney } from '../../format'
import { useAsync } from '../../hooks'
import { Money, useMoney } from '../../privacy'
import { SearchSelect } from '../SearchSelect'
import { Card, Kpi } from './shared'

function PriceHistory({
  asset,
  portfolioCurrency,
  portfolioFractionDigits,
}: {
  asset: InvestmentAsset
  portfolioCurrency: string
  portfolioFractionDigits: number
}) {
  const money = useMoney('totals')
  const prices = useAsync(() => getPrices(asset.symbol), ['prices', asset.symbol])
  return (
    <div className="price-history">
      <h3>{t`Prices you entered for ${asset.label}`}</h3>
      <p className="card-note">
        {t`Manual valuations from oldest to newest. They are not live quotes.`}
      </p>
      {prices.loading ? <p className="card-note">{t`Loading…`}</p> : null}
      {prices.error ? (
        <div className="banner">{describeError(prices.error, t`Could not load the prices.`)}</div>
      ) : null}
      {prices.data && prices.data.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th className="num">{t`Price`}</th>
              <th>{t`Source`}</th>
            </tr>
          </thead>
          <tbody>
            {prices.data.map((price) => {
              const currency = price.currency || portfolioCurrency
              const fractionDigits =
                currency === portfolioCurrency ? portfolioFractionDigits : 2
              return (
                <tr key={`${price.date}-${price.source}`}>
                  <td>
                    {formatDate(price.date, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="num">
                    {money(
                      Math.round(price.value * 10 ** fractionDigits),
                      currency,
                      fractionDigits,
                    )}
                  </td>
                  <td>{price.source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : prices.data ? (
        <p className="card-note">{t`No prices entered for this product yet.`}</p>
      ) : null}
    </div>
  )
}

export function InvestmentsTab({ homeCurrency }: { homeCurrency: string }) {
  const [portfolioId, setPortfolioId] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const investments = useAsync(() => getInvestments(), ['report-investments'])
  const portfolios = investments.data?.portfolios ?? []
  const visible =
    portfolioId === 'all'
      ? portfolios
      : portfolios.filter((portfolio) => String(portfolio.id) === portfolioId)
  const totals = visible.map((portfolio) => {
    const known = portfolio.costKnown
    return {
      currency: portfolio.currency,
      fractionDigits: portfolio.fractionDigits,
      valuation: portfolio.valuationMinor,
      cost: known ? portfolio.costMinor : null,
      result: known ? portfolio.resultMinor : null,
      known,
    }
  })
  const byCurrency = new Map<string, typeof totals>()
  totals.forEach((entry) => {
    byCurrency.set(entry.currency, [...(byCurrency.get(entry.currency) ?? []), entry])
  })
  const summary = [...byCurrency.entries()].map(([currency, entries]) => {
    const known = entries.every((entry) => entry.known)
    const valuation = entries.reduce((sum, entry) => sum + entry.valuation, 0)
    const cost = known ? entries.reduce((sum, entry) => sum + (entry.cost ?? 0), 0) : null
    return {
      currency,
      fractionDigits: entries[0].fractionDigits,
      valuation,
      cost,
      // The API result excludes the cash held in the portfolio.
      result: known
        ? entries.reduce((sum, entry) => sum + (entry.result ?? 0), 0)
        : null,
    }
  })
  const primary = summary.find((entry) => entry.currency === homeCurrency) ?? summary[0]
  const assets = visible.flatMap((portfolio) =>
    portfolio.assets.map((asset) => ({ portfolio, asset })),
  )
  const lastValuation = portfolios
    .map((portfolio) => portfolio.lastValuationDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)

  return (
    <>
      {investments.error ? (
        <div className="banner" role="alert">
          {describeError(investments.error, t`Could not load the investments.`)}
        </div>
      ) : null}

      <div className="report-filters">
        <label className="field compact-field">
          <span>{t`Portfolio`}</span>
          <SearchSelect
            ariaLabel={t`Portfolio`}
            value={portfolioId}
            options={[
              { value: 'all', label: t`All portfolios` },
              ...portfolios.map((portfolio) => ({
                value: String(portfolio.id),
                label: portfolio.label,
              })),
            ]}
            onChange={setPortfolioId}
          />
        </label>
      </div>

      {investmentSummaryCards(primary, assets.length, lastValuation)}

      {summary.length > 1 ? (
        <Card
          title={t`Totals by currency`}
          description={t`Amounts in different currencies are never added together.`}
        >
          <div className="summary-rows">
            {summary.map((entry) => (
              <div className="summary-row" key={entry.currency}>
                <span>{entry.currency}</span>
                <strong>
                  <Money
                    scope="totals"
                    amountMinor={entry.valuation}
                    currency={entry.currency}
                    fractionDigits={entry.fractionDigits}
                  />
                </strong>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {portfolios.length === 0 && !investments.loading ? (
        <Card title={t`Investments`}>
          <div className="empty">
            <h3>{t`No portfolios yet`}</h3>
            <p>{t`Create a portfolio in the app and its products will appear here.`}</p>
          </div>
        </Card>
      ) : null}

      {visible.map((portfolio) => (
        <PortfolioCard
          key={portfolio.id}
          portfolio={portfolio}
          expanded={expanded}
          onExpand={(key) => setExpanded((current) => (current === key ? null : key))}
        />
      ))}
    </>
  )
}

function investmentSummaryCards(
  primary:
    | {
        currency: string
        fractionDigits: number
        valuation: number
        cost: number | null
        result: number | null
      }
    | undefined,
  productCount: number,
  lastValuation: string | undefined,
) {
  return (
    <div className="kpis">
      <Kpi
        label={t`Current value`}
        tone="mint"
        value={
          primary ? (
            <Money
              scope="totals"
              amountMinor={primary.valuation}
              currency={primary.currency}
              fractionDigits={primary.fractionDigits}
            />
          ) : (
            '—'
          )
        }
        foot={primary ? primary.currency : t`No portfolios`}
      />
      <Kpi
        label={t`Amount invested`}
        tone="sky"
        value={
          primary?.cost !== null && primary ? (
            <Money
              scope="totals"
              amountMinor={primary.cost}
              currency={primary.currency}
              fractionDigits={primary.fractionDigits}
            />
          ) : (
            t`Unknown`
          )
        }
        foot={
          !primary
            ? t`No portfolios`
            : primary.cost === null
              ? t`A transfer arrived without a purchase price`
              : t`Known purchase cost`
        }
      />
      <Kpi
        label={t`Estimated result`}
        tone="lav"
        value={
          primary?.result !== null && primary ? (
            <Money
              scope="totals"
              amountMinor={primary.result}
              currency={primary.currency}
              fractionDigits={primary.fractionDigits}
              showSign
            />
          ) : (
            '—'
          )
        }
        foot={t`Only when the cost is known`}
      />
      <Kpi
        label={t`Products`}
        tone="sky"
        value={productCount}
        foot={
          lastValuation
            ? t`Last manual valuation ${formatDate(lastValuation, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`
            : t`No manual valuation yet`
        }
      />
    </div>
  )
}

function PortfolioCard({
  portfolio,
  expanded,
  onExpand,
}: {
  portfolio: InvestmentPortfolio
  expanded: string | null
  onExpand: (key: string) => void
}) {
  return (
    <Card
      title={portfolio.label}
      description={
        portfolio.lastValuationDate
          ? t`Last manual valuation ${formatDate(portfolio.lastValuationDate, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })} · ${portfolio.currency}`
          : t`No manual valuation yet · ${portfolio.currency}`
      }
    >
      {portfolio.assets.length === 0 ? (
        <p className="card-note report-note">{t`This portfolio has no products.`}</p>
      ) : (
        <div className="table-scroll">
          <table className="table report-table">
            <thead>
              <tr>
                <th>{t`Product`}</th>
                <th className="num">{t`Quantity`}</th>
                <th className="num">{t`Current value`}</th>
                <th className="num">{t`Result`}</th>
                <th>{t`Price date`}</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.assets.map((asset) => {
                const key = `${portfolio.id}-${asset.symbol}`
                return (
                  <Fragment key={key}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="link"
                          aria-expanded={expanded === key}
                          onClick={() => onExpand(key)}
                        >
                          {asset.label} ({asset.symbol})
                        </button>
                      </td>
                      <td className="num">
                        {formatMoney(
                          asset.quantityMinor,
                          asset.symbol,
                          asset.fractionDigits,
                        )}
                      </td>
                      <td className="num">
                        <Money
                          scope="totals"
                          amountMinor={asset.valuationMinor}
                          currency={portfolio.currency}
                          fractionDigits={portfolio.fractionDigits}
                        />
                      </td>
                      <td className="num">
                        {asset.costKnown && asset.resultMinor !== null ? (
                          <span
                            className={
                              asset.resultMinor > 0
                                ? 'money-positive'
                                : asset.resultMinor < 0
                                  ? 'money-negative'
                                  : undefined
                            }
                          >
                            <Money
                              scope="totals"
                              amountMinor={asset.resultMinor}
                              currency={portfolio.currency}
                              fractionDigits={portfolio.fractionDigits}
                              showSign
                            />
                            <span className="sr-only">
                              {asset.resultMinor >= 0
                                ? t`Above the purchase cost`
                                : t`Below the purchase cost`}
                            </span>
                          </span>
                        ) : (
                          <span className="card-note">{t`Unknown cost`}</span>
                        )}
                      </td>
                      <td>
                        {asset.lastPriceDate
                          ? formatDate(asset.lastPriceDate, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : t`No price`}
                      </td>
                    </tr>
                    {expanded === key ? (
                      <tr>
                        <td colSpan={5}>
                          <PriceHistory
                            asset={asset}
                            portfolioCurrency={portfolio.currency}
                            portfolioFractionDigits={portfolio.fractionDigits}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!portfolio.costKnown ? (
        <p className="card-note report-note">
          {t`The result is hidden because at least one product arrived without a known purchase cost.`}
        </p>
      ) : null}
    </Card>
  )
}
