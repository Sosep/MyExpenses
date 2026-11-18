export interface Filters {
  categoryIds: number[]
  payeeIds: number[]
  tagIds: number[]
  methodIds: number[]
  text: string | null
  /** Minor units, absolute value. */
  amountMin: number | null
  amountMax: number | null
  statuses: string[]
  /** Only movements without a category (used by the budget drill-down). */
  uncategorized: boolean
  transfer: 'any' | 'only' | 'none'
}

export type Grouping = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export const GROUPINGS: Grouping[] = ['NONE', 'DAY', 'WEEK', 'MONTH', 'YEAR']

export const NO_FILTERS: Filters = {
  categoryIds: [],
  payeeIds: [],
  tagIds: [],
  methodIds: [],
  text: null,
  amountMin: null,
  amountMax: null,
  statuses: [],
  uncategorized: false,
  transfer: 'any',
}

const ID_KEYS = [
  ['categoryIds', 'categoryId'],
  ['payeeIds', 'payeeId'],
  ['tagIds', 'tagId'],
  ['methodIds', 'methodId'],
] as const

const STATUS_VALUES = ['UNRECONCILED', 'CLEARED', 'RECONCILED', 'VOID']

/**
 * Filters live in the URL so a filtered list can be shared or reloaded. Lists
 * are repeated parameters (`?tagId=1&tagId=2`), which is what the API accepts.
 */
export function filtersFromUrl(search: string): Filters {
  const params = new URLSearchParams(search)
  const ids = (name: string) =>
    params
      .getAll(name)
      .flatMap((value) => value.split(','))
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)

  const number = (name: string) => {
    const raw = params.get(name)
    if (raw === null || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
  }

  const text = params.get('q')?.trim() ?? ''
  const transfer = params.get('transfer')

  return {
    categoryIds: ids('categoryId'),
    payeeIds: ids('payeeId'),
    tagIds: ids('tagId'),
    methodIds: ids('methodId'),
    text: text === '' ? null : text,
    amountMin: number('amountMin'),
    amountMax: number('amountMax'),
    statuses: params
      .getAll('status')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().toUpperCase())
      .filter((value) => STATUS_VALUES.includes(value)),
    uncategorized: params.get('uncategorized') === 'true',
    transfer: transfer === 'true' ? 'only' : transfer === 'false' ? 'none' : 'any',
  }
}

export function searchWithFilters(search: string, filters: Filters): string {
  const params = new URLSearchParams(search)
  for (const [field, name] of ID_KEYS) {
    params.delete(name)
    for (const id of filters[field]) params.append(name, String(id))
  }
  params.delete('status')
  for (const status of filters.statuses) params.append('status', status)

  const simple: Array<[string, string | number | null]> = [
    ['q', filters.text],
    ['amountMin', filters.amountMin],
    ['amountMax', filters.amountMax],
  ]
  for (const [name, value] of simple) {
    if (value === null || value === '') params.delete(name)
    else params.set(name, String(value))
  }

  if (filters.uncategorized) params.set('uncategorized', 'true')
  else params.delete('uncategorized')
  if (filters.transfer === 'any') params.delete('transfer')
  else params.set('transfer', filters.transfer === 'only' ? 'true' : 'false')

  const query = params.toString()
  return query ? `?${query}` : ''
}

export function activeFilterCount(filters: Filters): number {
  return (
    filters.categoryIds.length +
    filters.payeeIds.length +
    filters.tagIds.length +
    filters.methodIds.length +
    filters.statuses.length +
    (filters.text ? 1 : 0) +
    (filters.amountMin !== null || filters.amountMax !== null ? 1 : 0) +
    (filters.uncategorized ? 1 : 0) +
    (filters.transfer === 'any' ? 0 : 1)
  )
}

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
