import type { ReactNode } from 'react'
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

export type View = 'dashboard' | 'transactions' | 'budgets' | 'files'

interface ShellProps {
  view: View
  onView: (view: View) => void
  accounts: Account[]
  accountId: number | null
  onAccount: (id: number) => void
  theme: 'light' | 'dark'
  onTheme: () => void
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
  onLogout,
  meta,
  children,
}: ShellProps) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title={`My Expenses ${meta.appVersion}`}>
          <span className="mark">Σ</span>
          <span>My Expenses</span>
        </div>
        <span className="crumb">
          {view === 'dashboard'
            ? 'Overview'
            : view === 'files'
              ? 'Files'
              : view === 'budgets'
                ? 'Budgets'
                : 'Transactions'}
        </span>
        <div className="top-right">
          {view === 'dashboard' || view === 'transactions' ? (
            <label className="account-picker">
              <span className="sr-only">Account</span>
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
          <button
            type="button"
            className="icon-btn"
            onClick={onTheme}
            title={theme === 'dark' ? 'Switch to bright' : 'Switch to dark'}
            aria-label={theme === 'dark' ? 'Switch to bright' : 'Switch to dark'}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <IconLogOut />
          </button>
        </div>
      </header>
      <div className="body">
        <nav className="rail" aria-label="Sections">
          <button
            type="button"
            className={`rail-item ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => onView('dashboard')}
            title="Overview"
            aria-label="Overview"
            aria-current={view === 'dashboard' ? 'page' : undefined}
          >
            <IconGrid />
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'transactions' ? 'active' : ''}`}
            onClick={() => onView('transactions')}
            title="Transactions"
            aria-label="Transactions"
            aria-current={view === 'transactions' ? 'page' : undefined}
          >
            <IconList />
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'files' ? 'active' : ''}`}
            onClick={() => onView('files')}
            title="Files"
            aria-label="Files"
            aria-current={view === 'files' ? 'page' : undefined}
          >
            <IconFile />
          </button>
          <button
            type="button"
            className="rail-item"
            disabled
            title="Reports (next milestone)"
            aria-label="Reports (next milestone)"
          >
            <IconChart />
          </button>
          <button
            type="button"
            className={`rail-item ${view === 'budgets' ? 'active' : ''}`}
            onClick={() => onView('budgets')}
            title="Budgets"
            aria-label="Budgets"
            aria-current={view === 'budgets' ? 'page' : undefined}
          >
            <IconPie />
          </button>
          <div className="rail-spacer" />
          <button
            type="button"
            className="rail-item"
            disabled
            title="Settings (next milestone)"
            aria-label="Settings (next milestone)"
          >
            <IconSettings />
          </button>
        </nav>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
