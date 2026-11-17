import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '../types'
import { getTransaction } from '../api'
import { formatDate, formatMoney, kindLabel, statusLabel } from '../format'
import { useAsync } from '../hooks'
import { IconX } from './Icons'

interface PanelProps {
  id: number
  account: Account
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  )
}

export function TransactionPanel({ id, account, onClose }: PanelProps) {
  const detail = useAsync(() => getTransaction(id), [id])

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

  const transaction = detail.data

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-label="Transaction details">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">
              {transaction ? kindLabel(transaction.kind) : 'Transaction'}
            </div>
            <h2>Details</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close details"
            autoFocus
          >
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          {detail.loading ? (
            <div className="panel-loading">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : detail.error ? (
            <div className="banner" role="alert">
              <span>{detail.error.message}</span>
              <button
                type="button"
                className="btn ghost banner-action"
                onClick={() => detail.reload()}
              >
                Retry
              </button>
            </div>
          ) : transaction ? (
            <>
              <div>
                <div
                  className={`panel-amount ${
                    transaction.kind === 'TRANSFER'
                      ? 'amount-neutral'
                      : transaction.amountMinor > 0
                        ? 'amount-pos'
                        : 'amount-neg'
                  }`}
                >
                  {formatMoney(
                    transaction.amountMinor,
                    transaction.currency,
                    transaction.fractionDigits,
                    true,
                  )}
                </div>
                <div className="panel-date">
                  {formatDate(transaction.date, {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {transaction.time ? ` · ${transaction.time}` : ''}
                </div>
              </div>

              {transaction.kind === 'TRANSFER' ? (
                <div className="callout">
                  Linked to transaction #{transaction.transferPeerId}. Both sides move together.
                </div>
              ) : null}

              <div className="detail-grid">
                {transaction.valueDate !== transaction.date ? (
                  <Field label="Value date">
                    {formatDate(transaction.valueDate, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Field>
                ) : null}
                <Field label="Account">
                  {transaction.accountId === account.id ? account.label : `#${transaction.accountId}`}
                </Field>
                <Field label="Payee">{transaction.payee?.label || '—'}</Field>
                <Field label="Category">{transaction.category?.path || '—'}</Field>
                <Field label="Method">{transaction.method?.label || '—'}</Field>
                <Field label="Reference">{transaction.referenceNumber || '—'}</Field>
                <Field label="Status">{statusLabel(transaction.crStatus)}</Field>
                <Field label="Tags">
                  {transaction.tags.length > 0
                    ? transaction.tags.map((tag) => (
                        <span className="tag" key={tag.id}>
                          #{tag.label}
                        </span>
                      ))
                    : '—'}
                </Field>
                {transaction.comment ? (
                  <Field label="Note">{transaction.comment}</Field>
                ) : null}
              </div>

              {transaction.kind === 'SPLIT' && transaction.splitParts ? (
                <div>
                  <h3 className="section-title">Parts</h3>
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Payee</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaction.splitParts.map((part) => (
                        <tr key={part.id}>
                          <td>
                            <div>{part.category?.path || '—'}</div>
                            {part.comment ? <div className="sub">{part.comment}</div> : null}
                          </td>
                          <td>{part.payee?.label || '—'}</td>
                          <td className="num">
                            {formatMoney(
                              part.amountMinor,
                              transaction.currency,
                              transaction.fractionDigits,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="parts-total">
                    <span>Total</span>
                    <b>
                      {formatMoney(
                        transaction.amountMinor,
                        transaction.currency,
                        transaction.fractionDigits,
                      )}
                    </b>
                  </div>
                </div>
              ) : null}

              <p className="hint">Editing will be enabled in the next slice.</p>
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}
