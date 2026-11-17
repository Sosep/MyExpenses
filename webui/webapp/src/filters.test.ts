import { describe, expect, it } from 'vitest'
import { NO_FILTERS, filtersFromUrl, searchWithFilters } from './filters'

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
