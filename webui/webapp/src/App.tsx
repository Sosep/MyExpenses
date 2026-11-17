import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { t } from '@lingui/core/macro'
import type { Locale } from './i18n'
import { activateLocale, initialLocale, LOCALES } from './i18n'
import type { Account, Meta } from './types'
import { ApiError, getAccounts, getMeta, login, logout, UNAUTHORIZED_EVENT } from './api'
import { Budgets } from './components/Budgets'
import { Dashboard } from './components/Dashboard'
import { Files } from './components/Files'
import { Login } from './components/Login'
import { Pwa } from './components/Pwa'
import { Reports } from './components/Reports'
import { Shell } from './components/Shell'
import type { View } from './components/Shell'
import { TransactionEditor } from './components/TransactionEditor'
import { Transactions } from './components/Transactions'

type Status = 'checking' | 'login' | 'ready'
type EditorState = { mode: 'create' } | { mode: 'edit'; id: number }

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

export default function App({ initialLocale: initial }: { initialLocale: Locale }) {
  const [status, setStatus] = useState<Status>('checking')
  const [authError, setAuthError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState<number | null>(initialAccountId)
  const [view, setView] = useState<View>('dashboard')
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>(() => initial ?? initialLocale())
  const wasReady = useRef(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    activateLocale(locale)
  }, [locale])

  useEffect(() => {
    wasReady.current = status === 'ready'
  }, [status])

  useEffect(() => {
    const onUnauthorized = () => {
      setStatus('login')
      if (wasReady.current) {
        setAuthError('Your session expired. Sign in again.')
      }
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
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status !== 401) {
          setAuthError(error.message)
        }
        setStatus('login')
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

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

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
    setEditor(null)
    setToast(null)
    setStatus('login')
  }

  function refreshData(message?: string) {
    void queryClient.invalidateQueries()
    getAccounts().then(setAccounts).catch(() => {})
    if (message) setToast(message)
  }

  if (status === 'checking') {
    return (
      <div className="boot">
        <span className="mark">Σ</span>
        <span>{t`Connecting to My Expenses…`}</span>
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
        <span>{t`Loading…`}</span>
      </div>
    )
  }

  const account = accounts.find((candidate) => candidate.id === accountId) ?? accounts[0]

  return (
    <>
      <Shell
        view={view}
        onView={setView}
        accounts={accounts}
        accountId={accountId}
        onAccount={setAccountId}
        theme={theme}
        onTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        locale={locale}
        locales={LOCALES}
        onLocale={setLocale}
        onLogout={handleLogout}
        meta={meta}
      >
        {accounts.length === 0 ? (
          <div className="empty-page">
            <div className="card empty-card">
              <h2>{t`No accounts yet`}</h2>
              <p>{t`Create an account in the Android app and reload this page.`}</p>
            </div>
          </div>
        ) : account ? (
          view === 'dashboard' ? (
            <Dashboard
              account={account}
              onOpenTransactions={() => setView('transactions')}
              onNewTransaction={() => setEditor({ mode: 'create' })}
            />
          ) : view === 'reports' ? (
            <Reports account={account} />
          ) : view === 'files' ? (
            <Files />
          ) : view === 'budgets' ? (
            <Budgets
              accounts={accounts}
              defaultAccountId={account?.id ?? accountId ?? accounts[0]?.id ?? 0}
              onDataChanged={refreshData}
            />
          ) : (
            <Transactions
              account={account}
              onNewTransaction={() => setEditor({ mode: 'create' })}
              onEditTransaction={(id) => setEditor({ mode: 'edit', id })}
              onDataChanged={() => refreshData(t`Transaction deleted.`)}
            />
          )
        ) : (
          <div className="boot">
            <span className="mark">Σ</span>
            <span>{t`Loading…`}</span>
          </div>
        )}
      </Shell>
      {editor ? (
        <TransactionEditor
          mode={editor.mode}
          id={editor.mode === 'edit' ? editor.id : undefined}
          accounts={accounts}
          defaultAccountId={account?.id ?? accountId ?? accounts[0]?.id ?? 0}
          meta={meta}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            refreshData(t`Transaction saved.`)
          }}
        />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      <Pwa />
    </>
  )
}
