import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UiPreferences } from './types'

vi.mock('./api', () => ({
  putUiPreferences: vi.fn().mockResolvedValue({}),
}))

import { putUiPreferences } from './api'
import {
  applyServerPreferences,
  flushUiPreferences,
  localPreferences,
  scheduleUpload,
  startUiPreferencesSync,
  stopUiPreferencesSync,
  STORAGE_KEYS,
} from './uiPreferences'

function server(partial: Partial<UiPreferences>): UiPreferences {
  return {
    theme: null,
    locale: null,
    accountId: null,
    grouping: null,
    hideTotals: null,
    hideTransactions: null,
    reportMonth: null,
    reportRange: null,
    reportBreakdown: null,
    reportType: null,
    reportAllAccounts: null,
    reportTab: null,
    reportPeriod: null,
    reportCustomFrom: null,
    reportCustomTo: null,
    reportCompare: null,
    reportBalanceRange: null,
    reportBalanceFrom: null,
    reportBalanceTo: null,
    reportAccountIds: null,
    budgetMonth: null,
    transactionType: null,
    ...partial,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(putUiPreferences).mockClear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  stopUiPreferencesSync()
  vi.useRealTimers()
})

describe('server preferences', () => {
  it('wins per key and keeps what the server never stored', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light')
    localStorage.setItem(STORAGE_KEYS.grouping, 'MONTH')

    const empty = applyServerPreferences(server({ theme: 'dark', accountId: 4 }))

    expect(empty).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEYS.accountId)).toBe('4')
    expect(localStorage.getItem(STORAGE_KEYS.grouping)).toBe('MONTH')
  })

  it('ignores a value it cannot validate instead of dropping the local one', () => {
    localStorage.setItem(STORAGE_KEYS.grouping, 'WEEK')
    localStorage.setItem(STORAGE_KEYS.reportMonth, '2025-03')

    applyServerPreferences(
      server({
        grouping: 'FORTNIGHT',
        reportMonth: '2026-13',
        accountId: -2,
        hideTotals: 'yes' as unknown as boolean,
      }),
    )

    expect(localStorage.getItem(STORAGE_KEYS.grouping)).toBe('WEEK')
    expect(localStorage.getItem(STORAGE_KEYS.reportMonth)).toBe('2025-03')
    expect(localStorage.getItem(STORAGE_KEYS.accountId)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.hideTotals)).toBeNull()
  })

  it('reports an all-null document so the first contact can seed it', () => {
    expect(applyServerPreferences(server({}))).toBe(true)
  })

  it('reports a missing document as nothing to seed', () => {
    expect(applyServerPreferences(null)).toBe(false)
  })
})

describe('local preferences', () => {
  it('reads the cache with the same validation the screens use', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'neon')
    localStorage.setItem(STORAGE_KEYS.locale, 'fr')
    localStorage.setItem(STORAGE_KEYS.grouping, 'BAD')
    localStorage.setItem(STORAGE_KEYS.reportMonth, '2026-13')
    localStorage.setItem(STORAGE_KEYS.accountId, '-3')
    localStorage.setItem(STORAGE_KEYS.reportAllAccounts, '1')
    document.documentElement.dataset.theme = 'dark'

    expect(localPreferences()).toEqual({ reportAllAccounts: true, theme: 'dark' })
  })

  it('reads the valid values, booleans included', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light')
    localStorage.setItem(STORAGE_KEYS.hideTotals, '0')
    localStorage.setItem(STORAGE_KEYS.hideTransactions, '1')
    localStorage.setItem(STORAGE_KEYS.accountId, '3')

    expect(localPreferences()).toEqual({
      theme: 'light',
      hideTotals: false,
      hideTransactions: true,
      accountId: 3,
    })
  })
})

describe('uploads', () => {
  it('does nothing before the startup merge', () => {
    vi.useFakeTimers()
    scheduleUpload('theme', 'dark')
    vi.advanceTimersByTime(1000)
    expect(putUiPreferences).not.toHaveBeenCalled()
  })

  it('coalesces rapid changes into one partial put', () => {
    vi.useFakeTimers()
    startUiPreferencesSync()
    scheduleUpload('theme', 'dark')
    scheduleUpload('theme', 'light')
    scheduleUpload('grouping', 'YEAR')
    expect(putUiPreferences).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(putUiPreferences).toHaveBeenCalledTimes(1)
    expect(putUiPreferences).toHaveBeenCalledWith({ theme: 'light', grouping: 'YEAR' }, false)
  })

  it('flushes with keepalive when the page goes away', () => {
    startUiPreferencesSync()
    scheduleUpload('hideTotals', true)

    window.dispatchEvent(new Event('pagehide'))

    expect(putUiPreferences).toHaveBeenCalledWith({ hideTotals: true }, true)
  })

  it('does not send an empty body', () => {
    startUiPreferencesSync()
    flushUiPreferences(false)
    expect(putUiPreferences).not.toHaveBeenCalled()
  })
})
