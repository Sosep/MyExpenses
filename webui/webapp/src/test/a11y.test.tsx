import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import { Login } from '../components/Login'
import { Shell } from '../components/Shell'
import { i18n } from '../i18n'
import type { Account, Meta } from '../types'

i18n.activate('es')

const meta: Meta = {
  appVersion: 'test',
  androidVersion: 'test',
  fractionDigits: 2,
  currency: 'EUR',
  homeCurrency: 'EUR',
} as Meta

const accounts: Account[] = [
  {
    id: 1,
    label: 'Everyday',
    currency: 'EUR',
    fractionDigits: 2,
    currentBalanceMinor: 421080,
  } as Account,
]

/**
 * axe-core cannot check colour contrast without a layout engine, so that rule is
 * off here; contrast is verified with the token maths in the spec.
 */
async function seriousViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
}

describe('accessibility', () => {
  it('renders the sign in screen without serious violations', async () => {
    const { container } = render(<Login onSubmit={async () => {}} error={null} />)

    expect(await seriousViolations(container)).toEqual([])
  })

  it('renders the shell without serious violations', async () => {
    const { container } = render(
      <Shell
        view="dashboard"
        onView={() => {}}
        accounts={accounts}
        accountId={1}
        onAccount={() => {}}
        theme="light"
        onTheme={() => {}}
        locale="es"
        locales={[
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
        ]}
        onLocale={() => {}}
        onLogout={() => {}}
        meta={meta}
      >
        <h1>Resumen</h1>
      </Shell>,
    )

    expect(await seriousViolations(container)).toEqual([])
  })
})
