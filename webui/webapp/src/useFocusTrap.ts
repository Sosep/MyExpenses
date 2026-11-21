import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Keeps the keyboard inside an open panel and hands focus back to whatever
 * opened it. The panels are `aria-modal` dialogs: without this, Tab walks
 * behind the overlay and the trigger loses the focus for good.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement

      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !node.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    // Fields use autoFocus; only step in when nothing inside took the focus.
    const frame = window.requestAnimationFrame(() => {
      if (!node.contains(document.activeElement)) focusable()[0]?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      node.removeEventListener('keydown', onKeyDown)
      if (restore?.isConnected) restore.focus()
    }
  }, [ref])
}

/** True for the panel on top of the stack; a covered panel must ignore Escape. */
export function isTopPanel(node: HTMLElement | null): boolean {
  const panels = document.querySelectorAll('.panel[role="dialog"]')
  return panels.length === 0 || panels[panels.length - 1] === node
}
