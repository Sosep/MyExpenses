import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '../types'
import { deleteTransaction, describeError, getTransaction } from '../api'
import { formatDate, formatMoney, kindLabel, statusLabel } from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { IconX } from './Icons'

interface PanelProps {
  id: number
  account: Account
  onClose: () => void
  onEdit: (id: number) => void
  onDeleted: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  )
}

export function TransactionPanel({
  id,
  account,
  onClose,
  onEdit,
  onDeleted,
}: PanelProps) {
  const detail = useAsync(() => getTransaction(id), ['transaction', id])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmingDelete) {
        setConfirmingDelete(false)
      } else {
        onClose()
      }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [confirmingDelete, onClose])

  const transaction = detail.data

  async function remove() {
    if (!transaction) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTransaction(transaction.id)
      onDeleted()
    } catch (cause) {
      setDeleteError(describeError(cause, t`Could not delete the transaction.`))
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-label={t`Transaction details`}>
        <div className="panel-head">
          <div>
            <div className="panel-kicker">
              {transaction ? kindLabel(transaction.kind) : t`Transaction`}
            </div>
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
          {detail.loading ? (
            <div className="panel-loading">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : detail.error ? (
            <div className="banner" role="alert">
              <span>{describeError(detail.error, t`Could not load the transaction.`)}</span>
              <button
                type="button"
                className="btn ghost banner-action"
                onClick={() => detail.reload()}
              >
                {t`Retry`}
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
                  <Field label={t`Value date`}>
                    {formatDate(transaction.valueDate, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Field>
                ) : null}
                <Field label={t`Account`}>
                  {transaction.accountId === account.id ? account.label : `#${transaction.accountId}`}
                </Field>
                <Field label={t`Payee`}>{transaction.payee?.label || '—'}</Field>
                <Field label={t`Category`}>{transaction.category?.path || '—'}</Field>
                <Field label={t`Method`}>{transaction.method?.label || '—'}</Field>
                <Field label={t`Reference`}>{transaction.referenceNumber || '—'}</Field>
                <Field label={t`Status`}>{statusLabel(transaction.crStatus)}</Field>
                <Field label={t`Tags`}>
                  {transaction.tags.length > 0
                    ? transaction.tags.map((tag) => (
                        <span className="tag" key={tag.id}>
                          #{tag.label}
                        </span>
                      ))
                    : '—'}
                </Field>
                {transaction.comment ? (
                  <Field label={t`Note`}>{transaction.comment}</Field>
                ) : null}
              </div>

              {transaction.kind === 'SPLIT' && transaction.splitParts ? (
                <div>
                  <h3 className="section-title">{t`Parts`}</h3>
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th>{t`Category`}</th>
                        <th>{t`Payee`}</th>
                        <th className="num">{t`Amount`}</th>
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
                    <span>{t`Total`}</span>
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

            </>
          ) : null}
        </div>
        {transaction && !detail.loading && !detail.error ? (
          <div className="panel-footer">
            {deleteError ? <p className="error-text">{deleteError}</p> : null}
            {confirmingDelete ? (
              <div className="confirm-box">
                <p>
                  {t`Delete this transaction?`}{' '}
                  {transaction.kind === 'SPLIT'
                    ? t`Its parts are deleted too.`
                    : transaction.kind === 'TRANSFER'
                      ? t`The linked side is deleted too.`
                      : t`This cannot be undone.`}
                </p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                  >
                    {t`Cancel`}
                  </button>
                  <button
                    type="button"
                    className="btn destructive"
                    onClick={() => void remove()}
                    disabled={deleting}
                  >
                    {deleting ? t`Deleting…` : t`Delete`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel-actions">
                <button type="button" className="btn ghost" onClick={() => onEdit(transaction.id)}>
                  {t`Edit`}
                </button>
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  {t`Delete`}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </aside>
    </>
  )
}
