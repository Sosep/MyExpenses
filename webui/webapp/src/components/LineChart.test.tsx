import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { LineChart } from './LineChart'
import type { LineSeries } from './LineChart'

i18n.activate('en')

const series: LineSeries[] = [
  {
    key: 'total',
    label: 'Total',
    color: 'var(--cat-1)',
    points: [
      { date: '2026-11-01', valueMinor: 100000 },
      { date: '2026-11-02', valueMinor: 120000 },
      { date: '2026-11-03', valueMinor: 110000 },
    ],
  },
]

describe('LineChart', () => {
  it('draws one path per visible series and a table alternative', () => {
    const { container } = render(
      <LineChart
        series={series}
        currency="EUR"
        fractionDigits={2}
        ariaLabel="Balance"
        granularity="DAY"
      />,
    )
    expect(container.querySelectorAll('.line-chart-line')).toHaveLength(1)
    expect(screen.getByText('View the data as a table')).toBeTruthy()
    expect(container.querySelectorAll('.chart-data tbody tr')).toHaveLength(3)
  })

  it('toggles a series from the legend', () => {
    const two = [
      ...series,
      {
        key: 'cash',
        label: 'Cash',
        color: 'var(--cat-2)',
        points: series[0].points.map((point) => ({
          date: point.date,
          valueMinor: point.valueMinor / 2,
        })),
      },
    ]
    const { container } = render(
      <LineChart series={two} currency="EUR" fractionDigits={2} ariaLabel="Balance" />,
    )
    expect(container.querySelectorAll('.line-chart-line')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /cash/i }))
    expect(container.querySelectorAll('.line-chart-line')).toHaveLength(1)
  })

  it('shows an empty state instead of an axis without points', () => {
    render(
      <LineChart series={[]} currency="EUR" fractionDigits={2} ariaLabel="Balance" />,
    )
    expect(screen.getByText('No history to draw yet')).toBeTruthy()
  })
})
