import { describe, expect, it } from 'vitest'
import { fillSeries } from './series'
import type { Group } from './types'

const group = (year: number, second: number, incomeMinor = 1000): Group => ({
  year,
  second,
  incomeMinor,
  expensesMinor: -500,
  transfersMinor: 0,
})

describe('fillSeries', () => {
  it('keeps the data for every month, not only for the padded ones', () => {
    const groups = [
      group(2025, 12, 2800),
      group(2026, 1, 2900),
      group(2026, 2, 3000),
      group(2026, 10, 3100),
      group(2026, 11, 3200),
    ]
    const series = fillSeries(groups, '2025-12', 12)

    expect(series).toHaveLength(12)
    expect(series.map((item) => item.incomeMinor)).toEqual([
      2800, 2900, 3000, 0, 0, 0, 0, 0, 0, 0, 3100, 3200,
    ])
  })

  it('starts at the requested month and walks forward', () => {
    const series = fillSeries([], '2026-11', 3)

    expect(series.map((item) => `${item.year}-${item.second}`)).toEqual([
      '2026-11',
      '2026-12',
      '2027-1',
    ])
  })

  it('never reuses a group from another year with the same month number', () => {
    const series = fillSeries([group(2025, 11, 999)], '2026-11', 1)

    expect(series[0]?.incomeMinor).toBe(0)
  })
})
