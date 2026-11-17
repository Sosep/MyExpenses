import { describe, expect, it } from 'vitest'
import { fillSeries } from './series'
import type { Group } from './types'

// The API counts months 0-11: November is 10. Fixtures must use the same
// convention, otherwise the series never matches the server response.
const group = (year: number, second: number, incomeMinor = 1000): Group => ({
  year,
  second,
  incomeMinor,
  expensesMinor: -500,
  transfersMinor: 0,
})

describe('fillSeries', () => {
  it('matches the API month index (0-11) month by month', () => {
    const groups = [
      group(2025, 11, 2800),
      group(2026, 0, 2900),
      group(2026, 1, 3000),
      group(2026, 9, 3100),
      group(2026, 10, 3200),
    ]
    const series = fillSeries(groups, '2025-12', 12)

    expect(series).toHaveLength(12)
    expect(series.map((item) => item.incomeMinor)).toEqual([
      2800, 2900, 3000, 0, 0, 0, 0, 0, 0, 0, 3100, 3200,
    ])
  })

  it('walks forward with 0-11 second values', () => {
    const series = fillSeries([], '2026-11', 3)

    expect(series.map((item) => [item.year, item.second])).toEqual([
      [2026, 10],
      [2026, 11],
      [2027, 0],
    ])
  })

  it('never reuses a group from another year with the same month number', () => {
    const series = fillSeries([group(2025, 11, 999)], '2026-11', 1)

    expect(series[0]?.incomeMinor).toBe(0)
  })
})
