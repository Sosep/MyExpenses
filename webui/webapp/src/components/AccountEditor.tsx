import { useEffect, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, AccountTypeEntry } from '../types'
import { createAccount, describeError, getAccountTypes } from '../api'
import { useAsync } from '../hooks'
import { parseAmountMinor } from '../format'
import { useFocusTrap } from '../useFocusTrap'
import { IconX } from './Icons'

interface AccountEditorProps {
  /** Currencies already in use, plus the home one. */
  currencies: string[]
  defaultCurrency: string
  onClose: () => void
  onSaved: (account: Account) => void
}

/**
 * Creates an account from the web so a test environment (and transfers, which
 * need two accounts) can be built without the phone. Sub-accounts are rejected
 * by the API, so the form does not offer them.
 */
export function AccountEditor({
  currencies,
  defaultCurrency,
  onClose,
  onSaved,
}: AccountEditorProps) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const types = useAsync(() => getAccountTypes(), ['account-types'])
  const [label, setLabel] = useState('')
  const [type, setType] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [opening, setOpening] = useState('')
  const [excludeFromTotals, setExclude] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!type && types.data && types.data.length > 0) {
      const bank = types.data.find((entry) => entry.name === 'BANK') ?? types.data[0]
      setType(String(bank.id))
    }
  }, [types.data, type])

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

  async function save() {
    const nextErrors: Record<string, string> = {}
    if (!label.trim()) nextErrors.label = t`Required.`
    if (!type) nextErrors.type = t`Required.`
    // An empty field means "start at zero"; the API takes non-negative minor units.
    const openingMinor = opening.trim() === '' ? 0 : parseAmountMinor(opening, 2)
    if (openingMinor === null) nextErrors.opening = t`Enter an amount.`
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || openingMinor === null) return

    setSaving(true)
    setSubmitError(null)
    try {
      const account = await createAccount({
        label: label.trim(),
        type,
        currency,
        openingBalanceMinor: openingMinor,
        excludeFromTotals,
      })
      onSaved(account)
    } catch (cause) {
      const error = cause as { fields?: Record<string, string> }
      if (error.fields) setErrors(error.fields)
      setSubmitError(describeError(cause, t`Could not create the account.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        ref={panelRef}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t`New account`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{t`New`}</div>
            <h2>{t`New account`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close editor`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          <label className="field">
            <span className="field-label">{t`Name`}</span>
            <input
              className={`input ${errors.label ? 'invalid' : ''}`}
              aria-label={t`Account name`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            {errors.label ? <span className="field-error">{errors.label}</span> : null}
          </label>
          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Type`}</span>
              <select
                className="input"
                aria-label={t`Account type`}
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {(types.data ?? []).map((entry: AccountTypeEntry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t`Currency`}</span>
              <select
                className="input"
                aria-label={t`Account currency`}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-label">{t`Opening balance`}</span>
            <input
              className={`input ${errors.opening ? 'invalid' : ''}`}
              aria-label={t`Opening balance`}
              inputMode="decimal"
              placeholder="0.00"
              value={opening}
              onChange={(event) => setOpening(event.target.value.replace(/[^\d.,]/g, ''))}
            />
            {errors.opening ? <span className="field-error">{errors.opening}</span> : null}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label={t`Exclude from totals`}
              checked={excludeFromTotals}
              onChange={(event) => setExclude(event.target.checked)}
            />
            <span>{t`Exclude from totals`}</span>
          </label>
          {submitError ? <p className="error-text">{submitError}</p> : null}
        </div>
        <div className="panel-footer">
          <div className="panel-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              {t`Cancel`}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? t`Saving…` : t`Create`}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
