export interface Filters {
  categoryId: number | null
  payeeId: number | null
  tagId: number | null
  methodId: number | null
}

export const FILTER_KEYS = ['categoryId', 'payeeId', 'tagId', 'methodId'] as const

export const NO_FILTERS: Filters = {
  categoryId: null,
  payeeId: null,
  tagId: null,
  methodId: null,
}

/**
 * Filters live in the URL so a filtered list can be shared or reloaded. Only
 * positive ids are accepted; anything else falls back to "all".
 */
export function filtersFromUrl(search: string): Filters {
  const params = new URLSearchParams(search)
  const read = (key: (typeof FILTER_KEYS)[number]) => {
    const value = Number(params.get(key))
    return Number.isInteger(value) && value > 0 ? value : null
  }
  return {
    categoryId: read('categoryId'),
    payeeId: read('payeeId'),
    tagId: read('tagId'),
    methodId: read('methodId'),
  }
}

export function searchWithFilters(search: string, filters: Filters): string {
  const params = new URLSearchParams(search)
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value === null) params.delete(key)
    else params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
