import { getCategories, getMethods, getPayees, getTags } from './api'

export interface References {
  categories: Awaited<ReturnType<typeof getCategories>>
  payees: Awaited<ReturnType<typeof getPayees>>
  tags: Awaited<ReturnType<typeof getTags>>
  methods: Awaited<ReturnType<typeof getMethods>>
}

/**
 * The master lists a filter can point at. Loaded once per query key so the
 * budget editor, the detail panel and the transaction filters share the cache.
 */
export function loadReferences(): Promise<References> {
  return Promise.all([getCategories(), getPayees(), getTags(), getMethods()]).then(
    ([categories, payees, tags, methods]) => ({ categories, payees, tags, methods }),
  )
}
