import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import type { Group } from '../types'
import { Chart } from './Chart'

i18n.activate('en')

const month = (second: number, incomeMinor: number, expensesMinor?: number): Group => ({
  year: 2026,
  second,
  incomeMinor,
  expensesMinor: expensesMinor as number,
  transfersMinor: 0,
})

function heightOf(bar: Element): number {
  return Number.parseFloat((bar as HTMLElement).style.height || '0')
}

function bars(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.bar'))
}

describe('Chart', () => {
  it('draws a bar pair for every month with data', () => {
    const series = Array.from({ length: 12 }, (_, index) =>
      month(index + 1, 100000 + index * 1000, -(80000 + index * 1000)),
    )
    const { container } = render(
      <Chart series={series} currency="EUR" fractionDigits={2} />,
    )

    expect(container.querySelectorAll('.bar.income')).toHaveLength(12)
    expect(container.querySelectorAll('.bar.expense')).toHaveLength(12)
    for (const bar of bars(container)) {
      expect((bar as HTMLElement).style.height).not.toContain('NaN')
      expect(heightOf(bar)).toBeGreaterThan(0)
    }
  })

  it('keeps drawing when a month arrives without expenses', () => {
    const series = Array.from({ length: 12 }, (_, index) =>
      index === 9
        ? month(index + 1, 120000)
        : month(index + 1, 100000, -(80000 + index * 1000)),
    )
    const { container } = render(
      <Chart series={series} currency="EUR" fractionDigits={2} />,
    )

    expect(container.querySelector('.chart')).not.toBeNull()
    expect(bars(container).some((bar) => heightOf(bar) > 0)).toBe(true)
    for (const bar of bars(container)) {
      expect((bar as HTMLElement).style.height).not.toContain('NaN')
      expect(heightOf(bar)).toBeGreaterThanOrEqual(0)
    }
  })

  it('shows the empty state only when every month is zero', () => {
    const series = Array.from({ length: 12 }, (_, index) => month(index + 1, 0, 0))
    const { container } = render(
      <Chart series={series} currency="EUR" fractionDigits={2} />,
    )

    expect(container.querySelector('.chart')).toBeNull()
    expect(container.querySelector('.empty')).not.toBeNull()
  })
})
