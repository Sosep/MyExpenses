import { useEffect, useMemo, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { ReactNode } from 'react'
import type {
  Account,
  Category,
  Method,
  Meta,
  Payee,
  SplitPart,
  SplitWrite,
  Tag,
  Transaction,
  TransactionWrite,
  TransferWrite,
} from '../types'
import {
  ApiError,
  createSplit,
  createTransaction,
  createTransfer,
  getCategories,
  getMethods,
  getPayees,
  getTags,
  getTransaction,
  updateSplit,
  updateTransaction,
  updateTransfer,
} from '../api'
import {
  amountInputValue,
  categoryPathMap,
  currencySymbol,
  formatMoney,
  nowTime,
  parseAmountMinor,
  parseSignedAmountMinor,
  signedAmountInput,
  todayIso,
} from '../format'
import { useAsync } from '../hooks'
import { SearchSelect } from './SearchSelect'
import { IconX } from './Icons'

type DateMode = 'date' | 'dateTime' | 'bookingValue'
type Sign = 1 | -1
type Kind = 'SIMPLE' | 'TRANSFER' | 'SPLIT'

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
            aria-label={t`Close editor`}
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
  const [createKind, setCreateKind] = useState<Kind | null>(null)
  const references = useAsync(async () => {
    const [categories, payees, tags, methods] = await Promise.all([
      getCategories(),
      getPayees(),
      getTags(),
      getMethods(),
    ])
    return { categories, payees, tags, methods }
  }, ['references'])

  const detail = useAsync(
    () => (mode === 'edit' && id ? getTransaction(id) : Promise.resolve(null)),
    ['transaction-editor', mode, id],
  )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  if (mode === 'create' && createKind === null) {
    return (
      <EditorFrame kicker={t`New`} title={t`What do you want to add?`} onClose={onClose}>
        <div className="kind-choices">
          <button type="button" className="kind-choice" data-kind="SIMPLE" onClick={() => setCreateKind('SIMPLE')}>
            <strong>{t`Transaction`}</strong>
            <span>{t`A single income or expense.`}</span>
          </button>
          <button type="button" className="kind-choice" data-kind="TRANSFER" onClick={() => setCreateKind('TRANSFER')}>
            <strong>{t`Transfer`}</strong>
            <span>{t`Move money between two accounts.`}</span>
          </button>
          <button type="button" className="kind-choice" data-kind="SPLIT" onClick={() => setCreateKind('SPLIT')}>
            <strong>{t`Split transaction`}</strong>
            <span>{t`Divide one amount into categorized parts.`}</span>
          </button>
        </div>
      </EditorFrame>
    )
  }

  const error = references.error ?? detail.error
  if (error) {
    return (
      <EditorFrame
        kicker={mode === 'create' ? t`New` : t`Edit`}
        title={mode === 'create' ? t`Transaction` : t`Edit transaction`}
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
            {t`Retry`}
          </button>
        </div>
      </EditorFrame>
    )
  }

  if (references.loading || detail.loading || !references.data) {
    return (
      <EditorFrame
        kicker={mode === 'create' ? t`New` : t`Edit`}
        title={mode === 'create' ? t`Transaction` : t`Edit transaction`}
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
      <EditorFrame kicker={t`Edit`} title={t`Edit transaction`} onClose={onClose}>
        <div className="banner" role="alert">
          <span>{t`The transaction could not be loaded.`}</span>
        </div>
      </EditorFrame>
    )
  }

  const transaction = detail.data ?? null
  const kind = mode === 'edit' ? transaction?.kind : createKind
  const common = {
    mode,
    id,
    accounts,
    meta,
    refs: references.data,
    onClose,
    onSaved,
  }
  if (kind === 'TRANSFER') {
    return (
      <TransferForm
        {...common}
        initial={transferInitialState(transaction, accounts, defaultAccountId)}
      />
    )
  }
  if (kind === 'SPLIT') {
    return (
      <SplitForm
        {...common}
        initial={splitInitialState(transaction, accounts, defaultAccountId)}
      />
    )
  }
  return (
    <TransactionForm
      {...common}
      initial={initialFormState(transaction, accounts, defaultAccountId)}
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
    if (dirty && !window.confirm(t`Discard changes?`)) return
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
    if (parsed === null) nextErrors.amount = t`Enter an amount greater than zero.`
    if (!state.date) nextErrors.date = t`Required.`
    if (dateMode === 'dateTime' && !state.time) nextErrors.time = t`Required.`
    if (dateMode === 'bookingValue' && !state.valueDate) nextErrors.valueDate = t`Required.`
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
        setSubmitError(cause instanceof Error ? cause.message : t`Could not save the transaction.`)
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
        aria-label={mode === 'create' ? t`New transaction` : t`Edit transaction`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{mode === 'create' ? t`New` : t`Edit`}</div>
            <h2>{mode === 'create' ? t`Transaction` : t`Edit transaction`}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            aria-label={t`Close editor`}
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
            <div className="segmented sign-toggle" role="group" aria-label={t`Type`}>
              <button
                type="button"
                className={state.sign === -1 ? 'active' : ''}
                aria-pressed={state.sign === -1}
                onClick={() => setSign(-1)}
              >
                {t`Expense`}
              </button>
              <button
                type="button"
                className={state.sign === 1 ? 'active' : ''}
                aria-pressed={state.sign === 1}
                onClick={() => setSign(1)}
              >
                {t`Income`}
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
                aria-label={t`Amount`}
                autoFocus
              />
              <span className="amount-currency">{currencySymbol(account?.currency ?? 'EUR')}</span>
            </div>
          </div>
          {errors.amount ? <p className="field-error">{errors.amount}</p> : null}

          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Account`}</span>
              <SearchSelect
                ariaLabel={t`Account`}
                value={String(state.accountId)}
                options={accounts.map((candidate) => ({
                  value: String(candidate.id),
                  label: candidate.label,
                }))}
                onChange={(value) => setAccount(Number(value))}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Date`}</span>
              <input
                className={`input ${errors.date ? 'invalid' : ''}`}
                aria-label={t`Date`}
                type="date"
                value={state.date}
                onChange={(event) => update('date', event.target.value)}
              />
              {errors.date ? <span className="field-error">{errors.date}</span> : null}
            </label>
          </div>

          {dateMode === 'dateTime' ? (
            <label className="field">
              <span className="field-label">{t`Time`}</span>
              <input
                className={`input ${errors.time ? 'invalid' : ''}`}
                aria-label={t`Time`}
                type="time"
                value={state.time}
                onChange={(event) => update('time', event.target.value)}
              />
              {errors.time ? <span className="field-error">{errors.time}</span> : null}
            </label>
          ) : null}

          {dateMode === 'bookingValue' ? (
            <label className="field">
              <span className="field-label">{t`Value date`}</span>
              <input
                className={`input ${errors.valueDate ? 'invalid' : ''}`}
                aria-label={t`Value date`}
                type="date"
                value={state.valueDate}
                onChange={(event) => update('valueDate', event.target.value)}
              />
              {errors.valueDate ? <span className="field-error">{errors.valueDate}</span> : null}
            </label>
          ) : null}

          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Payee`}</span>
              <SearchSelect
                ariaLabel={t`Payee`}
                value={state.payeeId === null ? '' : String(state.payeeId)}
                options={[
                  { value: '', label: t`None` },
                  ...refs.payees.map((payee) => ({
                    value: String(payee.id),
                    label: payee.name,
                  })),
                ]}
                onChange={(value) => update('payeeId', value ? Number(value) : null)}
              />
            </label>
            {methods.length > 0 ? (
              <label className="field">
                <span className="field-label">{t`Method`}</span>
                <SearchSelect
                  ariaLabel={t`Method`}
                  value={state.methodId === null ? '' : String(state.methodId)}
                  options={[
                    { value: '', label: t`None` },
                    ...methods.map((method) => ({
                      value: String(method.id),
                      label: method.label,
                    })),
                  ]}
                  onChange={(value) => update('methodId', value ? Number(value) : null)}
                />
              </label>
            ) : null}
          </div>

          <label className="field">
            <span className="field-label">{t`Category`}</span>
            <SearchSelect
              ariaLabel={t`Category`}
              value={state.categoryId === null ? '' : String(state.categoryId)}
              options={[
                { value: '', label: t`No category` },
                ...categories.map((category) => ({
                  value: String(category.id),
                  label: paths.get(category.id) ?? category.label,
                })),
              ]}
              onChange={(value) => update('categoryId', value ? Number(value) : null)}
            />
          </label>

          {refs.tags.length > 0 ? (
            <div className="field">
              <span className="field-label">{t`Tags`}</span>
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
            <span className="field-label">{t`Reference`}</span>
            <input
              className="input"
              aria-label={t`Reference`}
              value={state.referenceNumber}
              onChange={(event) => update('referenceNumber', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">{t`Note`}</span>
            <textarea
              className="input textarea"
              aria-label={t`Note`}
              value={state.comment}
              onChange={(event) => update('comment', event.target.value)}
            />
          </label>
        </div>
        <div className="editor-actions">
          <button type="button" className="btn ghost" onClick={requestClose}>
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
      </aside>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Transfer                                                            */
/* ------------------------------------------------------------------ */

interface TransferState {
  fromAccountId: number
  toAccountId: number
  amount: string
  date: string
  time: string
  valueDate: string
  payeeId: number | null
  methodId: number | null
  comment: string
  referenceNumber: string
}

interface TransferFormProps extends Omit<FormProps, 'initial'> {
  initial: TransferState
}

function transferInitialState(
  transaction: Transaction | null,
  accounts: Account[],
  defaultAccountId: number,
): TransferState {
  if (transaction) {
    const from =
      transaction.amountMinor < 0
        ? transaction.accountId
        : transaction.transferAccountId ?? transaction.accountId
    const to =
      transaction.amountMinor < 0
        ? transaction.transferAccountId ?? transaction.accountId
        : transaction.accountId
    return {
      fromAccountId: from,
      toAccountId: to,
      amount: amountInputValue(Math.abs(transaction.amountMinor), transaction.fractionDigits),
      date: transaction.date,
      time: transaction.time ?? nowTime(),
      valueDate: transaction.valueDate,
      payeeId: transaction.payee?.id ?? null,
      methodId: transaction.method?.id ?? null,
      comment: transaction.comment,
      referenceNumber: transaction.referenceNumber ?? '',
    }
  }
  const from = accounts.find((candidate) => candidate.id === defaultAccountId) ?? accounts[0]
  const to = accounts.find((candidate) => candidate.id !== from?.id) ?? from
  const today = todayIso()
  return {
    fromAccountId: from?.id ?? defaultAccountId,
    toAccountId: to?.id ?? defaultAccountId,
    amount: '',
    date: today,
    time: nowTime(),
    valueDate: today,
    payeeId: null,
    methodId: null,
    comment: '',
    referenceNumber: '',
  }
}

function TransferForm({
  mode,
  id,
  accounts,
  meta,
  refs,
  initial,
  onClose,
  onSaved,
}: TransferFormProps) {
  const [state, setState] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fromAccount = accounts.find((candidate) => candidate.id === state.fromAccountId) ?? accounts[0]
  const fractionDigits = fromAccount?.fractionDigits ?? 2
  const dateMode = dateModeFor(fromAccount, meta)
  const methods = refs.methods.filter(
    (method) => fromAccount && method.accountTypes.includes(fromAccount.type),
  )
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  )

  function update<K extends keyof TransferState>(key: K, value: TransferState[K]) {
    setState((previous) => ({ ...previous, [key]: value }))
  }

  function requestClose() {
    if (dirty && !window.confirm(t`Discard changes?`)) return
    onClose()
  }

  function setFromAccount(accountId: number) {
    update('fromAccountId', accountId)
    const next = accounts.find((candidate) => candidate.id === accountId)
    if (state.methodId !== null) {
      const method = refs.methods.find((candidate) => candidate.id === state.methodId)
      if (!method || !next || !method.accountTypes.includes(next.type)) update('methodId', null)
    }
  }

  async function save() {
    const parsed = parseAmountMinor(state.amount, fractionDigits)
    const nextErrors: Record<string, string> = {}
    if (parsed === null) nextErrors.amount = t`Enter an amount greater than zero.`
    if (state.fromAccountId === state.toAccountId) {
      nextErrors.toAccountId = t`Choose two different accounts.`
    }
    if (!state.date) nextErrors.date = t`Required.`
    if (dateMode === 'dateTime' && !state.time) nextErrors.time = t`Required.`
    if (dateMode === 'bookingValue' && !state.valueDate) nextErrors.valueDate = t`Required.`
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || parsed === null) return

    const payload: TransferWrite = {
      fromAccountId: state.fromAccountId,
      toAccountId: state.toAccountId,
      amountMinor: parsed,
      date: state.date,
      time: dateMode === 'dateTime' ? state.time : null,
      valueDate: dateMode === 'bookingValue' ? state.valueDate : null,
      payeeId: state.payeeId,
      comment: state.comment,
      methodId: state.methodId,
      referenceNumber: state.referenceNumber.trim() || null,
    }
    setSaving(true)
    setSubmitError(null)
    try {
      if (mode === 'create') {
        await createTransfer(payload)
      } else if (id !== undefined) {
        await updateTransfer(id, payload)
      }
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSubmitError(cause.message)
        if (cause.fields) setErrors(cause.fields)
      } else {
        setSubmitError(cause instanceof Error ? cause.message : t`Could not save the transfer.`)
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
    <FormPanel
      kicker={mode === 'create' ? t`New` : t`Edit`}
      title={mode === 'create' ? t`Transfer` : t`Edit transfer`}
      onClose={requestClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={requestClose}>
            {t`Cancel`}
          </button>
          <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      {submitError ? (
        <div className="banner" role="alert">
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="amount-row">
        <div className="amount-field">
          <input
            className={`input amount-input ${errors.amount ? 'invalid' : ''}`}
            inputMode="decimal"
            value={state.amount}
            onChange={(event) => update('amount', event.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0.00"
            aria-label={t`Amount`}
            autoFocus
          />
          <span className="amount-currency">{currencySymbol(fromAccount?.currency ?? 'EUR')}</span>
        </div>
      </div>
      {errors.amount ? <p className="field-error">{errors.amount}</p> : null}

      <div className="form-row">
        <label className="field">
          <span className="field-label">{t`From`}</span>
          <SearchSelect
            ariaLabel={t`From account`}
            value={String(state.fromAccountId)}
            options={accounts.map((account) => ({
              value: String(account.id),
              label: account.label,
            }))}
            onChange={(value) => setFromAccount(Number(value))}
          />
        </label>
        <label className="field">
          <span className="field-label">{t`To`}</span>
          <div className={errors.toAccountId ? 'search-select-invalid' : ''}>
            <SearchSelect
              ariaLabel={t`To account`}
              value={String(state.toAccountId)}
              options={accounts.map((account) => ({
                value: String(account.id),
                label: account.label,
              }))}
              onChange={(value) => update('toAccountId', Number(value))}
            />
          </div>
          {errors.toAccountId ? <span className="field-error">{errors.toAccountId}</span> : null}
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">{t`Date`}</span>
          <input
            className={`input ${errors.date ? 'invalid' : ''}`}
            aria-label={t`Date`}
            type="date"
            value={state.date}
            onChange={(event) => update('date', event.target.value)}
          />
          {errors.date ? <span className="field-error">{errors.date}</span> : null}
        </label>
        {dateMode === 'bookingValue' ? (
          <label className="field">
            <span className="field-label">{t`Value date`}</span>
            <input
              className={`input ${errors.valueDate ? 'invalid' : ''}`}
              aria-label={t`Value date`}
              type="date"
              value={state.valueDate}
              onChange={(event) => update('valueDate', event.target.value)}
            />
            {errors.valueDate ? <span className="field-error">{errors.valueDate}</span> : null}
          </label>
        ) : dateMode === 'dateTime' ? (
          <label className="field">
            <span className="field-label">{t`Time`}</span>
            <input
              className={`input ${errors.time ? 'invalid' : ''}`}
              aria-label={t`Time`}
              type="time"
              value={state.time}
              onChange={(event) => update('time', event.target.value)}
            />
            {errors.time ? <span className="field-error">{errors.time}</span> : null}
          </label>
        ) : null}
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">{t`Payee`}</span>
          <SearchSelect
            ariaLabel={t`Payee`}
            value={state.payeeId === null ? '' : String(state.payeeId)}
            options={[
              { value: '', label: t`None` },
              ...refs.payees.map((payee) => ({
                value: String(payee.id),
                label: payee.name,
              })),
            ]}
            onChange={(value) => update('payeeId', value ? Number(value) : null)}
          />
        </label>
        {methods.length > 0 ? (
          <label className="field">
            <span className="field-label">{t`Method`}</span>
            <SearchSelect
              ariaLabel={t`Method`}
              value={state.methodId === null ? '' : String(state.methodId)}
              options={[
                { value: '', label: t`None` },
                ...methods.map((method) => ({
                  value: String(method.id),
                  label: method.label,
                })),
              ]}
              onChange={(value) => update('methodId', value ? Number(value) : null)}
            />
          </label>
        ) : null}
      </div>

      <label className="field">
        <span className="field-label">{t`Reference`}</span>
        <input
          className="input"
          aria-label={t`Reference`}
          value={state.referenceNumber}
          onChange={(event) => update('referenceNumber', event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">{t`Note`}</span>
        <textarea
          className="input textarea"
          aria-label={t`Note`}
          value={state.comment}
          onChange={(event) => update('comment', event.target.value)}
        />
      </label>
    </FormPanel>
  )
}

/* ------------------------------------------------------------------ */
/* Split                                                               */
/* ------------------------------------------------------------------ */

interface SplitPartState {
  key: string
  id: number | null
  amount: string
  categoryId: number | null
  payeeId: number | null
  tagIds: number[]
  comment: string
  methodId: number | null
  referenceNumber: string
}

interface SplitState {
  accountId: number
  amount: string
  date: string
  time: string
  valueDate: string
  payeeId: number | null
  methodId: number | null
  tagIds: number[]
  comment: string
  referenceNumber: string
  parts: SplitPartState[]
}

interface SplitFormProps extends Omit<FormProps, 'initial'> {
  initial: SplitState
}

let splitPartCounter = 0

function newSplitPartKey(): string {
  splitPartCounter += 1
  return `new-${splitPartCounter}`
}

function emptySplitPart(): SplitPartState {
  return {
    key: newSplitPartKey(),
    id: null,
    amount: '',
    categoryId: null,
    payeeId: null,
    tagIds: [],
    comment: '',
    methodId: null,
    referenceNumber: '',
  }
}

function splitPartState(part: SplitPart, fractionDigits: number): SplitPartState {
  return {
    key: `part-${part.id}`,
    id: part.id,
    amount: signedAmountInput(part.amountMinor, fractionDigits),
    categoryId: part.category?.id ?? null,
    payeeId: part.payee?.id ?? null,
    tagIds: part.tags.map((tag) => tag.id),
    comment: part.comment,
    methodId: part.method?.id ?? null,
    referenceNumber: part.referenceNumber ?? '',
  }
}

function splitInitialState(
  transaction: Transaction | null,
  accounts: Account[],
  defaultAccountId: number,
): SplitState {
  if (transaction) {
    return {
      accountId: transaction.accountId,
      amount: signedAmountInput(transaction.amountMinor, transaction.fractionDigits),
      date: transaction.date,
      time: transaction.time ?? nowTime(),
      valueDate: transaction.valueDate,
      payeeId: transaction.payee?.id ?? null,
      methodId: transaction.method?.id ?? null,
      tagIds: transaction.tags.map((tag) => tag.id),
      comment: transaction.comment,
      referenceNumber: transaction.referenceNumber ?? '',
      parts: (transaction.splitParts ?? []).map((part) =>
        splitPartState(part, transaction.fractionDigits),
      ),
    }
  }
  const account = accounts.find((candidate) => candidate.id === defaultAccountId) ?? accounts[0]
  const today = todayIso()
  return {
    accountId: account?.id ?? defaultAccountId,
    amount: '',
    date: today,
    time: nowTime(),
    valueDate: today,
    payeeId: null,
    methodId: null,
    tagIds: [],
    comment: '',
    referenceNumber: '',
    parts: [emptySplitPart()],
  }
}

function SplitForm({
  mode,
  id,
  accounts,
  meta,
  refs,
  initial,
  onClose,
  onSaved,
}: SplitFormProps) {
  const [state, setState] = useState(initial)
  const [selectedKey, setSelectedKey] = useState(initial.parts[0]?.key ?? '')
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
    (method) => account && method.accountTypes.includes(account.type),
  )
  const selected = state.parts.find((part) => part.key === selectedKey) ?? state.parts[0]
  const selectedIndex = state.parts.findIndex((part) => part.key === selected.key)
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  )

  function update<K extends keyof SplitState>(key: K, value: SplitState[K]) {
    setState((previous) => ({ ...previous, [key]: value }))
  }

  function updatePart<K extends keyof SplitPartState>(key: K, value: SplitPartState[K]) {
    setState((previous) => ({
      ...previous,
      parts: previous.parts.map((part) =>
        part.key === selected.key ? { ...part, [key]: value } : part,
      ),
    }))
  }

  function addPart() {
    const part = emptySplitPart()
    setState((previous) => ({ ...previous, parts: [...previous.parts, part] }))
    setSelectedKey(part.key)
  }

  function removePart() {
    if (state.parts.length <= 1) return
    const remaining = state.parts.filter((part) => part.key !== selected.key)
    setState((previous) => ({ ...previous, parts: remaining }))
    setSelectedKey(remaining[0]?.key ?? '')
  }

  function requestClose() {
    if (dirty && !window.confirm(t`Discard changes?`)) return
    onClose()
  }

  function setAccount(accountId: number) {
    update('accountId', accountId)
    const next = accounts.find((candidate) => candidate.id === accountId)
    if (state.methodId !== null) {
      const method = refs.methods.find((candidate) => candidate.id === state.methodId)
      if (!method || !next || !method.accountTypes.includes(next.type)) update('methodId', null)
    }
  }

  const parentMinor = parseSignedAmountMinor(state.amount, fractionDigits)
  const partValues = state.parts.map((part) =>
    parseSignedAmountMinor(part.amount, fractionDigits),
  )
  const partsSum: number = partValues.reduce<number>(
    (total, value) => total + (value ?? 0),
    0,
  )
  const remaining = parentMinor === null ? null : parentMinor - partsSum
  const balanced =
    parentMinor !== null && partValues.every((value) => value !== null) && remaining === 0

  async function save() {
    const nextErrors: Record<string, string> = {}
    if (parentMinor === null) nextErrors.amount = t`Enter the total amount.`
    if (partValues.some((value) => value === null)) {
      nextErrors.parts = t`Enter a valid amount for every part.`
    } else if (parentMinor !== null && remaining !== 0) {
      nextErrors.parts = t`The parts must add up to the total.`
    }
    if (!state.date) nextErrors.date = t`Required.`
    if (dateMode === 'dateTime' && !state.time) nextErrors.time = t`Required.`
    if (dateMode === 'bookingValue' && !state.valueDate) nextErrors.valueDate = t`Required.`
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || parentMinor === null) return

    const payload: SplitWrite = {
      accountId: state.accountId,
      amountMinor: parentMinor,
      date: state.date,
      time: dateMode === 'dateTime' ? state.time : null,
      valueDate: dateMode === 'bookingValue' ? state.valueDate : null,
      payeeId: state.payeeId,
      comment: state.comment,
      methodId: state.methodId,
      referenceNumber: state.referenceNumber.trim() || null,
      tagIds: state.tagIds,
      parts: state.parts.map((part, index) => ({
        id: part.id && part.id > 0 ? part.id : undefined,
        amountMinor: partValues[index] ?? 0,
        categoryId: part.categoryId,
        payeeId: part.payeeId,
        tagIds: part.tagIds,
        comment: part.comment,
        methodId: part.methodId,
        referenceNumber: part.referenceNumber.trim() || null,
      })),
    }
    setSaving(true)
    setSubmitError(null)
    try {
      if (mode === 'create') {
        await createSplit(payload)
      } else if (id !== undefined) {
        await updateSplit(id, payload)
      }
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSubmitError(cause.message)
        if (cause.fields) setErrors(cause.fields)
      } else {
        setSubmitError(cause instanceof Error ? cause.message : t`Could not save the split.`)
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
    <FormPanel
      kicker={mode === 'create' ? t`New` : t`Edit`}
      title={mode === 'create' ? t`Split transaction` : t`Edit split transaction`}
      onClose={requestClose}
      wide
      footer={
        <>
          <span className={`split-balance ${balanced ? 'balanced' : 'unbalanced'}`}>
            {balanced
              ? t`Balanced`
              : remaining === null
                ? t`Enter the total`
                : t`${formatMoney(remaining, account?.currency ?? 'EUR', fractionDigits, true)} left`}
          </span>
          <button type="button" className="btn ghost" onClick={requestClose}>
            {t`Cancel`}
          </button>
          <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      {submitError ? (
        <div className="banner" role="alert">
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="split-grid">
        <div className="split-left">
          <section className="split-section">
            <h3>{t`Transaction`}</h3>
            <div className="form-row">
              <label className="field">
                <span className="field-label">{t`Account`}</span>
                <SearchSelect
                  ariaLabel={t`Account`}
                  value={String(state.accountId)}
                  disabled={mode === 'edit'}
                  options={accounts.map((candidate) => ({
                    value: String(candidate.id),
                    label: candidate.label,
                  }))}
                  onChange={(value) => setAccount(Number(value))}
                />
              </label>
              <label className="field">
                <span className="field-label">{t`Date`}</span>
                <input
                  className={`input ${errors.date ? 'invalid' : ''}`}
                  aria-label={t`Date`}
                  type="date"
                  value={state.date}
                  onChange={(event) => update('date', event.target.value)}
                />
                {errors.date ? <span className="field-error">{errors.date}</span> : null}
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span className="field-label">{t`Total (signed)`}</span>
                <input
                  className={`input ${errors.amount ? 'invalid' : ''}`}
                  aria-label={t`Total amount`}
                  inputMode="decimal"
                  value={state.amount}
                  onChange={(event) =>
                    update('amount', event.target.value.replace(/[^\d.,-]/g, ''))
                  }
                  placeholder="-0.00"
                />
                {errors.amount ? <span className="field-error">{errors.amount}</span> : null}
              </label>
              {dateMode === 'bookingValue' ? (
                <label className="field">
                  <span className="field-label">{t`Value date`}</span>
                  <input
                    className={`input ${errors.valueDate ? 'invalid' : ''}`}
                    aria-label={t`Value date`}
                    type="date"
                    value={state.valueDate}
                    onChange={(event) => update('valueDate', event.target.value)}
                  />
                </label>
              ) : dateMode === 'dateTime' ? (
                <label className="field">
                  <span className="field-label">{t`Time`}</span>
                  <input
                    className={`input ${errors.time ? 'invalid' : ''}`}
                    aria-label={t`Time`}
                    type="time"
                    value={state.time}
                    onChange={(event) => update('time', event.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="form-row">
              <label className="field">
                <span className="field-label">{t`Payee`}</span>
                <SearchSelect
                  ariaLabel={t`Payee`}
                  value={state.payeeId === null ? '' : String(state.payeeId)}
                  options={[
                    { value: '', label: t`None` },
                    ...refs.payees.map((payee) => ({
                      value: String(payee.id),
                      label: payee.name,
                    })),
                  ]}
                  onChange={(value) => update('payeeId', value ? Number(value) : null)}
                />
              </label>
              {methods.length > 0 ? (
                <label className="field">
                  <span className="field-label">{t`Method`}</span>
                  <SearchSelect
                    ariaLabel={t`Method`}
                    value={state.methodId === null ? '' : String(state.methodId)}
                    options={[
                      { value: '', label: t`None` },
                      ...methods.map((method) => ({
                        value: String(method.id),
                        label: method.label,
                      })),
                    ]}
                    onChange={(value) => update('methodId', value ? Number(value) : null)}
                  />
                </label>
              ) : null}
            </div>

            {refs.tags.length > 0 ? (
              <div className="field">
                <span className="field-label">{t`Tags`}</span>
                <div className="tag-picker">
                  {refs.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag.id}
                      className={`tag-toggle ${state.tagIds.includes(tag.id) ? 'active' : ''}`}
                      aria-pressed={state.tagIds.includes(tag.id)}
                      onClick={() =>
                        update(
                          'tagIds',
                          state.tagIds.includes(tag.id)
                            ? state.tagIds.filter((id) => id !== tag.id)
                            : [...state.tagIds, tag.id],
                        )
                      }
                    >
                      #{tag.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="field">
              <span className="field-label">{t`Note`}</span>
              <textarea
                className="input textarea"
                aria-label={t`Note`}
                value={state.comment}
                onChange={(event) => update('comment', event.target.value)}
              />
            </label>
          </section>

          <section className="split-section">
            <div className="split-header">
              <h3>{t`Parts`}</h3>
              {errors.parts ? <span className="field-error">{errors.parts}</span> : null}
            </div>
            <div className="part-list">
              {state.parts.map((part) => (
                <button
                  type="button"
                  key={part.key}
                  className={`part-row ${part.key === selected.key ? 'active' : ''}`}
                  onClick={() => setSelectedKey(part.key)}
                >
                  <span className="part-cat">
                    {part.categoryId ? paths.get(part.categoryId) : t`No category`}
                  </span>
                  <span className="part-payee">
                    {part.payeeId
                      ? refs.payees.find((payee) => payee.id === part.payeeId)?.name
                      : '—'}
                  </span>
                  <span className="part-amt">{part.amount || '0.00'}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn ghost add-part" onClick={addPart}>
              {t`+ Add part`}
            </button>
          </section>
        </div>

        <aside className="split-right">
          <section className="split-section">
            <h3>{t`Part ${selectedIndex + 1}`}</h3>
            <label className="field">
              <span className="field-label">{t`Amount (signed)`}</span>
              <input
                className="input"
                aria-label={t`Part amount`}
                inputMode="decimal"
                value={selected.amount}
                onChange={(event) =>
                  updatePart('amount', event.target.value.replace(/[^\d.,-]/g, ''))
                }
                placeholder="-0.00"
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Category`}</span>
              <SearchSelect
                ariaLabel={t`Part category`}
                value={selected.categoryId === null ? '' : String(selected.categoryId)}
                options={[
                  { value: '', label: t`No category` },
                  ...categories.map((category) => ({
                    value: String(category.id),
                    label: paths.get(category.id) ?? category.label,
                  })),
                ]}
                onChange={(value) => updatePart('categoryId', value ? Number(value) : null)}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Payee`}</span>
              <SearchSelect
                ariaLabel={t`Part payee`}
                value={selected.payeeId === null ? '' : String(selected.payeeId)}
                options={[
                  { value: '', label: t`None` },
                  ...refs.payees.map((payee) => ({
                    value: String(payee.id),
                    label: payee.name,
                  })),
                ]}
                onChange={(value) => updatePart('payeeId', value ? Number(value) : null)}
              />
            </label>
            {methods.length > 0 ? (
              <label className="field">
                <span className="field-label">{t`Method`}</span>
                <SearchSelect
                  ariaLabel={t`Part method`}
                  value={selected.methodId === null ? '' : String(selected.methodId)}
                  options={[
                    { value: '', label: t`None` },
                    ...methods.map((method) => ({
                      value: String(method.id),
                      label: method.label,
                    })),
                  ]}
                  onChange={(value) => updatePart('methodId', value ? Number(value) : null)}
                />
              </label>
            ) : null}
            {refs.tags.length > 0 ? (
              <div className="field">
                <span className="field-label">{t`Tags`}</span>
                <div className="tag-picker">
                  {refs.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag.id}
                      className={`tag-toggle ${selected.tagIds.includes(tag.id) ? 'active' : ''}`}
                      aria-pressed={selected.tagIds.includes(tag.id)}
                      onClick={() =>
                        updatePart(
                          'tagIds',
                          selected.tagIds.includes(tag.id)
                            ? selected.tagIds.filter((id) => id !== tag.id)
                            : [...selected.tagIds, tag.id],
                        )
                      }
                    >
                      #{tag.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="field">
              <span className="field-label">{t`Note`}</span>
              <textarea
                className="input textarea"
                aria-label={t`Part note`}
                value={selected.comment}
                onChange={(event) => updatePart('comment', event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Reference`}</span>
              <input
                className="input"
                aria-label={t`Part reference`}
                value={selected.referenceNumber}
                onChange={(event) => updatePart('referenceNumber', event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn ghost danger remove-part"
              onClick={removePart}
              disabled={state.parts.length <= 1}
            >
              {t`Remove part`}
            </button>
          </section>
        </aside>
      </div>
    </FormPanel>
  )
}

function FormPanel({
  kicker,
  title,
  onClose,
  footer,
  children,
  wide = false,
}: {
  kicker: string
  title: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        className={`panel editor-panel ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close editor`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body editor-body">{children}</div>
        <div className="editor-actions">{footer}</div>
      </aside>
    </>
  )
}
