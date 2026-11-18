import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { t } from '@lingui/core/macro'
import { readView, searchOf, useHistoryPanel, viewUrl } from './navigation'
import type { Locale } from './i18n'
import { activateLocale, initialLocale, LOCALES } from './i18n'
import type { Account, Meta } from './types'
import { ApiError, describeError, getAccounts, getMeta, login, logout, UNAUTHORIZED_EVENT } from './api'
import { AccountEditor } from './components/AccountEditor'
import { Budgets } from './components/Budgets'
import { Dashboard } from './components/Dashboard'
import { Files } from './components/Files'
import { Login } from './components/Login'
import { Pwa } from './components/Pwa'
import { AmountsProvider } from './privacy'
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
  const [view, setViewState] = useState<View>(() => readView(window.location.search))
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [accountEditor, setAccountEditor] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>(() => initial ?? initialLocale())
  const wasReady = useRef(false)

  // Back/forward rehydrate the view from the URL; changing the view pushes an
  // entry so the browser's back button returns to the previous screen.
  useEffect(() => {
    const onPopState = () => setViewState(readView(window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function setView(next: View) {
    if (next === view) return
    window.history.pushState(null, '', viewUrl(window.location.search, next))
    setViewState(next)
  }

  /** A screen asks for a URL it built (filters included): push and follow it. */
  function navigate(url: string) {
    window.history.pushState(null, '', url)
    setViewState(readView(searchOf(url)))
  }
  const queryClient = useQueryClient()

  useEffect(() => {
    activateLocale(locale)
  }, [locale])

  useEffect(() => {
    wasReady.current = status === 'ready'
  }, [status])

  // Called before the early returns so the hook order never changes.
  const closeEditor = useHistoryPanel(editor !== null, () => setEditor(null))

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
          setAuthError(describeError(error))
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B0D12' : '#FFFFFF')
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
    <AmountsProvider>
      <Shell
        view={view}
        onView={setView}
        accounts={accounts}
        accountId={accountId}
        onAccount={setAccountId}
        onNewAccount={() => setAccountEditor(true)}
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
            <Reports account={account} accounts={accounts} />
          ) : view === 'files' ? (
            <Files />
          ) : view === 'budgets' ? (
            <Budgets
              accounts={accounts}
              defaultAccountId={account?.id ?? accountId ?? accounts[0]?.id ?? 0}
              onDataChanged={refreshData}
              onNavigate={navigate}
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
      {accountEditor ? (
        <AccountEditor
          currencies={[
            ...new Set([...(meta ? [meta.homeCurrency] : []), ...accounts.map((item) => item.currency)]),
          ]}
          defaultCurrency={account?.currency ?? meta?.homeCurrency ?? 'EUR'}
          onClose={() => setAccountEditor(false)}
          onSaved={(created) => {
            setAccountEditor(false)
            setAccountId(created.id)
            refreshData(t`Account created.`)
          }}
        />
      ) : null}
      {(view === 'dashboard' || view === 'transactions') && accounts.length > 0 ? (
        <button
          type="button"
          className="fab"
          aria-label={t`New transaction`}
          onClick={() => setEditor({ mode: 'create' })}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}
      {editor ? (
        <TransactionEditor
          mode={editor.mode}
          id={editor.mode === 'edit' ? editor.id : undefined}
          accounts={accounts}
          defaultAccountId={account?.id ?? accountId ?? accounts[0]?.id ?? 0}
          meta={meta}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
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
    </AmountsProvider>
  )
}
