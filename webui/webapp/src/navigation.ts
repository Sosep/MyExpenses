import { useCallback, useEffect, useRef } from 'react'

/**
 * The view lives in the URL (`?view=transactions`) so the browser's back button
 * walks the app instead of leaving it, deep links open a screen directly and a
 * reload keeps the user where they were. Screen filters are written by each
 * screen and preserved here.
 */
export const VIEWS = ['dashboard', 'transactions', 'reports', 'budgets', 'files', 'datos'] as const
export type View = (typeof VIEWS)[number]

export function readView(search: string): View {
  const value = new URLSearchParams(search).get('view')
  return (VIEWS as readonly string[]).includes(value ?? '') ? (value as View) : 'dashboard'
}

/** URL for a view change, keeping the parameters the screens already wrote. */
export function viewUrl(search: string, view: View): string {
  const params = new URLSearchParams(search)
  if (view === 'dashboard') params.delete('view')
  else params.set('view', view)
  const path = window.location.pathname
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** Absolute URL the router can push, from a `/app/?…` string built elsewhere. */
export function searchOf(url: string): string {
  return new URL(url, window.location.origin).search
}

/**
 * The account a screen wants the list to show (`?accountId=2`). A screen that
 * sends the user somewhere else decides it, so a budget of another account or a
 * shared link open the list it promised. Without the parameter the remembered
 * account wins.
 */
export function accountFromUrl(search: string): number | null {
  const raw = new URLSearchParams(search).get('accountId')
  if (raw === null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

/** The same query with the account written, or removed when it is unknown. */
export function searchWithAccount(search: string, accountId: number | null): string {
  const params = new URLSearchParams(search)
  if (accountId === null) params.delete('accountId')
  else params.set('accountId', String(accountId))
  const query = params.toString()
  return query ? `?${query}` : ''
}

let nextPanelId = 0

/**
 * Keeps a panel and the history in sync: opening pushes an entry, the browser's
 * back closes the panel, and closing it from the UI pops that entry so the two
 * never drift. Returns the close handler the panel must use. Stacked panels get
 * their own id so only the popped one closes.
 */
export function useHistoryPanel(open: boolean, close: () => void): () => void {
  const closeRef = useRef(close)
  closeRef.current = close
  const idRef = useRef<number | null>(null)
  if (idRef.current === null) idRef.current = nextPanelId++
  const id = idRef.current

  useEffect(() => {
    if (!open) return
    // Every panel owns its entry. A stacked panel (the operation editor over
    // its detail) must not close when the other entry is popped.
    window.history.pushState({ panel: true, panelId: id }, '', window.location.href)
    const onPopState = () => {
      if (window.history.state?.panelId !== id) closeRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [open, id])

  return useCallback(() => {
    if (window.history.state?.panelId === id) window.history.back()
    else closeRef.current()
  }, [id])
}
