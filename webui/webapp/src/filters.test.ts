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
  it('reads the four ids and keeps the rest of the query', () => {
    expect(filtersFromUrl('?categoryId=3&tagId=7&view=transactions')).toEqual({
      categoryId: 3,
      payeeId: null,
      tagId: 7,
      methodId: null,
    })
  })

  it('ignores values that are not positive integers', () => {
    expect(filtersFromUrl('?categoryId=0&payeeId=-2&tagId=abc')).toEqual(NO_FILTERS)
  })

  it('writes and removes the filters without losing the other parameters', () => {
    const search = searchWithFilters('?locale=es&categoryId=3', {
      categoryId: null,
      payeeId: 5,
      tagId: null,
      methodId: null,
    })

    expect(search).toContain('locale=es')
    expect(search).not.toContain('categoryId')
    expect(search).toContain('payeeId=5')
  })

  it('returns an empty query when no filters are set', () => {
    expect(searchWithFilters('?categoryId=3', NO_FILTERS)).toBe('')
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
