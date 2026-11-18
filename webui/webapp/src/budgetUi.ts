import { t } from '@lingui/core/macro'
import type { BudgetCriteria, BudgetProgress } from './types'

/** The grouping name the API returns, in the copy the app uses. */
export function groupingLabel(grouping: string): string {
  switch (grouping) {
    case 'DAY':
      return t`Daily`
    case 'WEEK':
      return t`Weekly`
    case 'MONTH':
      return t`Monthly`
    case 'YEAR':
      return t`Yearly`
    case 'NONE':
      return t`One-time`
    default:
      return grouping
  }
}

/**
 * Days left in the period, or null when the period is not the current one:
 * `currentDay` is negative for future periods and beyond `totalDays` for past
 * ones, and the card should not invent a number there.
 */
export function daysLeft(progress: BudgetProgress): number | null {
  if (progress.currentDay < 1 || progress.currentDay > progress.totalDays) return null
  return progress.totalDays - progress.currentDay + 1
}

/** Percentage of the allocation already spent, capped for the bar. */
export function progressRatio(progress: BudgetProgress): number {
  if (progress.allocatedMinor <= 0) return progress.spentMinor > 0 ? 1 : 0
  return Math.min(progress.spentMinor / progress.allocatedMinor, 1)
}

/** `over` past 100 %, `warn` from 80 %, otherwise no modifier. */
export function budgetState(spent: number, allocated: number): string {
  if (allocated <= 0) return spent > 0 ? 'over' : ''
  const percent = Math.round((spent / allocated) * 100)
  if (percent > 100) return 'over'
  if (percent >= 80) return 'warn'
  return ''
}

export interface BudgetDrilldown {
  /** The account the budget belongs to; the list must open in it. */
  accountId: number
  from: string
  to: string
  /** The clicked row; `<= 0` is the uncategorized one. */
  categoryId: number
  criteria: BudgetCriteria | null
}

/**
 * The transactions link behind a breakdown row: the budget's own account, its
 * period, the clicked branch and the criteria the list can express. The API
 * expands the category to its subtree, so the row and the list add up to the
 * same figure.
 */
export function budgetDrilldownSearch(drilldown: BudgetDrilldown): string {
  const params = new URLSearchParams()
  params.set('view', 'transactions')
  // A custom range is what the transactions screen reads back from the URL.
  params.set('preset', 'custom')
  params.set('from', drilldown.from)
  params.set('to', drilldown.to)
  params.set('accountId', String(drilldown.accountId))
  if (drilldown.categoryId <= 0) {
    params.set('uncategorized', 'true')
  } else {
    params.set('categoryId', String(drilldown.categoryId))
  }
  const criteria = drilldown.criteria
  if (criteria) {
    for (const id of criteria.payeeIds) params.append('payeeId', String(id))
    for (const id of criteria.methodIds) params.append('methodId', String(id))
    for (const id of criteria.tagIds) params.append('tagId', String(id))
    for (const status of criteria.statuses) params.append('status', status)
  }
  return `?${params.toString()}`
}
