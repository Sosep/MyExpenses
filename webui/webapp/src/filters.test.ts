import { describe, expect, it } from 'vitest'
import {
  NO_FILTERS,
  filtersFromUrl,
  groupingFromUrl,
  rangeFromUrl,
  searchWithFilters,
  searchWithViewState,
} from './filters'

describe('filters in the URL', () => {
  it('reads repeated ids and keeps the rest of the query', () => {
    const filters = filtersFromUrl(
      '?categoryId=3&categoryId=5&tagId=7&view=transactions&q=cafe',
    )
    expect(filters.categoryIds).toEqual([3, 5])
    expect(filters.payeeIds).toEqual([])
    expect(filters.tagIds).toEqual([7])
    expect(filters.text).toBe('cafe')
  })

  it('reads amounts, statuses and the transfer switch', () => {
    const filters = filtersFromUrl(
      '?amountMin=100&amountMax=5000&status=CLEARED&status=nope&transfer=true',
    )
    expect(filters.amountMin).toBe(100)
    expect(filters.amountMax).toBe(5000)
    expect(filters.statuses).toEqual(['CLEARED'])
    expect(filters.transfer).toBe('only')
  })

  it('ignores values that are not usable', () => {
    expect(filtersFromUrl('?categoryId=0&payeeId=-2&tagId=abc&amountMin=x')).toEqual({
      ...NO_FILTERS,
    })
  })

  it('writes repeated parameters without losing the other ones', () => {
    const search = searchWithFilters('?locale=es&categoryId=9', {
      ...NO_FILTERS,
      categoryIds: [3, 5],
      text: 'cafe',
      statuses: ['CLEARED'],
      transfer: 'none',
    })
    const params = new URLSearchParams(search)
    expect(params.getAll('categoryId')).toEqual(['3', '5'])
    expect(params.get('q')).toBe('cafe')
    expect(params.get('status')).toBe('CLEARED')
    expect(params.get('transfer')).toBe('false')
    expect(params.get('locale')).toBe('es')
  })

  it('removing a filter drops only its parameters', () => {
    const search = searchWithFilters('?categoryId=3&tagId=7&q=x', {
      ...NO_FILTERS,
      tagIds: [7],
    })
    const params = new URLSearchParams(search)
    expect(params.getAll('categoryId')).toEqual([])
    expect(params.get('q')).toBeNull()
    expect(params.getAll('tagId')).toEqual(['7'])
  })
})

describe('grouping and range in the URL', () => {
  it('reads the grouping, and falls back to the stored value, then MONTH', () => {
    expect(groupingFromUrl('?grouping=WEEK')).toBe('WEEK')

    window.localStorage.setItem('myexpenses.grouping', 'YEAR')
    expect(groupingFromUrl('?view=transactions')).toBe('YEAR')

    window.localStorage.removeItem('myexpenses.grouping')
    expect(groupingFromUrl('?grouping=NOPE')).toBe('MONTH')

    // The URL wins over the remembered value.
    window.localStorage.setItem('myexpenses.grouping', 'YEAR')
    expect(groupingFromUrl('?grouping=DAY')).toBe('DAY')
    window.localStorage.removeItem('myexpenses.grouping')
  })

  it('reads presets and custom ranges', () => {
    expect(rangeFromUrl('?preset=month')).toEqual({ preset: 'month', from: null, to: null })
    expect(rangeFromUrl('?preset=custom&from=2026-01-01&to=2026-03-31')).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-03-31',
    })
    expect(rangeFromUrl('?preset=custom')).toEqual({ preset: 'all', from: null, to: null })
    expect(rangeFromUrl('')).toEqual({ preset: 'all', from: null, to: null })
  })

  it('writes grouping and range without losing filters', () => {
    expect(
      searchWithViewState('?categoryId=3', 'WEEK', { preset: 'all', from: null, to: null }),
    ).toBe('?categoryId=3&grouping=WEEK')

    expect(
      searchWithViewState('?categoryId=3', 'YEAR', {
        preset: 'custom',
        from: '2026-01-01',
        to: '2026-02-01',
      }),
    ).toBe('?categoryId=3&grouping=YEAR&preset=custom&from=2026-01-01&to=2026-02-01')

    expect(
      searchWithViewState('?preset=month&from=2026-01-01&to=2026-01-31', 'MONTH', {
        preset: 'all',
        from: null,
        to: null,
      }),
    ).toBe('?grouping=MONTH')
  })
})
