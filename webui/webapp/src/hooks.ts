import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

interface AsyncState<T> {
  data?: T
  error?: Error
  loading: boolean
}

/**
 * Thin adapter over TanStack Query so screens keep their small `useAsync` API.
 * The dependency array doubles as the query key; callers prefix it with a
 * stable name (for example `['budgets', dataVersion]`).
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { reload: () => void; query: UseQueryResult<T, Error> } {
  const query = useQuery<T, Error>({
    queryKey: deps,
    queryFn: loader,
  })
  return {
    data: query.data,
    error: query.error ?? undefined,
    loading: query.isPending,
    reload: () => {
      void query.refetch()
    },
    query,
  }
}
