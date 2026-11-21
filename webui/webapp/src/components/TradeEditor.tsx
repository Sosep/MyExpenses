import { useEffect, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, Meta, TradeType } from '../types'
import {
  createTrade,
  deleteTransaction,
  describeError,
  getTrade,
  updateTrade,
} from '../api'
import { amountInputValue, formatMoney, parseAmountMinor } from '../format'
import { useAsync } from '../hooks'
import {
  fundingAfterTypeChange,
  fundingForTrade,
  isCash,
  isTransfer,
  peerKind,
  transferPeerPointsAtSource,
} from '../tradeUi'
import type { Funding } from '../tradeUi'
import { isTopPanel, useFocusTrap } from '../useFocusTrap'
import { SearchSelect } from './SearchSelect'
import { IconX } from './Icons'

interface TradeEditorProps {
  mode: 'create' | 'edit'
  id?: number
  account: Account
  accounts: Account[]
  meta: Meta
  onClose: () => void
  onSaved: () => void
}

const TYPES: { type: TradeType; label: () => string }[] = [
  { type: 'BUY', label: () => t`Buy` },
  { type: 'SELL', label: () => t`Sell` },
  { type: 'DEPOSIT', label: () => t`Deposit` },
  { type: 'WITHDRAW', label: () => t`Withdraw` },
  { type: 'TRANSFER_OUT', label: () => t`Transfer out` },
  { type: 'TRANSFER_IN', label: () => t`Transfer in` },
]

