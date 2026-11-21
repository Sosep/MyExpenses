import type { AccountTypeEntry, Category, CurrencyEntry, Method } from './types'

export const FLAG_EXPENSE = 1
export const FLAG_INCOME = 2

/** The category and every category below it, at any depth. */
export function branchIds(categories: Category[], root: number): number[] {
  const result = [root]
  for (let index = 0; index < result.length; index += 1) {
    const parent = result[index]
    categories
      .filter((category) => category.parentId === parent)
      .forEach((child) => {
        if (!result.includes(child.id)) result.push(child.id)
      })
  }
  return result
}

/** Categories a deletion can move its movements to: everything outside the branch. */
export function remapCandidates(categories: Category[], root: number): Category[] {
  const branch = branchIds(categories, root)
  return categories.filter((category) => !branch.includes(category.id))
}

/** Price history only applies to commodities, never to a fiat currency. */
export function nonFiatCurrencies(currencies: CurrencyEntry[]): CurrencyEntry[] {
  return currencies.filter((currency) => currency.commodityType !== 'FIAT')
}

/**
 * Displays the account types a payment method is limited to. The API stores
 * ids; the list of names comes from /account-types so the table stays readable.
 */
export function accountTypeNames(method: Method, types: AccountTypeEntry[]): string {
  return method.accountTypes
    .map((id) => types.find((entry) => String(entry.id) === id)?.name ?? id)
    .join(', ')
}
