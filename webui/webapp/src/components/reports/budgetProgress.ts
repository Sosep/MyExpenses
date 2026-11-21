import { getBudgetProgress, getBudgets } from '../../api'
import type { Budget, BudgetProgress } from '../../types'

export interface BudgetWithProgress {
  budget: Budget
  progress: BudgetProgress
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
