import { useEffect, useMemo, useState } from 'react'
import type { Account, Budget, BudgetProgress, BudgetWrite } from '../types'
import { ApiError, createBudget, deleteBudget, updateBudget } from '../api'
import { amountInputValue, currencySymbol, parseAmountMinor, todayIso } from '../format'
import { IconX } from './Icons'

interface BudgetEditorProps {
  mode: 'create' | 'edit'
  budget?: Budget
  progress?: BudgetProgress
  accounts: Account[]
  defaultAccountId: number
  onClose: () => void
  onSaved: (message: string) => void
}

interface BudgetState {
  title: string
  description: string
  accountId: number
  grouping: string
  start: string
  end: string
  amount: string
  isDefault: boolean
}

const GROUPINGS = [
  { value: 'MONTH', label: 'Monthly' },
  { value: 'WEEK', label: 'Weekly' },
  { value: 'YEAR', label: 'Yearly' },
  { value: 'DAY', label: 'Daily' },
  { value: 'NONE', label: 'One-time period' },
]

function initialState(
  budget: Budget | undefined,
  progress: BudgetProgress | undefined,
  accounts: Account[],
  defaultAccountId: number,
): BudgetState {
  if (budget) {
    return {
      title: budget.title,
      description: budget.description ?? '',
      accountId: budget.accountId,
      grouping: budget.grouping,
      start: budget.start ?? '',
      end: budget.end ?? '',
      amount:
        budget.allocationMinor !== null
          ? amountInputValue(budget.allocationMinor, budget.fractionDigits)
          : progress
            ? amountInputValue(progress.allocatedMinor, progress.fractionDigits)
            : '',
      isDefault: budget.isDefault,
    }
  }
  const account =
    accounts.find((candidate) => candidate.id === defaultAccountId) ?? accounts[0]
  return {
    title: '',
    description: '',
    accountId: account?.id ?? defaultAccountId,
    grouping: 'MONTH',
    start: '',
    end: '',
    amount: '',
    isDefault: false,
  }
}

