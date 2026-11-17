import type { Group } from './types'
import { addMonths } from './format'

/**
 * Pads a month-by-month series so the chart always draws the same number of
 * columns. Months are matched by year and number: the API sends `second` as a
 * plain number (1-12) while the cursor is zero padded ("2026-01"), so comparing
 * strings would drop every month from January to September.
 */
export function fillSeries(groups: Group[], fromMonth: string, count: number): Group[] {
  const key = (year: number, second: number) => year * 12 + second
  const indexed = new Map(groups.map((group) => [key(group.year, group.second), group]))
  const result: Group[] = []
  let cursor = fromMonth
  for (let index = 0; index < count; index += 1) {
    const [year, second] = cursor.split('-').map(Number)
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
