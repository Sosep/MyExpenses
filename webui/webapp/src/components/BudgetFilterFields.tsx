import { useMemo } from 'react'
import { t } from '@lingui/core/macro'
import type { BudgetCriteria } from '../types'
import { categoryPathMap, statusLabel } from '../format'
import { useAsync } from '../hooks'
import { loadReferences } from '../references'
import { MultiPicker } from './MultiPicker'

const STATUSES = ['UNRECONCILED', 'CLEARED', 'RECONCILED'] as const

interface BudgetFilterFieldsProps {
  criteria: BudgetCriteria
  onChange: (criteria: BudgetCriteria) => void
  /** The stored filter cannot be expressed here; edit it in the app instead. */
  unsupported?: boolean
}

export function criteriaCount(criteria: BudgetCriteria): number {
  return (
    criteria.categoryIds.length +
    criteria.payeeIds.length +
    criteria.methodIds.length +
    criteria.tagIds.length +
    criteria.statuses.length
  )
}

export function emptyCriteria(): BudgetCriteria {
  return { categoryIds: [], payeeIds: [], methodIds: [], tagIds: [], statuses: [] }
}

/**
 * The same five dimensions the Android budget editor offers. Kept out of the
 * editor body so the panel can show the filter with the same labels.
 */
export function BudgetFilterFields({ criteria, onChange, unsupported }: BudgetFilterFieldsProps) {
  const references = useAsync(loadReferences, ['references'])
  const paths = useMemo(
    () => categoryPathMap(references.data?.categories ?? []),
    [references.data?.categories],
  )
  const categoryOptions = useMemo(
    () =>
      (references.data?.categories ?? [])
        .slice()
        .sort((left, right) =>
          (paths.get(left.id) ?? left.label).localeCompare(paths.get(right.id) ?? right.label),
        )
        .map((category) => ({
          value: String(category.id),
          label: paths.get(category.id) ?? category.label,
        })),
    [references.data?.categories, paths],
  )

  const update = (patch: Partial<BudgetCriteria>) => onChange({ ...criteria, ...patch })
  const count = criteriaCount(criteria)

  return (
    <section className="field">
      <span className="field-label">{t`Filter`}</span>
      {unsupported ? (
        <p className="hint">
          {t`This budget uses a filter the web cannot edit. Keep using the Android app for it.`}
        </p>
      ) : (
        <>
          <div className="detail-grid">
            <label className="field">
              <span className="field-label">{t`Categories`}</span>
              <MultiPicker
                ariaLabel={t`Filter categories`}
                options={categoryOptions}
                values={criteria.categoryIds.map(String)}
                onChange={(values) => update({ categoryIds: values.map(Number) })}
              />
              <span className="hint">{t`Includes subcategories`}</span>
            </label>
            <label className="field">
              <span className="field-label">{t`Payees`}</span>
              <MultiPicker
                ariaLabel={t`Filter payees`}
                options={(references.data?.payees ?? []).map((payee) => ({
                  value: String(payee.id),
                  label: payee.name,
                }))}
                values={criteria.payeeIds.map(String)}
                onChange={(values) => update({ payeeIds: values.map(Number) })}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Methods`}</span>
              <MultiPicker
                ariaLabel={t`Filter methods`}
                options={(references.data?.methods ?? []).map((method) => ({
                  value: String(method.id),
                  label: method.label,
                }))}
                values={criteria.methodIds.map(String)}
                onChange={(values) => update({ methodIds: values.map(Number) })}
              />
            </label>
            <label className="field">
              <span className="field-label">{t`Tags`}</span>
              <MultiPicker
                ariaLabel={t`Filter tags`}
                options={(references.data?.tags ?? []).map((tag) => ({
                  value: String(tag.id),
                  label: tag.label,
                }))}
                values={criteria.tagIds.map(String)}
                onChange={(values) => update({ tagIds: values.map(Number) })}
              />
            </label>
          </div>
          <div className="field mt-2">
            <span className="field-label">{t`Status`}</span>
            <div className="segmented" role="group" aria-label={t`Filter status`}>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={criteria.statuses.includes(status) ? 'active' : ''}
                  aria-pressed={criteria.statuses.includes(status)}
                  onClick={() =>
                    update({
                      statuses: criteria.statuses.includes(status)
                        ? criteria.statuses.filter((value) => value !== status)
                        : [...criteria.statuses, status],
                    })
                  }
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">
            {count === 0 ? t`No filter: the whole account` : t`${count} filters`}
          </p>
        </>
      )}
    </section>
  )
}
