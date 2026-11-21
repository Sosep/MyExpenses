import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { AmountsProvider } from '../privacy'
import type { Account, Meta } from '../types'
import { Shell } from './Shell'

i18n.activate('en')

const meta: Meta = {
  appVersion: 'test',
  serverTime: '2026-11-21T10:00:00',
  timeZone: 'Europe/Madrid',
  locale: 'en',
  homeCurrency: 'EUR',
  preferences: { timeEnabled: false, valueDateEnabled: false },
}

const base: Account = {
  id: 1,
  label: 'Everyday',
  type: '2',
  typeName: 'BANK',
  currency: 'EUR',
  fractionDigits: 2,
  openingBalanceMinor: 0,
  currentBalanceMinor: 0,
  totalMinor: 0,
  incomeMinor: 0,
  expensesMinor: 0,
  excludeFromTotals: false,
  sealed: false,
  color: 0,
  parentId: null,
  portfolioRole: 'NONE',
  dynamicExchangeRates: false,
  valuationMinor: null,
}

function renderShell(account: Account) {
  return render(
    <AmountsProvider>
      <Shell
        view="dashboard"
        onView={() => {}}
        accounts={[account]}
        accountId={account.id}
        onAccount={() => {}}
        onNewAccount={() => {}}
        theme="light"
        onTheme={() => {}}
        locale="en"
        locales={[{ value: 'en', label: 'English' }]}
        onLocale={() => {}}
        onLogout={() => {}}
        meta={meta}
      >
        <h1>Overview</h1>
      </Shell>
    </AmountsProvider>,
  )
}

describe('rail by account kind', () => {
  it('keeps budgets and the app data screen for a normal account', () => {
    const { container } = renderShell(base)
    expect(container.querySelector('[data-view="budgets"]')).not.toBeNull()
    expect(container.querySelector('[data-view="datos"]')).not.toBeNull()
  })

  it('hides budgets but still offers the app data screen for a portfolio', () => {
    const { container } = renderShell({
      ...base,
      id: 7,
      portfolioRole: 'CONTAINER',
      type: '6',
      typeName: 'INVESTMENT',
    })
    expect(container.querySelector('[data-view="budgets"]')).toBeNull()
    expect(container.querySelector('[data-view="datos"]')).not.toBeNull()
  })
})
