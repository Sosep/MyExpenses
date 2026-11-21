import { getBudgetProgress, getBudgets } from '../../api'
import type { Budget, BudgetCriteria, BudgetProgress } from '../../types'

export interface BudgetWithProgress {
  budget: Budget
  progress: BudgetProgress
}

export interface BudgetSummary {
  currency: string
  fractionDigits: number
  periodDescription: string
  allocated: number
  spent: number
  remaining: number
}

/**
 * The combined KPI row is only meaningful when every budget shares currency
 * and period. Otherwise each card keeps its own figures and no total is shown.
 */
export function budgetSummary(entries: BudgetWithProgress[]): BudgetSummary | null {
  if (entries.length === 0) return null
  const currency = entries[0].progress.currency
  const periodDescription = entries[0].progress.periodDescription
  const comparable = entries.every(
    (entry) =>
      entry.progress.currency === currency &&
      entry.progress.periodDescription === periodDescription,
  )
  if (!comparable) return null
  return entries.reduce(
    (total, entry) => ({
      ...total,
      allocated: total.allocated + entry.progress.allocatedMinor,
      spent: total.spent + entry.progress.spentMinor,
      remaining: total.remaining + entry.progress.remainingMinor,
    }),
    {
      currency,
      fractionDigits: entries[0].progress.fractionDigits,
      periodDescription,
      allocated: 0,
      spent: 0,
      remaining: 0,
    },
  )
}

/** The transactions link behind a budget, with the same scope its spent counts. */
export function budgetTransactionsSearch(entry: BudgetWithProgress): string {
  const params = new URLSearchParams({
    view: 'transactions',
    preset: 'custom',
    from: entry.progress.periodStart,
    to: entry.progress.periodEnd,
    accountId: String(entry.progress.accountId),
  })
  const criteria: BudgetCriteria | null = entry.budget.criteria
  if (criteria) {
    // `categoryId` means the whole branch; the API expands it just like the
    // budget's own CategoryCriterion, so the list total matches spentMinor.
    for (const id of criteria.categoryIds) params.append('categoryId', String(id))
    for (const id of criteria.payeeIds) params.append('payeeId', String(id))
    for (const id of criteria.methodIds) params.append('methodId', String(id))
    for (const id of criteria.tagIds) params.append('tagId', String(id))
    for (const status of criteria.statuses) params.append('status', status)
  }
  return `?${params.toString()}`
}

/** The budget list plus its current-period progress; a budget that fails is skipped. */
export async function loadBudgetProgresses(): Promise<BudgetWithProgress[]> {
  const budgets = await getBudgets()
  const progresses = await Promise.all(
    budgets.map((budget) => getBudgetProgress(budget.id).catch(() => null)),
  )
  return budgets.flatMap((budget, index) => {
    const progress = progresses[index]
    return progress ? [{ budget, progress }] : []
  })
}

export type BudgetState = 'over' | 'warn' | 'ok'

export function budgetStateLabel(progress: BudgetProgress): BudgetState {
  if (progress.allocatedMinor <= 0) {
    return progress.spentMinor > 0 ? 'over' : 'ok'
  }
  const percent = (progress.spentMinor / progress.allocatedMinor) * 100
  if (percent > 100) return 'over'
  if (percent >= 80) return 'warn'
  return 'ok'
}

export function budgetPercent(progress: BudgetProgress): number {
  if (progress.allocatedMinor <= 0) return progress.spentMinor > 0 ? 100 : 0
  return (progress.spentMinor / progress.allocatedMinor) * 100
}
