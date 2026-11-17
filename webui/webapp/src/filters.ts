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


export type Grouping = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export const GROUPINGS: Grouping[] = ['NONE', 'DAY', 'WEEK', 'MONTH', 'YEAR']

const GROUPING_STORAGE_KEY = 'myexpenses.grouping'

export function isGrouping(value: string | null): value is Grouping {
  return value !== null && (GROUPINGS as string[]).includes(value)
}

/**
 * Grouping is a visual choice, remembered between visits. The URL wins over the
 * stored value so a shared link keeps its grouping.
 */
export function groupingFromUrl(search: string): Grouping {
  const fromUrl = new URLSearchParams(search).get('grouping')?.toUpperCase() ?? null
  if (isGrouping(fromUrl)) return fromUrl
  const stored = window.localStorage.getItem(GROUPING_STORAGE_KEY)?.toUpperCase() ?? null
  return isGrouping(stored) ? stored : 'MONTH'
}

export function rememberGrouping(grouping: Grouping) {
  window.localStorage.setItem(GROUPING_STORAGE_KEY, grouping)
}

export type RangePreset = 'all' | 'month' | 'last3' | 'year' | 'custom'

export interface RangeState {
  preset: RangePreset
  from: string | null
  to: string | null
}

export const DEFAULT_RANGE: RangeState = { preset: 'all', from: null, to: null }

export function rangeFromUrl(search: string): RangeState {
  const params = new URLSearchParams(search)
  const preset = params.get('preset')
  const from = params.get('from')
  const to = params.get('to')
  if (preset === 'custom' && from && to) return { preset: 'custom', from, to }
  if (preset === 'month' || preset === 'last3' || preset === 'year') {
    return { preset, from: null, to: null }
  }
  return DEFAULT_RANGE
}

export function searchWithViewState(
  search: string,
  grouping: Grouping,
  range: RangeState,
): string {
  const params = new URLSearchParams(search)
  params.set('grouping', grouping)
  if (range.preset === 'all') {
    params.delete('preset')
    params.delete('from')
    params.delete('to')
  } else if (range.preset === 'custom') {
    params.set('preset', 'custom')
    if (range.from) params.set('from', range.from)
    if (range.to) params.set('to', range.to)
  } else {
    params.set('preset', range.preset)
    params.delete('from')
    params.delete('to')
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
