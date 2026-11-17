import type { Group } from './types'
import { addMonths } from './format'

/**
 * Pads a month-by-month series so the chart always draws the same number of
 * columns. The API numbers months 0-11 (`second`: November is 10) while the UI
 * keeps `YYYY-MM` cursors (1-12), so the cursor is converted to a 0-based index
 * before matching. Comparing the two conventions directly drops every month,
 * which is why the dashboard used to show zeros with real data.
 */
export function fillSeries(groups: Group[], fromMonth: string, count: number): Group[] {
  const key = (year: number, second: number) => year * 12 + second
  const indexed = new Map(groups.map((group) => [key(group.year, group.second), group]))
  const result: Group[] = []
  let cursor = fromMonth
  for (let index = 0; index < count; index += 1) {
    const [year, monthNumber] = cursor.split('-').map(Number)
    const second = monthNumber - 1
    result.push(
      indexed.get(key(year, second)) ?? {
        year,
        second,
        incomeMinor: 0,
        expensesMinor: 0,
        transfersMinor: 0,
      },
    )
    cursor = addMonths(cursor, 1)
  }
  return result
}
