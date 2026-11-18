/**
 * The view lives in the URL (`?view=transactions`) so the browser's back button
 * walks the app instead of leaving it, deep links open a screen directly and a
 * reload keeps the user where they were. Screen filters are written by each
 * screen and preserved here.
 */
export const VIEWS = ['dashboard', 'transactions', 'reports', 'budgets', 'files'] as const
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
