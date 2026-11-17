import { t } from '@lingui/core/macro'
import { SearchSelect } from './SearchSelect'

interface Option {
  value: string
  label: string
}

interface MultiPickerProps {
  ariaLabel: string
  options: Option[]
  values: string[]
  onChange: (values: string[]) => void
}

/**
 * Adds values from a filtered combobox and keeps them as removable chips, which
 * is how the Android filters pick several categories, payees, tags or methods.
 */
export function MultiPicker({ ariaLabel, options, values, onChange }: MultiPickerProps) {
  const labels = new Map(options.map((option) => [option.value, option.label]))
  const available = options.filter(
    (option) => option.value !== '' && !values.includes(option.value),
  )

  return (
    <div className="multi-picker">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className="filter-chip"
          aria-label={t`Remove filter: ${labels.get(value) ?? value}`}
          onClick={() => onChange(values.filter((entry) => entry !== value))}
        >
          {labels.get(value) ?? value}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <SearchSelect
        ariaLabel={ariaLabel}
        value=""
        options={[{ value: '', label: t`Add…` }, ...available]}
        onChange={(value) => {
          if (value) onChange([...values, value])
        }}
      />
    </div>
  )
}
