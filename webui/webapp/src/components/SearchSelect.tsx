import { useEffect, useId, useMemo, useRef, useState } from 'react'
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

/**
 * Searchable combobox: focus opens the list, typing filters it, and the value
 * only changes when an option is chosen. Empty value is a valid option.
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
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) setInput(selected?.label ?? '')
  }, [selected?.label, open])

  useEffect(() => {
    if (!open) return
    const onDocument = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setInput(selected?.label ?? '')
      }
    }
    document.addEventListener('mousedown', onDocument)
    return () => document.removeEventListener('mousedown', onDocument)
  }, [open, selected?.label])

  const filtered = useMemo(() => {
    if (!open || !input || input === selected?.label) return options
    const query = normalize(input)
    return options.filter(
      (option) =>
        normalize(option.label).includes(query) ||
        normalize(option.keywords ?? '').includes(query),
    )
  }, [input, open, options, selected?.label])

  function choose(option: SearchOption) {
    onChange(option.value)
    setInput(option.label)
    setOpen(false)
    inputRef.current?.blur()
  }

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
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
              setOpen(false)
              setInput(selected?.label ?? '')
            }
          }, 0)
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
      {open ? (
        <div id={listId} className="search-select-menu" role="listbox" aria-label={ariaLabel}>
          {filtered.length === 0 ? (
            <div className="search-select-empty">{t`No matches`}</div>
          ) : (
            filtered.map((option, index) => (
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
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
