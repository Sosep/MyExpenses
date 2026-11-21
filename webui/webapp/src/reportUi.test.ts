import { describe, expect, it } from 'vitest'
import {
  balanceRange,
  evolutionGrouping,
  isValidDate,
  isValidRange,
  parseReportUrl,
  previousRange,
  reportRange,
  safeRange,
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

describe('custom dates', () => {
  it('only accepts real ISO dates', () => {
    expect(isValidDate('2026-11-21')).toBe(true)
    expect(isValidDate('2026-02-31')).toBe(false)
    expect(isValidDate('')).toBe(false)
    expect(isValidDate('21-11-2026')).toBe(false)
  })

  it('keeps the last usable range while a date input is empty', () => {
    const fallback = { from: '2026-11-01', to: '2026-11-30' }
    expect(safeRange({ from: '', to: '2026-11-21' }, fallback)).toEqual(fallback)
    expect(safeRange({ from: '2026-11-30', to: '2026-11-01' }, fallback)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(isValidRange({ from: '2026-11-01', to: '2026-11-21' })).toBe(true)
  })

  it('reads the report deep link and ignores invalid values', () => {
    expect(
      parseReportUrl(
        '?tab=expenses&period=custom&from=2026-01-01&to=2026-01-31' +
          '&compare=previous&balanceRange=custom&balanceFrom=2026-02-01' +
          '&balanceTo=2026-02-28&balanceMode=perAccount&accountId=2' +
          '&reportAccount=1,2&reportCategory=5',
      ),
    ).toMatchObject({
      tab: 'expenses',
      period: 'custom',
      compare: 'previous',
      custom: { from: '2026-01-01', to: '2026-01-31' },
      balanceRange: 'custom',
      balanceCustom: { from: '2026-02-01', to: '2026-02-28' },
      balanceMode: 'perAccount',
      accountId: 2,
      accountIds: [1, 2],
      categoryIds: [5],
    })
    expect(
      parseReportUrl(
        '?tab=unknown&period=custom&from=2026-02-31&to=2026-01-31&balanceMode=bad',
      ),
    ).toMatchObject({
      tab: null,
      period: 'custom',
      custom: null,
      balanceMode: null,
    })
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
