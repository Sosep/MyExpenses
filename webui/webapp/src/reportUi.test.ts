import { describe, expect, it } from 'vitest'
import {
  balanceRange,
  evolutionGrouping,
  previousRange,
  reportRange,
  sumLastBalances,
} from './reportUi'

describe('report ranges', () => {
  const now = new Date(2026, 10, 21) // 21 November 2026

  it('builds the preset periods', () => {
    expect(reportRange('month', { from: '', to: '' }, now)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(reportRange('quarter', { from: '', to: '' }, now)).toEqual({
      from: '2026-10-01',
      to: '2026-12-31',
    })
    expect(reportRange('year', { from: '', to: '' }, now)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
    expect(reportRange('lastYear', { from: '', to: '' }, now)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
    expect(reportRange('week', { from: '', to: '' }, now)).toEqual({
      from: '2026-11-16',
      to: '2026-11-21',
    })
  })

  it('uses the custom dates and swaps them when reversed', () => {
    expect(
      reportRange('custom', { from: '2026-03-01', to: '2026-03-31' }, now),
    ).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(
      reportRange('custom', { from: '2026-03-31', to: '2026-03-01' }, now),
    ).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  })

  it('keeps the same number of days for a week that crosses a month', () => {
    expect(previousRange('2026-11-16', '2026-11-22')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    })
  })

  it('maps the balance presets to a range ending today', () => {
    expect(balanceRange('m1', { from: '', to: '' }, now)).toEqual({
      from: '2026-10-21',
      to: '2026-11-21',
    })
    expect(balanceRange('all', { from: '', to: '' }, now).from).toBe('1970-01-01')
  })

  it('adapts the evolution grouping to the range length', () => {
    expect(evolutionGrouping('2026-11-01', '2026-11-30')).toBe('DAY')
    expect(evolutionGrouping('2026-07-01', '2026-11-30')).toBe('WEEK')
    expect(evolutionGrouping('2026-01-01', '2026-11-30')).toBe('MONTH')
    expect(evolutionGrouping('2020-01-01', '2026-11-30')).toBe('YEAR')
  })
})

describe('balance summary', () => {
  it('sums the closing balance of every account the chart draws', () => {
    expect(
      sumLastBalances([
        {
          series: [
            { balanceMinor: 100 },
            { balanceMinor: 1000 },
          ],
        },
        {
          series: [
            { balanceMinor: 200 },
            { balanceMinor: 2500 },
          ],
        },
      ]),
    ).toBe(3500)
  })

  it('keeps a single account unchanged', () => {
    expect(sumLastBalances([{ series: [{ balanceMinor: 4200 }] }])).toBe(4200)
  })
})
