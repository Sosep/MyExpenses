import { t } from '@lingui/core/macro'
import type { BreakdownItem, Transaction } from '../types'
import { getReportTransactions, describeError } from '../api'
import { formatDate, formatMoney } from '../format'
import { useAsync } from '../hooks'
import { IconX } from './Icons'

interface ReportPanelProps {
  accountId: number
  by: 'category' | 'payee' | 'tag' | 'method'
  type: 'expense' | 'income' | 'both'
  from: string
  to: string
  item: BreakdownItem
  onClose: () => void
}

function description(transaction: Transaction): string {
  return (
    transaction.payee?.label ||
    transaction.comment ||
    transaction.category?.path ||
    t`Transaction`
  )
}

export function ReportPanel({
  accountId,
  by,
  type,
  from,
  to,
  item,
  onClose,
}: ReportPanelProps) {
  const page = useAsync(
    () => getReportTransactions(accountId, by, item.id, type, from, to),
    ['report-transactions', accountId, by, item.id, type, from, to],
  )
  const items = page.data?.items ?? []

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-label={item.label}>
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{t`Drill-down`}</div>
            <h2>{item.label}</h2>
            <p className="card-note">
              {t`${page.data?.total ?? item.count} transactions`}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close details`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          {page.loading ? <p className="card-note">{t`Loading…`}</p> : null}
          {page.error ? (
            <div className="banner">{describeError(page.error, t`Could not load the detail.`)}</div>
          ) : null}
          {items.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t`Date`}</th>
                  <th>{t`Description`}</th>
                  <th className="num">{t`Amount`}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="date">{formatDate(transaction.date)}</td>
                    <td className="desc">{description(transaction)}</td>
                    <td className="num">
                      {formatMoney(
                        transaction.amountMinor,
                        transaction.currency,
                        transaction.fractionDigits,
                        true,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </aside>
    </>
  )
}
