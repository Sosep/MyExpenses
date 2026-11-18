import { describe, expect, it } from 'vitest'
import { accountFromUrl, searchWithAccount } from './navigation'

describe('account in the URL', () => {
  it('reads a usable id and ignores the rest', () => {
    expect(accountFromUrl('?accountId=2&view=transactions')).toBe(2)
    expect(accountFromUrl('?accountId=0')).toBeNull()
    expect(accountFromUrl('?accountId=-1')).toBeNull()
    expect(accountFromUrl('?accountId=abc')).toBeNull()
    expect(accountFromUrl('?accountId=')).toBeNull()
    expect(accountFromUrl('?view=transactions')).toBeNull()
  })

  it('writes the account without losing the view, the filters or the range', () => {
    const params = new URLSearchParams(
      searchWithAccount(
        '?view=transactions&categoryId=5&preset=custom&from=2026-11-01&to=2026-11-30',
        2,
      ),
    )
    expect(params.get('accountId')).toBe('2')
    expect(params.get('view')).toBe('transactions')
    expect(params.getAll('categoryId')).toEqual(['5'])
    expect(params.get('preset')).toBe('custom')
    expect(params.get('from')).toBe('2026-11-01')
    expect(params.get('to')).toBe('2026-11-30')
  })

  it('replaces an earlier account and can drop it', () => {
    const replaced = new URLSearchParams(searchWithAccount('?accountId=1&view=reports', 3))
    expect(replaced.get('accountId')).toBe('3')
    expect(replaced.get('view')).toBe('reports')
    expect(searchWithAccount('?accountId=1', null)).toBe('')
  })
})
