import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@lingui/core/macro'

export interface SearchOption {
  value: string
  label: string
  keywords?: string
}

interface SearchSelectProps {
  value: string
  options: SearchOption[]
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchIndex(label: string, query: string): number {
  if (!query) return -1
  // Highlight only when the query matches the unaccented label contiguously.
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.toLowerCase().indexOf(query)
}

/**
 * SearchSelect behaves like Select2: the input is the search box, the list is
 * rendered in a portal so panels cannot clip it, and every keystroke filters.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
  className,
}: SearchSelectProps) {
  const selected = options.find((option) => option.value === value)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(selected?.label ?? '')
  const [highlight, setHighlight] = useState(0)
  const [rect, setRect] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const query = useMemo(() => normalize(input), [input])

  const filtered = useMemo(() => {
    if (!open || !query || input === selected?.label) return options
    return options.filter(
      (option) =>
        normalize(option.label).includes(query) ||
        normalize(option.keywords ?? '').includes(query),
    )
  }, [input, open, options, query, selected?.label])

  function updatePosition() {
    const box = wrapperRef.current?.getBoundingClientRect()
    if (!box) return
    const spaceBelow = window.innerHeight - box.bottom
    const openAbove = spaceBelow < 260 && box.top > spaceBelow
    setRect({
      left: box.left,
      width: box.width,
      ...(openAbove
        ? { bottom: window.innerHeight - box.top + 4 }
        : { top: box.bottom + 4 }),
    })
  }

  useEffect(() => {
    if (!open) setInput(selected?.label ?? '')
  }, [selected?.label, open])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onLayout = () => updatePosition()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocument = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setOpen(false)
      setInput(selected?.label ?? '')
    }
    document.addEventListener('mousedown', onDocument)
    return () => document.removeEventListener('mousedown', onDocument)
  }, [open, selected?.label])

  function choose(option: SearchOption) {
    onChange(option.value)
    setInput(option.label)
    setOpen(false)
    inputRef.current?.blur()
  }

  const menu =
    open && rect
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="search-select-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              top: rect.top,
              bottom: rect.bottom,
              zIndex: 200,
            }}
          >
            {filtered.length === 0 ? (
              <div className="search-select-empty">{t`No matches`}</div>
            ) : (
              filtered.map((option, index) => {
                const at = matchIndex(option.label, query)
                return (
                  <button
                    key={option.value || 'empty'}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={`search-select-option ${index === highlight ? 'active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(option)}
                  >
                    {at >= 0 && query ? (
                      <>
                        {option.label.slice(0, at)}
                        <mark>{option.label.slice(at, at + query.length)}</mark>
                        {option.label.slice(at + query.length)}
                      </>
                    ) : (
                      option.label
                    )}
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={wrapperRef} className={`search-select ${className ?? ''}`}>
      <input
        ref={inputRef}
        className="input"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlight] ? `${listId}-${highlight}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={input}
        onFocus={(event) => {
          setOpen(true)
          setHighlight(0)
          window.setTimeout(() => event.target.select(), 0)
        }}
        onChange={(event) => {
          setInput(event.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setHighlight((current) => Math.min(current + 1, filtered.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open && filtered[highlight]) {
            event.preventDefault()
            choose(filtered[highlight])
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            setInput(selected?.label ?? '')
            inputRef.current?.blur()
          }
        }}
      />
      {menu}
    </div>
  )
}
