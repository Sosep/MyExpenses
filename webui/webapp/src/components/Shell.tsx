import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import type { Locale } from '../i18n'
import type { Account, Meta } from '../types'
import { useAmounts } from '../privacy'
import {
  IconChart,
  IconEye,
  IconEyeOff,
  IconFile,
  IconGrid,
  IconList,
  IconLogOut,
  IconMore,
  IconMoon,
  IconPie,
  IconRows,
  IconRowsOff,
  IconSettings,
  IconSun,
} from './Icons'

export type { View } from '../navigation'
import type { View } from '../navigation'

interface ShellProps {
  view: View
  onView: (view: View) => void
  accounts: Account[]
  accountId: number | null
  onAccount: (id: number) => void
  onNewAccount: () => void
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
  onNewAccount,
  theme,
  onTheme,
  locale,
  locales,
  onLocale,
  onLogout,
  meta,
  children,
}: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const amounts = useAmounts()
  const totalsAction = amounts.totals ? t`Show totals` : t`Hide totals`
  const transactionsAction = amounts.transactions
    ? t`Show transaction amounts`
    : t`Hide transaction amounts`

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [menuOpen])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title={`My Expenses ${meta.appVersion}`}>
          <span className="mark">Σ</span>
          <span className="brand-word">My Expenses</span>
        </div>
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
          {view === 'dashboard' || view === 'transactions' || view === 'reports' ? (
            <button
              type="button"
              className="icon-btn"
              onClick={onNewAccount}
              aria-label={t`New account`}
              title={t`New account`}
            >
              +
            </button>
          ) : null}
          <div className="top-inline">
            <div className="top-privacy">
              <button
                type="button"
                className="icon-btn"
                aria-pressed={amounts.totals}
                title={totalsAction}
                aria-label={totalsAction}
                onClick={() => amounts.toggle('totals')}
              >
                {amounts.totals ? <IconEyeOff /> : <IconEye />}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-pressed={amounts.transactions}
                title={transactionsAction}
                aria-label={transactionsAction}
                onClick={() => amounts.toggle('transactions')}
              >
                {amounts.transactions ? <IconRowsOff /> : <IconRows />}
              </button>
            </div>
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
          <div className="more-menu" ref={menuRef}>
            <button
              type="button"
              className="icon-btn"
              aria-label={t`More options`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <IconMore />
            </button>
            {menuOpen ? (
              <div className="menu-panel">
                <label className="menu-field">
                  <span>{t`Language`}</span>
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
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onTheme()
                  }}
                >
                  {theme === 'dark' ? <IconSun /> : <IconMoon />}
                  {theme === 'dark' ? t`Switch to bright` : t`Switch to dark`}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  aria-pressed={amounts.totals}
                  onClick={() => {
                    setMenuOpen(false)
                    amounts.toggle('totals')
                  }}
                >
                  {amounts.totals ? <IconEyeOff /> : <IconEye />}
                  {amounts.totals ? t`Show totals` : t`Hide totals`}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  aria-pressed={amounts.transactions}
                  onClick={() => {
                    setMenuOpen(false)
                    amounts.toggle('transactions')
                  }}
                >
                  {amounts.transactions ? <IconRowsOff /> : <IconRows />}
                  {amounts.transactions
                    ? t`Show transaction amounts`
                    : t`Hide transaction amounts`}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout()
                  }}
                >
                  <IconLogOut />
                  {t`Sign out`}
                </button>
              </div>
            ) : null}
          </div>
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
