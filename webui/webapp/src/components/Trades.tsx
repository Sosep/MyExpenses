import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, Trade, TradeType } from '../types'
import { deleteTransaction, describeError, getTrades } from '../api'
import { formatDate } from '../format'
import { useHistoryPanel } from '../navigation'
import { Money, useAmounts, useMoney } from '../privacy'
import { maskedMoney } from '../format'
import { useAsync } from '../hooks'
import { useFocusTrap } from '../useFocusTrap'
import { IconX } from './Icons'

interface TradesProps {
  account: Account
  onNewTrade: () => void
  onEditTrade: (id: number) => void
}

const TYPE_LABEL: Record<TradeType, () => string> = {
  BUY: () => t`Buy`,
  SELL: () => t`Sell`,
  DEPOSIT: () => t`Deposit`,
  WITHDRAW: () => t`Withdraw`,
  TRANSFER_IN: () => t`Transfer in`,
  TRANSFER_OUT: () => t`Transfer out`,
}

/** The labels live in functions: Lingui needs the locale activated first. */
function typeLabel(type: TradeType): string {
  return TYPE_LABEL[type]()
}

function tradeTypeClass(type: TradeType): string {
  if (type === 'BUY' || type === 'DEPOSIT' || type === 'TRANSFER_IN') return 'amount-pos'
  if (type === 'SELL' || type === 'WITHDRAW' || type === 'TRANSFER_OUT') return 'amount-neg'
  return 'amount-neutral'
}

function quantityText(trade: Trade): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: trade.fractionDigits,
  }).format(trade.quantityMinor / Math.pow(10, trade.fractionDigits))
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  )
}

function TradePanel({
  trade,
  account,
  onClose,
  onEdit,
  onDeleted,
}: {
  trade: Trade
  account: Account
  onClose: () => void
  onEdit: (id: number) => void
  onDeleted: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const money = useMoney('transactions')
  const amounts = useAmounts()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTransaction(trade.id)
      onDeleted()
    } catch (cause) {
      setDeleteError(describeError(cause, t`Could not delete the operation.`))
      setDeleting(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const priceText = trade.price === null
    ? '—'
    : amounts.transactions
      ? '••••'
      : `${Number(trade.price).toLocaleString(undefined, {
          maximumFractionDigits: 8,
        })} ${trade.currency}`

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        ref={panelRef}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t`Operation details`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{typeLabel(trade.type)}</div>
            <h2>{t`Details`}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t`Close details`}
            autoFocus
          >
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          <div>
            <div className="panel-amount">
              <Money
                amountMinor={trade.principalMinor}
                currency={trade.currency}
                fractionDigits={account.fractionDigits}
              />
            </div>
            <div className="panel-date">
              {formatDate(trade.date, {
                weekday: 'short',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
              {trade.time ? ` · ${trade.time}` : ''}
            </div>
          </div>

          {deleteError ? <p className="error-text">{deleteError}</p> : null}
          <div className="detail-grid">
            <Field label={t`Type`}>{typeLabel(trade.type)}</Field>
            <Field label={t`Asset`}>{trade.assetSymbol}</Field>
            <Field label={t`Quantity`}>{quantityText(trade)}</Field>
            <Field label={t`Price`}>{priceText}</Field>
            <Field label={t`Amount`}>
              <Money
                amountMinor={trade.principalMinor}
                currency={trade.currency}
                fractionDigits={account.fractionDigits}
              />
            </Field>
            {trade.feeMinor !== null ? (
              <Field label={t`Fee`}>
                {money(trade.feeMinor, trade.currency, account.fractionDigits)}
              </Field>
            ) : null}
            <Field label={t`Counterpart`}>{trade.peerAccountLabel ?? '—'}</Field>
            {trade.comment ? <Field label={t`Note`}>{trade.comment}</Field> : null}
          </div>
        </div>
        <div className="panel-footer">
          <div className="panel-actions">
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? t`Deleting…` : t`Delete`}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t`Close`}
            </button>
            <button type="button" className="btn primary" onClick={() => onEdit(trade.id)}>
              {t`Edit`}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

/**
 * The operations of a portfolio: the app's trade list, rebuilt from
 * `GET /portfolios/{id}/trades`. The detail opens in a side panel like the
 * transaction detail; editing arrives with the trade editor milestone.
 */
export function Trades({ account, onNewTrade, onEditTrade }: TradesProps) {
  const money = useMoney('transactions')
  const amounts = useAmounts()
  const page = useAsync(() => getTrades(account.id, 50, 0), ['trades', account.id])
  const [selected, setSelected] = useState<Trade | null>(null)
  const closePanel = useHistoryPanel(selected !== null, () => setSelected(null))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Transactions`}</h1>
          <p>{account.label}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => page.reload()}>
            {t`Refresh`}
          </button>
          <button type="button" className="btn primary" onClick={onNewTrade}>
            {t`New operation`}
          </button>
        </div>
      </div>

      {page.error ? (
        <div className="banner" role="alert">
          <span>{describeError(page.error, t`Could not load the operations.`)}</span>
          <button type="button" className="btn ghost banner-action" onClick={() => page.reload()}>
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Operations`}</h2>
            <p>{t`Buy, sell, deposits, withdrawals and transfers`}</p>
          </div>
          {page.data ? <span className="card-note">{page.data.total}</span> : null}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Type`}</th>
              <th className="hide-sm">{t`Asset`}</th>
              <th className="num">{t`Quantity`}</th>
              <th className="num hide-sm">{t`Price`}</th>
              <th className="num">{t`Amount`}</th>
              <th className="num hide-sm">{t`Fee`}</th>
              <th className="hide-sm">{t`Counterpart`}</th>
            </tr>
          </thead>
          <tbody>
            {page.loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={8}>
                    <div className="skeleton skeleton-row" />
                  </td>
                </tr>
              ))
            ) : page.data && page.data.items.length > 0 ? (
              page.data.items.map((trade) => (
                <tr
                  key={trade.id}
                  data-trade-id={trade.id}
                  tabIndex={0}
                  onClick={() => setSelected(trade)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setSelected(trade)
                  }}
                >
                  <td className="date">{formatDate(trade.date)}</td>
                  <td>
                    <span className={tradeTypeClass(trade.type)}>{typeLabel(trade.type)}</span>
                  </td>
                  <td className="hide-sm">{trade.assetSymbol}</td>
                  <td className="num">
                    {money(trade.quantityMinor, trade.assetSymbol, trade.fractionDigits)}
                  </td>
                  <td className="num hide-sm">
                    {trade.price === null
                      ? '—'
                      : amounts.transactions
                        ? maskedMoney(trade.currency)
                        : Number(trade.price).toLocaleString(undefined, {
                            maximumFractionDigits: 8,
                          })}
                  </td>
                  <td className="num">
                    <Money
                      amountMinor={trade.principalMinor}
                      currency={trade.currency}
                      fractionDigits={account.fractionDigits}
                    />
                  </td>
                  <td className="num hide-sm">
                    {trade.feeMinor === null
                      ? '—'
                      : money(trade.feeMinor, trade.currency, account.fractionDigits)}
                  </td>
                  <td className="hide-sm">{trade.peerAccountLabel ?? '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty">
                    <h3>{t`No operations yet`}</h3>
                    <p>{t`A deposit or a buy will show up here.`}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selected ? (
        <TradePanel
          trade={selected}
          account={account}
          onClose={closePanel}
          onEdit={(id) => onEditTrade(id)}
          onDeleted={() => {
            closePanel()
            page.reload()
          }}
        />
      ) : null}
    </>
  )
}
