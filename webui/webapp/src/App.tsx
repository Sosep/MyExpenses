import { useEffect, useState } from 'react'
import type { Account, Meta } from './types'
import { getAccounts, getMeta, hasStoredAuth, login, logout, UNAUTHORIZED_EVENT } from './api'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import type { View } from './components/Shell'
import { Transactions } from './components/Transactions'

type Status = 'checking' | 'login' | 'ready'

const THEME_KEY = 'myexpenses.theme'
const ACCOUNT_KEY = 'myexpenses.accountId'

function initialTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function initialAccountId(): number | null {
  const stored = localStorage.getItem(ACCOUNT_KEY)
  if (!stored) return null
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : null
}

export default function App() {
  const [status, setStatus] = useState<Status>(hasStoredAuth() ? 'checking' : 'login')
  const [authError, setAuthError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<number | null>(initialAccountId)
  const [view, setView] = useState<View>('dashboard')
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)

  useEffect(() => {
    const onUnauthorized = () => {
      setStatus('login')
      setAuthError('Your session expired. Sign in again.')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  useEffect(() => {
    if (status !== 'checking') return
    let cancelled = false
    Promise.all([getMeta(), getAccounts()])
      .then(([nextMeta, nextAccounts]) => {
        if (cancelled) return
        setMeta(nextMeta)
        setAccounts(nextAccounts)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('login')
      })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (accounts.length === 0) return
    if (accountId === null || !accounts.some((account) => account.id === accountId)) {
      setAccountId(accounts[0].id)
    }
  }, [accounts, accountId])

  useEffect(() => {
    if (accountId !== null) {
      localStorage.setItem(ACCOUNT_KEY, String(accountId))
    }
  }, [accountId])

  async function handleLogin(password: string) {
    const nextMeta = await login(password)
    const nextAccounts = await getAccounts()
    setMeta(nextMeta)
    setAccounts(nextAccounts)
    setAuthError(null)
    setStatus('ready')
  }

  function handleLogout() {
    logout()
    setMeta(null)
    setAccounts([])
    setAuthError(null)
    setStatus('login')
  }

  if (status === 'checking') {
    return (
      <div className="boot">
        <span className="mark">Σ</span>
        <span>Connecting to My Expenses…</span>
      </div>
    )
  }

  if (status === 'login') {
    return <Login onSubmit={handleLogin} error={authError} />
  }

  if (!meta) {
    return (
      <div className="boot">
        <span className="mark">Σ</span>
        <span>Loading…</span>
      </div>
    )
  }

  const account = accounts.find((candidate) => candidate.id === accountId) ?? accounts[0]

  return (
    <Shell
      view={view}
      onView={setView}
      accounts={accounts}
      accountId={accountId}
      onAccount={setAccountId}
      theme={theme}
      onTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      onLogout={handleLogout}
      meta={meta}
    >
      {accounts.length === 0 ? (
        <div className="empty-page">
          <div className="card empty-card">
            <h2>No accounts yet</h2>
            <p>Create an account in the Android app and reload this page.</p>
          </div>
        </div>
      ) : account ? (
        view === 'dashboard' ? (
          <Dashboard account={account} onOpenTransactions={() => setView('transactions')} />
        ) : (
          <Transactions account={account} />
        )
      ) : (
        <div className="boot">
          <span className="mark">Σ</span>
          <span>Loading…</span>
        </div>
      )}
    </Shell>
  )
}