/** Today in the phone's time zone, as the API expects `YYYY-MM-DD`. */
function today(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Creates and edits a portfolio operation. The payload mirrors the app's
 * `TradeIntent`: the server derives the split legs and the principal; the
 * editor only shows what the user can verify against the phone.
 */
export function TradeEditor({
  mode,
  id,
  account,
  accounts,
  meta,
  onClose,
  onSaved,
}: TradeEditorProps) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const existing = useAsync(
    () => (mode === 'edit' && id ? getTrade(account.id, id) : Promise.resolve(null)),
    ['trade-edit', account.id, id ?? 0],
  )
  const [type, setType] = useState<TradeType>('BUY')
  const [assetSymbol, setAssetSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('')
  const [funding, setFunding] = useState<Funding>('PORTFOLIO')
  const [peerAccountId, setPeerAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const fundingTouched = useRef(false)

  useEffect(() => {
    if (!existing.data || loaded) return
    const trade = existing.data
    setType(trade.type)
    setAssetSymbol(trade.assetSymbol)
    setQuantity(amountInputValue(trade.quantityMinor, trade.fractionDigits))
    setPrice(trade.price ?? '')
    setFee(
      trade.feeMinor === null
        ? ''
        : amountInputValue(trade.feeMinor, account.fractionDigits),
    )
    setDate(trade.date)
    setTime(trade.time ?? '')
    setComment(trade.comment)
    setPeerAccountId(trade.peerAccountId === null ? '' : String(trade.peerAccountId))
    setLoaded(true)
  }, [existing.data, loaded, account.fractionDigits])

  useEffect(() => {
    if (mode !== 'edit' || !existing.data || fundingTouched.current) return
    const trade = existing.data
    // The read model reports the counterpart, not the source: no counterpart
    // means external funding; a sub-account (not in the top-level list) means
    // the cash sub-account; a top-level account means it was funded from an
    // account.
    setFunding(fundingForTrade(trade, accounts))
  }, [existing.data, accounts, mode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTopPanel(panelRef.current)) onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const cash = isCash(type)
  const transfer = isTransfer(type)
  const transferPeerLabel = transferPeerPointsAtSource(type)
    ? t`Source portfolio`
    : t`Target portfolio`
  // Like the app's editor, an existing operation keeps its kind: a transfer
  // stays a transfer and a buy/sell stays an asset trade.
  const typeKind = peerKind(existing.data?.type ?? type)
  const applicableTypes =
    mode === 'create'
      ? TYPES
      : TYPES.filter((entry) => peerKind(entry.type) === typeKind)
  const portfolioAccounts = accounts.filter(
    (candidate) => candidate.portfolioRole === 'CONTAINER' && candidate.id !== account.id,
  )
  const peerAccounts = accounts.filter((candidate) => candidate.portfolioRole === 'NONE')
  const assetOptions = ['AAPL', 'BTC', 'ETH', 'MSFT', 'VWCE', 'GOLD']
  const quantityValue = Number(quantity.replace(',', '.'))
  const priceValue = Number(price.replace(',', '.'))
  const principalMinor =
    Number.isFinite(quantityValue) && Number.isFinite(priceValue) && quantityValue > 0
      ? Math.round(
          quantityValue * (cash ? 1 : priceValue) * Math.pow(10, account.fractionDigits),
        )
      : 0

  function selectType(next: TradeType) {
    // The previous counterpart belongs to another kind of operation (a bank
    // account for a buy, a portfolio for a transfer): keep it only when the
    // picker is the same one.
    if (peerKind(next) !== peerKind(type)) setPeerAccountId('')
    setType(next)
    // A type switch while editing only stays inside the family; the stored
    // funding source must not change behind the user's back.
    setFunding((current) => fundingAfterTypeChange(mode, current, next))
    if (isCash(next)) setAssetSymbol(account.currency)
  }

  async function save() {
    const nextErrors: Record<string, string> = {}
    if (!assetSymbol.trim() && !cash) nextErrors.assetSymbol = t`Required.`
    const qty = Number(quantity.replace(',', '.'))
    if (!quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
      nextErrors.quantity = t`Enter a quantity above zero.`
    }
    if (!cash) {
      const value = Number(price.replace(',', '.'))
      if (!price.trim() || !Number.isFinite(value) || value <= 0) {
        nextErrors.price = t`Enter a price above zero.`
      }
    }
    if (transfer && !peerAccountId) nextErrors.peerAccountId = t`Required.`
    if ((funding === 'ACCOUNT' || transfer) && !peerAccountId) {
      nextErrors.peerAccountId = t`Required.`
    }
    const feeMinor = fee.trim() === '' ? 0 : parseAmountMinor(fee, account.fractionDigits)
    if (feeMinor === null) nextErrors.fee = t`Enter an amount.`
    if (meta.preferences.timeEnabled && time && !/^\d{2}:\d{2}$/.test(time)) {
      nextErrors.time = t`Use HH:mm.`
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || feeMinor === null) return

    setSaving(true)
    setSubmitError(null)
    try {
      const payload = {
        type,
        assetSymbol: cash ? account.currency : assetSymbol.trim().toUpperCase(),
        quantity: quantity.replace(',', '.'),
        price: cash ? '1' : price.replace(',', '.'),
        // The fee field is hidden for deposits and withdrawals; a value typed
        // before switching must not travel behind the user's back.
        feeMinor: cash ? 0 : feeMinor,
        fundingSource: transfer ? undefined : funding,
        peerAccountId: peerAccountId ? Number(peerAccountId) : null,
        comment,
        date,
        time: time || null,
      }
      if (mode === 'edit' && id) await updateTrade(account.id, id, payload)
      else await createTrade(account.id, payload)
      onSaved()
    } catch (cause) {
      const error = cause as { fields?: Record<string, string> }
      if (error.fields) setErrors(error.fields)
      setSubmitError(describeError(cause, t`Could not save the operation.`))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setDeleting(true)
    setSubmitError(null)
    try {
      await deleteTransaction(id)
      onSaved()
    } catch (cause) {
      setSubmitError(describeError(cause, t`Could not delete the operation.`))
      setDeleting(false)
    }
  }

  const detailError = existing.error

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        ref={panelRef}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'edit' ? t`Edit operation` : t`New operation`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">
              {mode === 'edit' ? t`Edit` : t`New`}
            </div>
            <h2>{mode === 'edit' ? t`Edit operation` : t`New operation`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close editor`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">
          {detailError ? (
            <div className="banner" role="alert">
              <span>{describeError(detailError, t`Could not load the operation.`)}</span>
            </div>
          ) : null}
          <div className="segmented wrap" role="group" aria-label={t`Operation type`}>
            {applicableTypes.map((entry) => (
              <button
                key={entry.type}
                type="button"
                className={type === entry.type ? 'active' : ''}
                aria-pressed={type === entry.type}
                onClick={() => selectType(entry.type)}
              >
                {entry.label()}
              </button>
            ))}
          </div>
          {!cash ? (
            <label className="field">
              <span className="field-label">{t`Asset`}</span>
              <input
                className={`input ${errors.assetSymbol ? 'invalid' : ''}`}
                aria-label={t`Asset symbol`}
                list="trade-asset-symbols"
                placeholder="AAPL"
                value={assetSymbol}
                onChange={(event) => setAssetSymbol(event.target.value.toUpperCase())}
              />
              <datalist id="trade-asset-symbols">
                {assetOptions.map((symbol) => (
                  <option key={symbol} value={symbol} />
                ))}
              </datalist>
              {errors.assetSymbol ? <span className="field-error">{errors.assetSymbol}</span> : null}
            </label>
          ) : null}
          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Quantity`}</span>
              <input
                className={`input ${errors.quantity ? 'invalid' : ''}`}
                aria-label={t`Quantity`}
                inputMode="decimal"
                placeholder="0"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              {errors.quantity ? <span className="field-error">{errors.quantity}</span> : null}
            </label>
            {!cash ? (
              <label className="field">
                <span className="field-label">{t`Price`}</span>
                <input
                  className={`input ${errors.price ? 'invalid' : ''}`}
                  aria-label={t`Price`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, ''))}
                />
                {errors.price ? <span className="field-error">{errors.price}</span> : null}
              </label>
            ) : null}
          </div>
          <div className="summary-strip" role="group" aria-label={t`Amount`}>
            <span>{t`Amount`}</span>
            <b>
              {formatMoney(principalMinor, account.currency, account.fractionDigits)}
            </b>
          </div>
          {!cash ? (
            <label className="field">
              <span className="field-label">{t`Fee`}</span>
              <input
                className={`input ${errors.fee ? 'invalid' : ''}`}
                aria-label={t`Fee`}
                inputMode="decimal"
                placeholder="0.00"
                value={fee}
                onChange={(event) => setFee(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              {errors.fee ? <span className="field-error">{errors.fee}</span> : null}
            </label>
          ) : null}
          {transfer ? (
            <label className="field">
              <span className="field-label">{transferPeerLabel}</span>
              <SearchSelect
                ariaLabel={transferPeerLabel}
                value={peerAccountId}
                options={portfolioAccounts.map((candidate) => ({
                  value: String(candidate.id),
                  label: candidate.label,
                }))}
                onChange={setPeerAccountId}
              />
              {errors.peerAccountId ? (
                <span className="field-error">{errors.peerAccountId}</span>
              ) : null}
            </label>
          ) : cash ? (
            <label className="field">
              <span className="field-label">{t`Source`}</span>
              <select
                className="input"
                aria-label={t`Source`}
                value={funding}
                onChange={(event) => setFunding(event.target.value as Funding)}
              >
                <option value="ACCOUNT">{t`An account`}</option>
                <option value="EXTERNAL">{t`Not tracked`}</option>
              </select>
            </label>
          ) : (
            <label className="field">
              <span className="field-label">{t`Funding`}</span>
              <select
                className="input"
                aria-label={t`Funding`}
                value={funding}
                onChange={(event) => {
                  fundingTouched.current = true
                  setFunding(event.target.value as Funding)
                }}
              >
                <option value="PORTFOLIO">{t`Portfolio cash`}</option>
                <option value="ACCOUNT">{t`An account`}</option>
                <option value="EXTERNAL">{t`Not tracked`}</option>
              </select>
            </label>
          )}
          {!transfer && funding === 'ACCOUNT' ? (
            <label className="field">
              <span className="field-label">{t`Account`}</span>
              <SearchSelect
                ariaLabel={t`Account`}
                value={peerAccountId}
                options={peerAccounts.map((candidate) => ({
                  value: String(candidate.id),
                  label: candidate.label,
                }))}
                onChange={setPeerAccountId}
              />
              {errors.peerAccountId ? (
                <span className="field-error">{errors.peerAccountId}</span>
              ) : null}
            </label>
          ) : null}
          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Date`}</span>
              <input
                type="date"
                className="input"
                aria-label={t`Date`}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              {errors.date ? <span className="field-error">{errors.date}</span> : null}
            </label>
            {meta.preferences.timeEnabled ? (
              <label className="field">
                <span className="field-label">{t`Time`}</span>
                <input
                  type="time"
                  className={`input ${errors.time ? 'invalid' : ''}`}
                  aria-label={t`Time`}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
                {errors.time ? <span className="field-error">{errors.time}</span> : null}
              </label>
            ) : null}
          </div>
          <label className="field">
            <span className="field-label">{t`Note`}</span>
            <input
              className="input"
              aria-label={t`Note`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {submitError ? <p className="error-text">{submitError}</p> : null}
        </div>
        <div className="panel-footer">
          <div className="panel-actions">
            {mode === 'edit' ? (
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => void remove()}
                disabled={deleting || saving}
              >
                {deleting ? t`Deleting…` : t`Delete`}
              </button>
            ) : null}
            <button type="button" className="btn ghost" onClick={onClose}>
              {t`Cancel`}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? t`Saving…` : t`Save`}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