export function BudgetEditor({
  mode,
  budget,
  progress,
  accounts,
  defaultAccountId,
  onClose,
  onSaved,
}: BudgetEditorProps) {
  const [initial] = useState(() =>
    initialState(budget, progress, accounts, defaultAccountId),
  )
  const [state, setState] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const account =
    accounts.find((candidate) => candidate.id === state.accountId) ?? accounts[0]
  const fractionDigits = account?.fractionDigits ?? 2
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  )

  function update<K extends keyof BudgetState>(key: K, value: BudgetState[K]) {
    setState((previous) => ({ ...previous, [key]: value }))
  }

  function requestClose() {
    if (dirty && !window.confirm('Discard changes?')) return
    onClose()
  }

  async function save() {
    const nextErrors: Record<string, string> = {}
    const amount = parseAmountMinor(state.amount, fractionDigits)
    if (!state.title.trim()) nextErrors.title = 'Required.'
    if (amount === null) nextErrors.amount = 'Enter an amount.'
    if (state.grouping === 'NONE') {
      if (!state.start) nextErrors.start = 'Required.'
      if (!state.end) nextErrors.end = 'Required.'
      if (state.start && state.end && state.end < state.start) {
        nextErrors.end = 'Must be on or after the start.'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || amount === null) return

    const payload: BudgetWrite = {
      accountId: state.accountId,
      title: state.title.trim(),
      description: state.description.trim() || null,
      grouping: state.grouping,
      start: state.grouping === 'NONE' ? state.start : null,
      end: state.grouping === 'NONE' ? state.end : null,
      isDefault: state.grouping === 'NONE' ? false : state.isDefault,
      amountMinor: amount,
    }
    setSaving(true)
    setSubmitError(null)
    try {
      if (mode === 'create') {
        await createBudget(payload)
      } else if (budget) {
        await updateBudget(budget.id, payload)
      }
      onSaved(mode === 'create' ? 'Budget created.' : 'Budget saved.')
    } catch (cause) {
      if (cause instanceof ApiError) {
        setSubmitError(cause.message)
        if (cause.fields) setErrors(cause.fields)
      } else {
        setSubmitError(cause instanceof Error ? cause.message : 'Could not save the budget.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!budget) return
    if (!window.confirm(`Delete the budget “${budget.title}”?`)) return
    setSaving(true)
    setSubmitError(null)
    try {
      await deleteBudget(budget.id)
      onSaved('Budget deleted.')
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Could not delete the budget.')
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
        aria-label={mode === 'create' ? 'New budget' : 'Edit budget'}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{mode === 'create' ? 'New' : 'Edit'}</div>
            <h2>{mode === 'create' ? 'Budget' : 'Edit budget'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={requestClose} aria-label="Close editor">
            <IconX />
          </button>
        </div>
        <div className="panel-body editor-body">
          {submitError ? (
            <div className="banner" role="alert">
              <span>{submitError}</span>
            </div>
          ) : null}

          <label className="field">
            <span className="field-label">Title</span>
            <input
              className={`input ${errors.title ? 'invalid' : ''}`}
              aria-label="Budget title"
              value={state.title}
              onChange={(event) => update('title', event.target.value)}
              autoFocus={mode === 'create'}
            />
            {errors.title ? <span className="field-error">{errors.title}</span> : null}
          </label>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Account</span>
              <select
                className="input"
                aria-label="Budget account"
                value={state.accountId}
                disabled={mode === 'edit'}
                onChange={(event) => update('accountId', Number(event.target.value))}
              >
                {accounts.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Period</span>
              <select
                className="input"
                aria-label="Budget period"
                value={state.grouping}
                disabled={mode === 'edit'}
                onChange={(event) => update('grouping', event.target.value)}
              >
                {GROUPINGS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === 'edit' ? (
            <p className="card-note">
              Account and period type are fixed after creation. Category allocations and
              rollover are edited in the Android app.
            </p>
          ) : null}

          <label className="field">
            <span className="field-label">
              {mode === 'edit' ? 'Default amount' : 'Amount'}
            </span>
            <div className="amount-field">
              <input
                className={`input amount-input ${errors.amount ? 'invalid' : ''}`}
                aria-label="Budget amount"
                inputMode="decimal"
                value={state.amount}
                onChange={(event) =>
                  update('amount', event.target.value.replace(/[^\d.,]/g, ''))
                }
                placeholder="0.00"
              />
              <span className="amount-currency">
                {currencySymbol(account?.currency ?? 'EUR')}
              </span>
            </div>
            {errors.amount ? <span className="field-error">{errors.amount}</span> : null}
          </label>

          {state.grouping === 'NONE' ? (
            <div className="form-row">
              <label className="field">
                <span className="field-label">Start</span>
                <input
                  className={`input ${errors.start ? 'invalid' : ''}`}
                  aria-label="Budget start"
                  type="date"
                  value={state.start}
                  onChange={(event) => update('start', event.target.value)}
                />
                {errors.start ? <span className="field-error">{errors.start}</span> : null}
              </label>
              <label className="field">
                <span className="field-label">End</span>
                <input
                  className={`input ${errors.end ? 'invalid' : ''}`}
                  aria-label="Budget end"
                  type="date"
                  value={state.end}
                  min={state.start || todayIso()}
                  onChange={(event) => update('end', event.target.value)}
                />
                {errors.end ? <span className="field-error">{errors.end}</span> : null}
              </label>
            </div>
          ) : (
            <label className="check-row">
              <input
                type="checkbox"
                aria-label="Default budget"
                checked={state.isDefault}
                onChange={(event) => update('isDefault', event.target.checked)}
              />
              <span>Use as default budget for this account and period</span>
            </label>
          )}

          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              className="input textarea"
              aria-label="Budget note"
              value={state.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
        </div>
        <div className="editor-actions">
          {mode === 'edit' ? (
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => void remove()}
              disabled={saving}
            >
              Delete
            </button>
          ) : null}
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
