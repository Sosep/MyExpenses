import { useEffect, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, AccountTypeEntry } from '../types'
import {
  createAccount,
  createPortfolio,
  describeError,
  getAccountTypes,
} from '../api'
import { useAsync } from '../hooks'
import { parseAmountMinor } from '../format'
import { useFocusTrap } from '../useFocusTrap'
import { IconX } from './Icons'

interface AccountEditorProps {
  /** Currencies already in use, plus the home one. */
  currencies: string[]
  defaultCurrency: string
  /** The app's home currency: the exchange rate only applies to others. */
  homeCurrency: string
  onClose: () => void
  onSaved: (account: Account, kind: 'account' | 'portfolio') => void
}

/** Which kind the `+` opens; a QA switch (`?kind=portfolio`) can preset it. */
function initialKind(): 'account' | 'portfolio' {
  return new URLSearchParams(window.location.search).get('kind') === 'portfolio'
    ? 'portfolio'
    : 'account'
}

/**
 * Creates an account or a portfolio from the web so a test environment (and
 * transfers, which need two accounts) can be built without the phone.
 * Sub-accounts are rejected by the API, so the form does not offer them. A
 * portfolio has no opening balance: its cash enters with a deposit, like the
 * app's `PortfolioSetupDialog`.
 */
export function AccountEditor({
  currencies,
  defaultCurrency,
  homeCurrency,
  onClose,
  onSaved,
}: AccountEditorProps) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const types = useAsync(() => getAccountTypes(), ['account-types'])
  const [kind, setKind] = useState<'account' | 'portfolio'>(initialKind)
  const [label, setLabel] = useState('')
  const [type, setType] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [opening, setOpening] = useState('')
  const [excludeFromTotals, setExclude] = useState(false)
  const [dynamic, setDynamic] = useState(false)
  const [exchangeRate, setExchangeRate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isPortfolio = kind === 'portfolio'
  const isForeign = currency !== homeCurrency

  useEffect(() => {
    if (type || !types.data || types.data.length === 0) return
    const wanted = isPortfolio ? 'INVESTMENT' : 'BANK'
    const match = types.data.find((entry) => entry.name === wanted) ?? types.data[0]
    setType(String(match.id))
  }, [types.data, type, isPortfolio])

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
    let openingMinor: number | null = 0
    if (!isPortfolio) {
      // An empty field means "start at zero"; the API takes non-negative minor units.
      openingMinor = opening.trim() === '' ? 0 : parseAmountMinor(opening, 2)
      if (openingMinor === null) nextErrors.opening = t`Enter an amount.`
    }
    let rate: number | null = null
    if (isPortfolio && isForeign && !dynamic) {
      if (exchangeRate.trim() === '') {
        nextErrors.exchangeRate = t`Required.`
      } else {
        rate = Number(exchangeRate.replace(',', '.'))
        if (!Number.isFinite(rate) || rate <= 0) nextErrors.exchangeRate = t`Enter a rate above zero.`
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || openingMinor === null) return

    setSaving(true)
    setSubmitError(null)
    try {
      const account = isPortfolio
        ? await createPortfolio({
            label: label.trim(),
            type,
            currency,
            dynamicExchangeRates: dynamic,
            ...(rate !== null ? { exchangeRate: rate } : {}),
          })
        : await createAccount({
            label: label.trim(),
            type,
            currency,
            openingBalanceMinor: openingMinor,
            excludeFromTotals,
          })
      onSaved(account, kind)
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
        aria-label={isPortfolio ? t`New portfolio` : t`New account`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{t`New`}</div>
            <h2>{isPortfolio ? t`New portfolio` : t`New account`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close editor`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          <div className="segmented" role="group" aria-label={t`What to create`}>
            <button
              type="button"
              className={kind === 'account' ? 'active' : ''}
              data-kind="account"
              aria-pressed={kind === 'account'}
              onClick={() => setKind('account')}
            >
              {t`Account`}
            </button>
            <button
              type="button"
              className={kind === 'portfolio' ? 'active' : ''}
              data-kind="portfolio"
              aria-pressed={kind === 'portfolio'}
              onClick={() => setKind('portfolio')}
            >
              {t`Portfolio`}
            </button>
          </div>
          <label className="field">
            <span className="field-label">{t`Name`}</span>
            <input
              className={`input ${errors.label ? 'invalid' : ''}`}
              aria-label={isPortfolio ? t`Portfolio name` : t`Account name`}
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
          {isPortfolio && isForeign ? (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  aria-label={t`Dynamic exchange rates`}
                  checked={dynamic}
                  onChange={(event) => setDynamic(event.target.checked)}
                />
                <span>{t`Dynamic exchange rates`}</span>
              </label>
              <label className="field">
                <span className="field-label">{t`Exchange rate`}</span>
                <input
                  className={`input ${errors.exchangeRate ? 'invalid' : ''}`}
                  aria-label={t`Exchange rate`}
                  inputMode="decimal"
                  placeholder="1.00"
                  value={exchangeRate}
                  disabled={dynamic}
                  onChange={(event) => setExchangeRate(event.target.value.replace(/[^\d.,]/g, ''))}
                />
                <span className="field-hint">
                  {t`Price of one ${currency} in ${homeCurrency}.`}
                </span>
                {errors.exchangeRate ? (
                  <span className="field-error">{errors.exchangeRate}</span>
                ) : null}
              </label>
            </>
          ) : null}
          {isPortfolio ? (
            <p className="field-hint">
              {t`A portfolio starts at zero: bring cash in with a deposit.`}
            </p>
          ) : (
            <>
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
            </>
          )}
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
