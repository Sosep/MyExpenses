import { useEffect, useState } from 'react'

interface AsyncState<T> {
  data?: T
  error?: Error
  loading: boolean
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ loading: true })
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  return {
    ...state,
    reload: () => setReloadKey((key) => key + 1),
  }
}
