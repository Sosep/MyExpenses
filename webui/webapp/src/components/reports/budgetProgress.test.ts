import { describe, expect, it } from 'vitest'
import type { Budget, BudgetProgress } from '../../types'
import {
  budgetSummary,
  budgetTransactionsSearch,
} from './budgetProgress'
import type { BudgetWithProgress } from './budgetProgress'

function budget(over: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    accountId: 1,
    title: 'Groceries',
    description: null,
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    color: 0,
    start: null,
    end: null,
    accountName: 'Everyday',
    isDefault: false,
    uuid: null,
    allocationMinor: 40000,
    criteria: null,
    criteriaUnsupported: false,
    ...over,
  }
}

function progress(over: Partial<BudgetProgress> = {}): BudgetProgress {
  return {
    budgetId: 1,
    accountId: 1,
    title: 'Groceries',
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    periodYear: 2026,
    periodSecond: 10,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    periodDescription: 'November 2026',
    allocatedMinor: 40000,
    spentMinor: 31200,
    remainingMinor: 8800,
    totalDays: 30,
    currentDay: 21,
    periodAllocationMinor: null,
    ...over,
  }
}

function entry(over: {
  budget?: Partial<Budget>
  progress?: Partial<BudgetProgress>
} = {}): BudgetWithProgress {
  return { budget: budget(over.budget), progress: progress(over.progress) }
}

describe('budget summary', () => {
  it('adds budgets that share currency and period', () => {
    expect(
      budgetSummary([
        entry(),
        entry({
          budget: { id: 2, title: 'Restaurants' },
          progress: {
            budgetId: 2,
            title: 'Restaurants',
            allocatedMinor: 12000,
            spentMinor: 14600,
            remainingMinor: -2600,
          },
        }),
      ]),
    ).toMatchObject({
      currency: 'EUR',
      periodDescription: 'November 2026',
      allocated: 52000,
      spent: 45800,
      remaining: 6200,
    })
  })

  it('does not add a monthly and a yearly budget of the same currency', () => {
    expect(
      budgetSummary([
        entry(),
        entry({
          budget: { id: 2, grouping: 'YEAR' },
          progress: {
            budgetId: 2,
            grouping: 'YEAR',
            periodDescription: '2026',
            allocatedMinor: 480000,
          },
        }),
      ]),
    ).toBeNull()
  })

  it('does not add two currencies', () => {
    expect(
      budgetSummary([
        entry(),
        entry({
          progress: { currency: 'USD', fractionDigits: 2 },
        }),
      ]),
    ).toBeNull()
  })

  it('returns null when there are no budgets', () => {
    expect(budgetSummary([])).toBeNull()
  })
})

describe('budget transactions link', () => {
  it('keeps the category branch of the budget criteria', () => {
    const search = budgetTransactionsSearch(
      entry({
        budget: {
          criteria: {
            categoryIds: [2, 5],
            payeeIds: [9],
            methodIds: [],
            tagIds: [],
            statuses: [],
          },
        },
      }),
    )
    const params = new URLSearchParams(search)
    expect(params.getAll('categoryId')).toEqual(['2', '5'])
    expect(params.getAll('payeeId')).toEqual(['9'])
    expect(params.get('accountId')).toBe('1')
    expect(params.get('from')).toBe('2026-11-01')
    expect(params.get('to')).toBe('2026-11-30')
  })
})
