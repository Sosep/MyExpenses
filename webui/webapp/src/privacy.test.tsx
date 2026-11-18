import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from './i18n'
import { maskedMoney } from './format'
import { AmountsProvider, Money, useAmounts } from './privacy'

i18n.activate('en')

beforeEach(() => {
  localStorage.clear()
})

function Harness() {
  const amounts = useAmounts()
  return (
    <>
      <Money scope="totals" amountMinor={123456} currency="EUR" fractionDigits={2} />
      <Money amountMinor={-1999} currency="EUR" fractionDigits={2} showSign />
      <button type="button" onClick={() => amounts.toggle('totals')}>
        toggle totals
      </button>
      <button type="button" onClick={() => amounts.toggle('transactions')}>
        toggle transactions
      </button>
    </>
  )
}

function text(): string {
  return document.body.textContent ?? ''
}

describe('maskedMoney', () => {
  it('keeps the currency and leaves no digit to recover', () => {
    const masked = maskedMoney('EUR')
    expect(masked).toContain('€')
    expect(masked).toContain('••••')
    expect(masked).not.toMatch(/\d/)
  })
})

describe('amounts privacy', () => {
  it('shows both scopes by default', () => {
    render(
      <AmountsProvider>
        <Harness />
      </AmountsProvider>,
    )
    expect(text()).toContain('€1,234.56')
    expect(text()).toContain('−€19.99')
  })

  it('hides totals without touching transaction amounts', () => {
    render(
      <AmountsProvider>
        <Harness />
      </AmountsProvider>,
    )
    fireEvent.click(document.querySelectorAll('button')[0])

    expect(text()).not.toContain('1,234.56')
    expect(text()).toContain('€ ••••')
    expect(text()).toContain('Amount hidden')
    expect(text()).toContain('−€19.99')
    expect(localStorage.getItem('myexpenses.hideTotals')).toBe('1')
    expect(document.documentElement.dataset.hiddenTotals).toBe('1')
  })

  it('hides transaction amounts without touching totals', () => {
    render(
      <AmountsProvider>
        <Harness />
      </AmountsProvider>,
    )
    fireEvent.click(document.querySelectorAll('button')[1])

    expect(text()).not.toContain('19.99')
    expect(text()).toContain('€ ••••')
    expect(text()).toContain('€1,234.56')
    expect(localStorage.getItem('myexpenses.hideTransactions')).toBe('1')
    expect(document.documentElement.dataset.hiddenTransactions).toBe('1')
  })

  it('reads the saved state on mount and can undo it', () => {
    localStorage.setItem('myexpenses.hideTotals', '1')
    render(
      <AmountsProvider>
        <Harness />
      </AmountsProvider>,
    )
    expect(text()).not.toContain('1,234.56')

    fireEvent.click(document.querySelectorAll('button')[0])
    expect(text()).toContain('€1,234.56')
    expect(localStorage.getItem('myexpenses.hideTotals')).toBe('0')
  })
})
