import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Account,
  Category,
  Method,
  Meta,
  Payee,
  Tag,
  Transaction,
  TransactionWrite,
} from '../types'
import {
  ApiError,
  createTransaction,
  getCategories,
  getMethods,
  getPayees,
  getTags,
  getTransaction,
  updateTransaction,
} from '../api'
import {
  amountInputValue,
  categoryPathMap,
  currencySymbol,
  nowTime,
  parseAmountMinor,
  todayIso,
} from '../format'
import { useAsync } from '../hooks'
import { IconX } from './Icons'

type DateMode = 'date' | 'dateTime' | 'bookingValue'
type Sign = 1 | -1

interface ReferenceData {
  categories: Category[]
  payees: Payee[]
  tags: Tag[]
  methods: Method[]
}

interface FormState {
  accountId: number
  amount: string
  sign: Sign
  date: string
  time: string
  valueDate: string
  payeeId: number | null
  categoryId: number | null
  tagIds: number[]
  comment: string
  methodId: number | null
  referenceNumber: string
}

interface EditorProps {
  mode: 'create' | 'edit'
  id?: number
  accounts: Account[]
  defaultAccountId: number
  meta: Meta
  onClose: () => void
  onSaved: () => void
}

interface FormProps {
  mode: 'create' | 'edit'
  id?: number
  accounts: Account[]
  meta: Meta
  refs: ReferenceData
  initial: FormState
  onClose: () => void
  onSaved: () => void
}

function initialFormState(
  transaction: Transaction | null,
  accounts: Account[],
  defaultAccountId: number,
): FormState {
  if (transaction) {
    return {
      accountId: transaction.accountId,
      amount: amountInputValue(transaction.amountMinor, transaction.fractionDigits),
      sign: transaction.amountMinor >= 0 ? 1 : -1,
      date: transaction.date,
      time: transaction.time ?? nowTime(),
      valueDate: transaction.valueDate,
      payeeId: transaction.payee?.id ?? null,
      categoryId: transaction.category?.id ?? null,
      tagIds: transaction.tags.map((tag) => tag.id),
      comment: transaction.comment,
      methodId: transaction.method?.id ?? null,
      referenceNumber: transaction.referenceNumber ?? '',
    }
  }
  const account = accounts.find((candidate) => candidate.id === defaultAccountId) ?? accounts[0]
  const today = todayIso()
  return {
    accountId: account?.id ?? defaultAccountId,
    amount: '',
    sign: -1,
    date: today,
    time: nowTime(),
    valueDate: today,
    payeeId: null,
    categoryId: null,
    tagIds: [],
    comment: '',
    methodId: null,
    referenceNumber: '',
  }
}

function dateModeFor(account: Account | undefined, meta: Meta): DateMode {
  const isCash = account?.type === 'CASH'
  if (meta.preferences.valueDateEnabled && !isCash) return 'bookingValue'
  return meta.preferences.timeEnabled ? 'dateTime' : 'date'
}

function EditorFrame({
  kicker,
  title,
  onClose,
  children,
}: {
  kicker: string
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel editor-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close editor"
          >
            <IconX />
          </button>
        </div>
        <div className="panel-body editor-body">{children}</div>
      </aside>
    </>
  )
}

