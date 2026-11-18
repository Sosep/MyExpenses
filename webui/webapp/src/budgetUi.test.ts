import { describe, expect, it } from 'vitest'
import { budgetDrilldownSearch } from './budgetUi'

const base = {
  accountId: 2,
  from: '2026-11-01',
  to: '2026-11-30',
  categoryId: 5,
  criteria: null,
}

describe('budget drill-down link', () => {
  it('opens the transactions screen in the budget account and period', () => {
    const params = new URLSearchParams(budgetDrilldownSearch(base))
    expect(params.get('view')).toBe('transactions')
    expect(params.get('preset')).toBe('custom')
    expect(params.get('from')).toBe('2026-11-01')
    expect(params.get('to')).toBe('2026-11-30')
    expect(params.get('accountId')).toBe('2')
    expect(params.get('uncategorized')).toBeNull()
  })

  it('sends the clicked row only: the API expands the branch', () => {
    const params = new URLSearchParams(budgetDrilldownSearch(base))
    expect(params.getAll('categoryId')).toEqual(['5'])
  })

  it('keeps the criteria the list can express', () => {
    const params = new URLSearchParams(
      budgetDrilldownSearch({
        ...base,
        criteria: {
          categoryIds: [5, 9],
          payeeIds: [3],
          methodIds: [4, 7],
          tagIds: [8],
          statuses: ['CLEARED', 'RECONCILED'],
        },
      }),
    )
    expect(params.getAll('payeeId')).toEqual(['3'])
    expect(params.getAll('methodId')).toEqual(['4', '7'])
    expect(params.getAll('tagId')).toEqual(['8'])
    expect(params.getAll('status')).toEqual(['CLEARED', 'RECONCILED'])
  })

  it('points the uncategorized row at its filter', () => {
    const params = new URLSearchParams(budgetDrilldownSearch({ ...base, categoryId: 0 }))
    expect(params.get('uncategorized')).toBe('true')
    expect(params.getAll('categoryId')).toEqual([])
  })
})
