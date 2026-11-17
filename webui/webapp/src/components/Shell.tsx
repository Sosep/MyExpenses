import type { ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import type { Locale } from '../i18n'
import type { Account, Meta } from '../types'
import {
  IconChart,
  IconFile,
  IconGrid,
  IconList,
  IconLogOut,
  IconMoon,
  IconPie,
  IconSettings,
  IconSun,
} from './Icons'

export type View = 'dashboard' | 'transactions' | 'reports' | 'budgets' | 'files'

interface ShellProps {
  view: View
  onView: (view: View) => void
  accounts: Account[]
  accountId: number | null
  onAccount: (id: number) => void
  theme: 'light' | 'dark'
  onTheme: () => void
  locale: Locale
  locales: readonly { value: Locale; label: string }[]
  onLocale: (locale: Locale) => void
  onLogout: () => void
  meta: Meta
  children: ReactNode
}

export function Shell({
  view,
  onView,
  accounts,
  accountId,
  onAccount,
  theme,
  onTheme,
  locale,
  locales,
  onLocale,
  onLogout,
  meta,
  children,
}: ShellProps) {
  const crumb =
    view === 'dashboard'
      ? t`Overview`
      : view === 'files'
        ? t`Files`
        : view === 'budgets'
          ? t`Budgets`
          : view === 'reports'
            ? t`Reports`
            : t`Transactions`

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title={`My Expenses ${meta.appVersion}`}>
          <span className="mark">Σ</span>
          <span className="brand-word">My Expenses</span>
        </div>
        <span className="crumb">{crumb}</span>
        <div className="top-right">
          {view === 'dashboard' || view === 'transactions' || view === 'reports' ? (
            <label className="account-picker">
              <span className="sr-only">{t`Account`}</span>
              <select
                className="account-select"
                value={accountId ?? ''}
                onChange={(event) => onAccount(Number(event.target.value))}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="account-picker locale-picker">
            <span className="sr-only">{t`Language`}</span>
            <select
              className="account-select"
              aria-label={t`Language`}
              value={locale}
              onChange={(event) => onLocale(event.target.value as Locale)}
            >
              {locales.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-btn"
            onClick={onTheme}
            title={theme === 'dark' ? t`Switch to bright` : t`Switch to dark`}
            aria-label={theme === 'dark' ? t`Switch to bright` : t`Switch to dark`}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onLogout}
            title={t`Sign out`}
            aria-label={t`Sign out`}
          >
            <IconLogOut />
          </button>
        </div>
      </header>
      <div className="body">
        <nav className="rail" aria-label={t`Sections`}>
          <button
            type="button"
            className={`rail-item ${view === 'dashboard' ? 'active' : ''}`}
            data-view="dashboard"
            onClick={() => onView('dashboard')}
            title={t`Overview`}
            aria-label={t`Overview`}
            aria-current={view === 'dashboard' ? 'page' : undefined}
          >
            <IconGrid />
            <span className="rail-label">{t`Overview`}</span>
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'transactions' ? 'active' : ''}`}
            data-view="transactions"
            onClick={() => onView('transactions')}
            title={t`Transactions`}
            aria-label={t`Transactions`}
            aria-current={view === 'transactions' ? 'page' : undefined}
          >
            <IconList />
            <span className="rail-label">{t`Transactions`}</span>
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'reports' ? 'active' : ''}`}
            data-view="reports"
            onClick={() => onView('reports')}
            title={t`Reports`}
            aria-label={t`Reports`}
            aria-current={view === 'reports' ? 'page' : undefined}
          >
            <IconChart />
            <span className="rail-label">{t`Reports`}</span>
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'budgets' ? 'active' : ''}`}
            data-view="budgets"
            onClick={() => onView('budgets')}
            title={t`Budgets`}
            aria-label={t`Budgets`}
            aria-current={view === 'budgets' ? 'page' : undefined}
          >
            <IconPie />
            <span className="rail-label">{t`Budgets`}</span>
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'files' ? 'active' : ''}`}
            data-view="files"
            onClick={() => onView('files')}
            title={t`Files`}
            aria-label={t`Files`}
            aria-current={view === 'files' ? 'page' : undefined}
          >
            <IconFile />
            <span className="rail-label">{t`Files`}</span>
          </button>
          <div className="rail-spacer" />
          <button
            type="button"
            className="rail-item"
            disabled
            title={t`Settings (next milestone)`}
            aria-label={t`Settings (next milestone)`}
          >
            <IconSettings />
          </button>
        </nav>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