export function TransactionEditor({
  mode,
  id,
  accounts,
  defaultAccountId,
  meta,
  onClose,
  onSaved,
}: EditorProps) {
  const references = useAsync(async () => {
    const [categories, payees, tags, methods] = await Promise.all([
      getCategories(),
      getPayees(),
      getTags(),
      getMethods(),
    ])
    return { categories, payees, tags, methods }
  }, [])

  const detail = useAsync(
    () => (mode === 'edit' && id ? getTransaction(id) : Promise.resolve(null)),
    [mode, id],
  )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const error = references.error ?? detail.error
  if (error) {
    return (
      <EditorFrame
        kicker={mode === 'create' ? 'New' : 'Edit'}
        title={mode === 'create' ? 'Transaction' : 'Edit transaction'}
        onClose={onClose}
      >
        <div className="banner" role="alert">
          <span>{error.message}</span>
          <button
            type="button"
            className="btn ghost banner-action"
            onClick={() => {
              references.reload()
              detail.reload()
            }}
          >
            Retry
          </button>
        </div>
      </EditorFrame>
    )
  }

  if (references.loading || detail.loading || !references.data) {
    return (
      <EditorFrame
        kicker={mode === 'create' ? 'New' : 'Edit'}
        title={mode === 'create' ? 'Transaction' : 'Edit transaction'}
        onClose={onClose}
      >
        <div className="panel-loading">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-input" />
          <div className="skeleton skeleton-input" />
          <div className="skeleton skeleton-input" />
          <div className="skeleton skeleton-row" />
        </div>
      </EditorFrame>
    )
  }

  if (mode === 'edit' && !detail.data) {
    return (
      <EditorFrame kicker="Edit" title="Edit transaction" onClose={onClose}>
        <div className="banner" role="alert">
          <span>The transaction could not be loaded.</span>
        </div>
      </EditorFrame>
    )
  }

  return (
    <TransactionForm
      mode={mode}
      id={id}
      accounts={accounts}
      meta={meta}
      refs={references.data}
      initial={initialFormState(detail.data ?? null, accounts, defaultAccountId)}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function TransactionForm({
  mode,
  id,
  accounts,
  meta,
  refs,
  initial,
  onClose,
  onSaved,
}: FormProps) {
  const [state, setState] = useState<FormState>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const account = accounts.find((candidate) => candidate.id === state.accountId) ?? accounts[0]
  const fractionDigits = account?.fractionDigits ?? 2
  const dateMode = dateModeFor(account, meta)
  const paths = useMemo(() => categoryPathMap(refs.categories), [refs.categories])
  const categories = useMemo(
    () =>
      [...refs.categories].sort((left, right) =>
        (paths.get(left.id) ?? left.label).localeCompare(paths.get(right.id) ?? right.label),
      ),
    [refs.categories, paths],
  )
  const methods = refs.methods.filter(
    (method) =>
      account &&
      method.accountTypes.includes(account.type) &&
      (method.type === 0 || method.type === state.sign),
  )
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((previous) => ({ ...previous, [key]: value }))
  }

  function requestClose() {
    if (dirty && !window.confirm('Discard changes?')) return
    onClose()
  }

  function setSign(sign: Sign) {
    update('sign', sign)
    if (state.methodId !== null) {
      const method = refs.methods.find((candidate) => candidate.id === state.methodId)
      const allowed =
        method &&
        account &&
        method.accountTypes.includes(account.type) &&
        (method.type === 0 || method.type === sign)
      if (!allowed) update('methodId', null)
    }
  }

  function setAccount(accountId: number) {
    update('accountId', accountId)
    if (state.methodId !== null) {
      const method = refs.methods.find((candidate) => candidate.id === state.methodId)
      const nextAccount = accounts.find((candidate) => candidate.id === accountId)
      const allowed =
        method &&
        nextAccount &&
        method.accountTypes.includes(nextAccount.type) &&
        (method.type === 0 || method.type === state.sign)
      if (!allowed) update('methodId', null)
    }
  }

  function toggleTag(tagId: number) {
    update(
      'tagIds',
      state.tagIds.includes(tagId)
        ? state.tagIds.filter((selected) => selected !== tagId)
        : [...state.tagIds, tagId],
    )
  }

  async function save() {
    const parsed = parseAmountMinor(state.amount, fractionDigits)
    const nextErrors: Record<string, string> = {}
    if (parsed === null) nextErrors.amount = 'Enter an amount greater than zero.'
    if (!state.date) nextErrors.date = 'Required.'
    if (dateMode === 'dateTime' && !state.time) nextErrors.time = 'Required.'
    if (dateMode === 'bookingValue' && !state.valueDate) nextErrors.valueDate = 'Required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || parsed === null) return

    const payload: TransactionWrite = {
      accountId: state.accountId,
      amountMinor: state.sign * parsed,
      date: state.date,
      time: dateMode === 'dateTime' ? state.time : null,
      valueDate: dateMode === 'bookingValue' ? state.valueDate : null,
      payeeId: state.payeeId,
      categoryId: state.categoryId,
      tagIds: state.tagIds,
      comment: state.comment,
      methodId: state.methodId,
      referenceNumber: state.referenceNumber.trim() || null,
    }

    setSaving(true)
    setSubmitError(null)
    try {
      if (mode === 'create') {
        await createTransaction(payload)
      } else if (id !== undefined) {
        await updateTransaction(id, payload)
      }
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSubmitError(cause.message)
        if (cause.fields) {
          const mapped: Record<string, string> = {}
          Object.entries(cause.fields).forEach(([key, message]) => {
            const field = key === 'amountMinor' ? 'amount' : key === 'tagIds' ? 'tags' : key
            mapped[field] = message
          })
          setErrors(mapped)
        }
      } else {
        setSubmitError(cause instanceof Error ? cause.message : 'Could not save the transaction.')
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <>
      <div className="overlay" onClick={requestClose} />
      <aside
        className="panel editor-panel"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'New transaction' : 'Edit transaction'}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{mode === 'create' ? 'New' : 'Edit'}</div>
            <h2>{mode === 'create' ? 'Transaction' : 'Edit transaction'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            aria-label="Close editor"
          >
            <IconX />
          </button>
        </div>
        <div className="panel-body editor-body">
          {submitError ? (
            <div className="banner" role="alert">
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="amount-row">
            <div className="segmented sign-toggle" role="group" aria-label="Type">
              <button
                type="button"
                className={state.sign === -1 ? 'active' : ''}
                aria-pressed={state.sign === -1}
                onClick={() => setSign(-1)}
              >
                Expense
              </button>
              <button
                type="button"
                className={state.sign === 1 ? 'active' : ''}
                aria-pressed={state.sign === 1}
                onClick={() => setSign(1)}
              >
                Income
              </button>
            </div>
            <div className="amount-field">
              <input
                className={`input amount-input ${errors.amount ? 'invalid' : ''}`}
                inputMode="decimal"
                value={state.amount}
                onChange={(event) =>
                  update('amount', event.target.value.replace(/[^\d.,]/g, ''))
                }
                placeholder="0.00"
                aria-label="Amount"
                autoFocus
              />
              <span className="amount-currency">{currencySymbol(account?.currency ?? 'EUR')}</span>
            </div>
          </div>
          {errors.amount ? <p className="field-error">{errors.amount}</p> : null}

          <div className="form-row">
            <label className="field">
              <span className="field-label">Account</span>
              <select
                className="input"
                aria-label="Account"
                value={state.accountId}
                onChange={(event) => setAccount(Number(event.target.value))}
              >
                {accounts.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Date</span>
              <input
                className={`input ${errors.date ? 'invalid' : ''}`}
                aria-label="Date"
                type="date"
                value={state.date}
                onChange={(event) => update('date', event.target.value)}
              />
              {errors.date ? <span className="field-error">{errors.date}</span> : null}
            </label>
          </div>

          {dateMode === 'dateTime' ? (
            <label className="field">
              <span className="field-label">Time</span>
              <input
                className={`input ${errors.time ? 'invalid' : ''}`}
                aria-label="Time"
                type="time"
                value={state.time}
                onChange={(event) => update('time', event.target.value)}
              />
              {errors.time ? <span className="field-error">{errors.time}</span> : null}
            </label>
          ) : null}

          {dateMode === 'bookingValue' ? (
            <label className="field">
              <span className="field-label">Value date</span>
              <input
                className={`input ${errors.valueDate ? 'invalid' : ''}`}
                aria-label="Value date"
                type="date"
                value={state.valueDate}
                onChange={(event) => update('valueDate', event.target.value)}
              />
              {errors.valueDate ? <span className="field-error">{errors.valueDate}</span> : null}
            </label>
          ) : null}

          <div className="form-row">
            <label className="field">
              <span className="field-label">Payee</span>
              <select
                className="input"
                aria-label="Payee"
                value={state.payeeId ?? ''}
                onChange={(event) =>
                  update('payeeId', event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">None</option>
                {refs.payees.map((payee) => (
                  <option key={payee.id} value={payee.id}>
                    {payee.name}
                  </option>
                ))}
              </select>
            </label>
            {methods.length > 0 ? (
              <label className="field">
                <span className="field-label">Method</span>
                <select
                  className="input"
                  aria-label="Method"
                  value={state.methodId ?? ''}
                  onChange={(event) =>
                    update('methodId', event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">None</option>
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <label className="field">
            <span className="field-label">Category</span>
            <select
              className="input"
              aria-label="Category"
              value={state.categoryId ?? ''}
              onChange={(event) =>
                update('categoryId', event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {paths.get(category.id) ?? category.label}
                </option>
              ))}
            </select>
          </label>

          {refs.tags.length > 0 ? (
            <div className="field">
              <span className="field-label">Tags</span>
              <div className="tag-picker">
                {refs.tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    className={`tag-toggle ${state.tagIds.includes(tag.id) ? 'active' : ''}`}
                    aria-pressed={state.tagIds.includes(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  >
                    #{tag.label}
                  </button>
                ))}
              </div>
              {errors.tags ? <span className="field-error">{errors.tags}</span> : null}
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">Reference</span>
            <input
              className="input"
              aria-label="Reference"
              value={state.referenceNumber}
              onChange={(event) => update('referenceNumber', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              className="input textarea"
              aria-label="Note"
              value={state.comment}
              onChange={(event) => update('comment', event.target.value)}
            />
          </label>
        </div>
        <div className="editor-actions">
          <button type="button" className="btn ghost" onClick={requestClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  )
}
