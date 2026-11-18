import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account, Budget, BudgetProgress, BudgetWrite } from '../types'
import {
  ApiError,
  createBudget,
  deleteBudget,
  describeError,
  duplicateBudget,
  getBudgetAllocations,
  updateBudget,
  updateBudgetAllocations,
} from '../api'
import { amountInputValue, currencySymbol, parseAmountMinor, todayIso } from '../format'
import { useFocusTrap } from '../useFocusTrap'
import { useAsync } from '../hooks'
import { SearchSelect } from './SearchSelect'
import { BudgetFilterFields, emptyCriteria } from './BudgetFilterFields'
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

const GROUPINGS = ['MONTH', 'WEEK', 'YEAR', 'DAY', 'NONE'] as const

function groupingLabel(grouping: string): string {
  switch (grouping) {
    case 'MONTH':
      return t`Monthly`
    case 'WEEK':
      return t`Weekly`
    case 'YEAR':
      return t`Yearly`
    case 'DAY':
      return t`Daily`
    default:
      return t`One-time period`
  }
}

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
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  const [initial] = useState(() =>
    initialState(budget, progress, accounts, defaultAccountId),
  )
  const [state, setState] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [allocationValues, setAllocationValues] = useState<Record<number, string>>({})
  const [rolloverValues, setRolloverValues] = useState<Record<number, boolean>>({})
  const [initialCriteria] = useState(() => budget?.criteria ?? emptyCriteria())
  const [criteria, setCriteria] = useState(initialCriteria)
  const [customPeriod, setCustomPeriod] = useState(progress?.periodAllocationMinor != null)
  const [periodAmount, setPeriodAmount] = useState(
    progress?.periodAllocationMinor != null && budget
      ? amountInputValue(progress.periodAllocationMinor, budget.fractionDigits)
      : '',
  )
  const [saving, setSaving] = useState(false)
  const account =
    accounts.find((candidate) => candidate.id === state.accountId) ?? accounts[0]
  const fractionDigits = account?.fractionDigits ?? 2
  const allocations = useAsync(
    () =>
      budget && progress && budget.grouping !== 'NONE' && progress.periodYear !== null
        ? getBudgetAllocations(budget.id, progress.periodYear, progress.periodSecond ?? undefined)
        : Promise.resolve([]),
    ['budget-allocations', budget?.id, progress?.periodYear, progress?.periodSecond],
  )
  const dirty = useMemo(
    () =>
      JSON.stringify(state) !== JSON.stringify(initial) ||
      Object.keys(allocationValues).length > 0,
    [state, initial, allocationValues],
  )

  useEffect(() => {
    if (!allocations.data || !budget) return
    setAllocationValues(
      Object.fromEntries(
        allocations.data.map((allocation) => [
          allocation.categoryId,
          amountInputValue(allocation.allocatedMinor, budget.fractionDigits),
        ]),
      ),
    )
    setRolloverValues(
      Object.fromEntries(
        allocations.data.map((allocation) => [
          allocation.categoryId,
          allocation.rolloverNextMinor > 0,
        ]),
      ),
    )
  }, [allocations.data, budget])

  function update<K extends keyof BudgetState>(key: K, value: BudgetState[K]) {
    setState((previous) => ({ ...previous, [key]: value }))
  }

  function requestClose() {
    if (dirty && !window.confirm(t`Discard changes?`)) return
    onClose()
  }

  async function save() {
    const nextErrors: Record<string, string> = {}
    const amount = parseAmountMinor(state.amount, fractionDigits)
    if (!state.title.trim()) nextErrors.title = t`Required.`
    if (amount === null) nextErrors.amount = t`Enter an amount.`
    if (state.grouping === 'NONE') {
      if (!state.start) nextErrors.start = t`Required.`
      if (!state.end) nextErrors.end = t`Required.`
      if (state.start && state.end && state.end < state.start) {
        nextErrors.end = t`Must be on or after the start.`
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || amount === null) return

    let allocationPayload: { categoryId: number; amountMinor: number | null }[] | null = null
    if (mode === 'edit' && budget && progress && progress.periodYear !== null) {
      const rows = allocations.data ?? []
      allocationPayload = []
      for (const row of rows) {
        const raw = allocationValues[row.categoryId] ?? ''
        const parsed = raw.trim() === '' ? 0 : parseAmountMinor(raw, fractionDigits)
        if (parsed === null) {
          nextErrors.allocations = t`Enter a valid amount for every category.`
          break
        }
        allocationPayload.push({ categoryId: row.categoryId, amountMinor: parsed })
      }
      if (nextErrors.allocations) {
        setErrors(nextErrors)
        return
      }
    }

    let periodOverride: { categoryId: number; amountMinor: number | null; oneTime?: boolean } | null =
      null
    if (mode === 'edit' && budget && progress && progress.periodYear !== null) {
      if (customPeriod) {
        const parsedPeriod =
          periodAmount.trim() === '' ? null : parseAmountMinor(periodAmount, fractionDigits)
        if (parsedPeriod === null) {
          nextErrors.periodAmount = t`Enter a valid amount for this period.`
          setErrors(nextErrors)
          return
        }
        periodOverride = { categoryId: 0, amountMinor: parsedPeriod, oneTime: true }
      } else if (progress.periodAllocationMinor !== null) {
        periodOverride = { categoryId: 0, amountMinor: null }
      }
    }

    let rolloverPayload: { categoryId: number; amountMinor: number }[] | null = null
    if (
      mode === 'edit' &&
      budget &&
      progress &&
      (budget.grouping === 'MONTH' || budget.grouping === 'YEAR')
    ) {
      rolloverPayload = (allocations.data ?? []).map((row) => ({
        categoryId: row.categoryId,
        amountMinor: rolloverValues[row.categoryId]
          ? Math.max(row.allocatedMinor - row.spentMinor, 0)
          : 0,
      }))
    }

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
    // Omitting the filter keeps the stored one; only send it when it changed.
    if (JSON.stringify(criteria) !== JSON.stringify(initialCriteria)) {
      payload.criteria = criteria
    }
    setSaving(true)
    setSubmitError(null)
    try {
      if (mode === 'create') {
        await createBudget(payload)
      } else if (budget) {
        await updateBudget(budget.id, payload)
        if (
          allocationPayload &&
          progress &&
          progress.periodYear !== null &&
          progress.periodSecond !== null
        ) {
          await updateBudgetAllocations(budget.id, {
            year: progress.periodYear,
            second: progress.periodSecond,
            allocations: periodOverride
              ? [...(allocationPayload ?? []), periodOverride]
              : (allocationPayload ?? []),
            rollover: rolloverPayload ?? undefined,
          })
        }
      }
      onSaved(mode === 'create' ? t`Budget created.` : t`Budget saved.`)
    } catch (cause) {
      setSubmitError(describeError(cause, t`Could not save the budget.`))
      if (cause instanceof ApiError && cause.fields) setErrors(cause.fields)
    } finally {
      setSaving(false)
    }
  }

  async function duplicate() {
    if (!budget) return
    setSaving(true)
    setSubmitError(null)
    try {
      await duplicateBudget(budget.id)
      onSaved(t`Budget duplicated.`)
    } catch (cause) {
      setSubmitError(describeError(cause, t`Could not duplicate the budget.`))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!budget) return
    if (!window.confirm(t`Delete the budget “${budget.title}”?`)) return
    setSaving(true)
    setSubmitError(null)
    try {
      await deleteBudget(budget.id)
      onSaved(t`Budget deleted.`)
    } catch (cause) {
      setSubmitError(describeError(cause, t`Could not delete the budget.`))
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
        ref={panelRef}
        className="panel editor-panel"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? t`New budget` : t`Edit budget`}
      >
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{mode === 'create' ? t`New` : t`Edit`}</div>
            <h2>{mode === 'create' ? t`Budget` : t`Edit budget`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={requestClose} aria-label={t`Close editor`}>
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
            <span className="field-label">{t`Title`}</span>
            <input
              className={`input ${errors.title ? 'invalid' : ''}`}
              aria-label={t`Budget title`}
              value={state.title}
              onChange={(event) => update('title', event.target.value)}
              autoFocus={mode === 'create'}
            />
            {errors.title ? <span className="field-error">{errors.title}</span> : null}
          </label>

          <div className="form-row">
            <label className="field">
              <span className="field-label">{t`Account`}</span>
              <SearchSelect
                ariaLabel={t`Budget account`}
                value={String(state.accountId)}
                disabled={mode === 'edit'}
                options={accounts.map((candidate) => ({
                  value: String(candidate.id),
                  label: candidate.label,
                }))}
                onChange={(value) => update('accountId', Number(value))}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Period`}</span>
              <SearchSelect
                ariaLabel={t`Budget period`}
                value={state.grouping}
                disabled={mode === 'edit'}
                options={GROUPINGS.map((option) => ({
                  value: option,
                  label: groupingLabel(option),
                }))}
                onChange={(value) => update('grouping', value)}
              />
            </label>
          </div>

          {mode === 'edit' ? (
            <p className="card-note">
              {t`Account and period type are fixed after creation. Rollover is available for monthly and yearly budgets.`}
            </p>
          ) : null}

          <label className="field">
            <span className="field-label">
              {mode === 'edit' ? t`Default amount` : t`Amount`}
            </span>
            <div className="amount-field">
              <input
                className={`input amount-input ${errors.amount ? 'invalid' : ''}`}
                aria-label={t`Budget amount`}
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

          {mode === 'edit' && budget && progress && progress.periodYear !== null ? (
            <div className="field">
              <label className="check-row">
                <input
                  type="checkbox"
                  aria-label={t`Different amount this period`}
                  data-action="period-override"
                  checked={customPeriod}
                  onChange={(event) => {
                    setCustomPeriod(event.target.checked)
                    if (event.target.checked && !periodAmount) {
                      setPeriodAmount(state.amount)
                    }
                  }}
                />
                <span>{t`Different amount this period`}</span>
              </label>
              {customPeriod ? (
                <>
                  <div className="amount-field">
                    <input
                      className={`input amount-input ${errors.periodAmount ? 'invalid' : ''}`}
                      aria-label={t`Period amount`}
                      data-role="period-amount"
                      inputMode="decimal"
                      value={periodAmount}
                      onChange={(event) =>
                        setPeriodAmount(event.target.value.replace(/[^\d.,]/g, ''))
                      }
                      placeholder="0.00"
                    />
                    <span className="amount-currency">
                      {currencySymbol(account?.currency ?? 'EUR')}
                    </span>
                  </div>
                  {errors.periodAmount ? (
                    <span className="field-error">{errors.periodAmount}</span>
                  ) : null}
                </>
              ) : null}
              <p className="card-note">
                {t`Other periods keep using the default amount.`}
              </p>
            </div>
          ) : null}

          {state.grouping === 'NONE' ? (
            <div className="form-row">
              <label className="field">
                <span className="field-label">{t`Start`}</span>
                <input
                  className={`input ${errors.start ? 'invalid' : ''}`}
                  aria-label={t`Budget start`}
                  type="date"
                  value={state.start}
                  onChange={(event) => update('start', event.target.value)}
                />
                {errors.start ? <span className="field-error">{errors.start}</span> : null}
              </label>
              <label className="field">
                <span className="field-label">{t`End`}</span>
                <input
                  className={`input ${errors.end ? 'invalid' : ''}`}
                  aria-label={t`Budget end`}
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
                aria-label={t`Default budget`}
                checked={state.isDefault}
                onChange={(event) => update('isDefault', event.target.checked)}
              />
              <span>{t`Use as default budget for this account and period`}</span>
            </label>
          )}

          <BudgetFilterFields
            criteria={criteria}
            onChange={setCriteria}
            unsupported={budget?.criteriaUnsupported}
          />

          {mode === 'edit' && budget && budget.grouping !== 'NONE' ? (
            <section className="field">
              <span className="field-label">{t`Category allocations`}</span>
              {allocations.loading ? (
                <p className="card-note">{t`Loading allocations…`}</p>
              ) : (
                <div className="mt-1 flex flex-col gap-1.5">
                  {(allocations.data ?? [])
                    .filter(
                      (row) =>
                        row.allocatedMinor > 0 || row.spentMinor > 0 || row.level > 0,
                    )
                    .map((row) => (
                      <div
                        key={row.categoryId}
                        className="flex items-center justify-between gap-3 text-[12px]"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className="block truncate"
                            style={{ paddingLeft: row.level * 12 }}
                          >
                            {row.label}
                          </span>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-line bg-canvas">
                            <div
                              className={`h-full rounded-full ${
                                row.allocatedMinor > 0 && row.spentMinor > row.allocatedMinor
                                  ? 'bg-negative'
                                  : 'bg-accent'
                              }`}
                              style={{
                                width: `${
                                  row.allocatedMinor > 0
                                    ? Math.min(
                                        (row.spentMinor / row.allocatedMinor) * 100,
                                        100,
                                      )
                                    : row.spentMinor > 0
                                      ? 100
                                      : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {budget.grouping === 'MONTH' || budget.grouping === 'YEAR' ? (
                            <label className="check-row" title={t`Roll over unused amount`}>
                              <input
                                type="checkbox"
                                aria-label={t`Roll over ${row.label}`}
                                checked={rolloverValues[row.categoryId] ?? false}
                                onChange={(event) =>
                                  setRolloverValues((previous) => ({
                                    ...previous,
                                    [row.categoryId]: event.target.checked,
                                  }))
                                }
                              />
                              <span className="text-[11px] text-muted">{t`Roll over`}</span>
                            </label>
                          ) : null}
                          <input
                            className="input w-28 text-right"
                            inputMode="decimal"
                            aria-label={t`Allocation for ${row.label}`}
                            value={allocationValues[row.categoryId] ?? ''}
                            onChange={(event) =>
                              setAllocationValues((previous) => ({
                                ...previous,
                                [row.categoryId]: event.target.value.replace(/[^\d.,]/g, ''),
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {errors.allocations ? (
                <span className="field-error">{errors.allocations}</span>
              ) : null}
              <p className="card-note">
                {t`Allocations and rollover apply to the current period.`}
              </p>
            </section>
          ) : null}

          <label className="field">
            <span className="field-label">{t`Note`}</span>
            <textarea
              className="input textarea"
              aria-label={t`Budget note`}
              value={state.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
        </div>
        <div className="editor-actions">
          {mode === 'edit' ? (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => void duplicate()}
                disabled={saving}
              >
                {t`Duplicate`}
              </button>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => void remove()}
                disabled={saving}
              >
                {t`Delete`}
              </button>
            </>
          ) : null}
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
