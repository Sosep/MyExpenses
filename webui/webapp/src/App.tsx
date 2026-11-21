import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { t } from '@lingui/core/macro'
import {
  accountFromUrl,
  readView,
  searchOf,
  searchWithAccount,
  useHistoryPanel,
  viewUrl,
} from './navigation'
import type { Locale } from './i18n'
import { activateLocale, i18n, initialLocale, LOCALES } from './i18n'
import type { Account, Meta, UiPreferences } from './types'
import { topLevelAccounts } from './accountUi'
import {
  ApiError,
  describeError,
  getAccounts,
  getMeta,
  getUiPreferences,
  login,
  logout,
  UNAUTHORIZED_EVENT,
} from './api'
import {
  applyServerPreferences,
  scheduleUpload,
  startUiPreferencesSync,
  STORAGE_KEYS,
  uploadLocalPreferences,
} from './uiPreferences'
import { AccountEditor } from './components/AccountEditor'
import { AppData } from './components/AppData'
import { Budgets } from './components/Budgets'
import { Dashboard } from './components/Dashboard'
import { Files } from './components/Files'
import { Login } from './components/Login'
import { Pwa } from './components/Pwa'
import { AmountsProvider } from './privacy'
import { ReportsSection } from './components/reports/ReportsSection'
import { Shell } from './components/Shell'
import type { View } from './components/Shell'
import { TradeEditor } from './components/TradeEditor'
import { Trades } from './components/Trades'
import { TransactionEditor } from './components/TransactionEditor'
import { Transactions } from './components/Transactions'

type Status = 'checking' | 'login' | 'ready'
type EditorState = { mode: 'create' } | { mode: 'edit'; id: number }
type TradeEditorState = { mode: 'create' } | { mode: 'edit'; id: number }

const THEME_KEY = STORAGE_KEYS.theme
const ACCOUNT_KEY = STORAGE_KEYS.accountId

function initialTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function initialAccountId(): number | null {
  // A link that names an account wins over the one this browser remembered:
  // that is how a budget of another account opens its own movements.
  const fromUrl = accountFromUrl(window.location.search)
  if (fromUrl !== null) return fromUrl
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
  const [tradeEditor, setTradeEditor] = useState<TradeEditorState | null>(null)
  const [accountEditor, setAccountEditor] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Activate before the first render: an effect runs after children have
    // already produced English strings, which left the rail in English while
    // Spanish data blocks re-rendered later.
    const value = initial ?? initialLocale()
    i18n.activate(value)
    return value
  })
  const setLocale = useCallback((next: Locale) => {
    i18n.activate(next)
    setLocaleState(next)
  }, [])
  const wasReady = useRef(false)
  // A newly created account may not be in the list until the refetch lands;
  // the auto-selection effect must not bounce back to the first account.
  const pendingAccount = useRef<number | null>(null)

  // Back/forward rehydrate the view from the URL; changing the view pushes an
  // entry so the browser's back button returns to the previous screen. The
  // account travels in the URL too, so a link to another account's movements
  // survives back, forward and a reload.
  useEffect(() => {
    const onPopState = () => {
      setViewState(readView(window.location.search))
      const fromUrl = accountFromUrl(window.location.search)
      if (fromUrl !== null) setAccountId(fromUrl)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function setView(next: View) {
    if (next === view) return
    let url = viewUrl(window.location.search, next)
    // Report filters are not transaction filters. Leaving the section must not
    // leave `categoryId`/`tab` behind for the list or Datos to interpret.
    if (view === 'reports' && next !== 'reports') {
      const params = new URLSearchParams(searchOf(url))
      for (const key of [
        'tab',
        'period',
        'compare',
        'balanceRange',
        'balanceMode',
        'reportAccount',
        'reportCategory',
        'from',
        'to',
        'balanceFrom',
        'balanceTo',
      ]) {
        params.delete(key)
      }
      const query = params.toString()
      url = query ? `${window.location.pathname}?${query}` : window.location.pathname
    }
    window.history.pushState(null, '', url)
    setViewState(next)
  }

  /** A screen asks for a URL it built (filters and account included): follow it. */
  function navigate(url: string) {
    const search = searchOf(url)
    window.history.pushState(null, '', url)
    setViewState(readView(search))
    const fromUrl = accountFromUrl(search)
    if (fromUrl !== null) setAccountId(fromUrl)
  }
  const queryClient = useQueryClient()

  /**
   * Merges the phone's copy before the shell renders: the server wins per key,
   * an absent key keeps the local one. `?accountId=` still beats the remembered
   * account, because a link must open the account it names.
   */
  function adoptUiPreferences(server: UiPreferences | null) {
    const needsSeed = applyServerPreferences(server)
    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme)
    const storedLocale = localStorage.getItem(STORAGE_KEYS.locale)
    if (storedLocale === 'en' || storedLocale === 'es') setLocale(storedLocale)
    const storedAccount = Number(localStorage.getItem(ACCOUNT_KEY))
    if (
      accountFromUrl(window.location.search) === null &&
      Number.isInteger(storedAccount) &&
      storedAccount > 0
    ) {
      setAccountId(storedAccount)
    }
    // Choices made before this feature shipped migrate on the first contact.
    if (needsSeed) uploadLocalPreferences()
    startUiPreferencesSync()
  }

  useEffect(() => {
    activateLocale(locale)
  }, [locale])

  useEffect(() => {
    wasReady.current = status === 'ready'
  }, [status])

  // Called before the early returns so the hook order never changes.
  const closeEditor = useHistoryPanel(editor !== null, () => setEditor(null))
  const closeTradeEditor = useHistoryPanel(tradeEditor !== null, () => setTradeEditor(null))

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
    // A missing UI-preferences resource (older server, no session yet, network
    // hiccup) must not keep the app from opening with its local cache.
    Promise.all([getMeta(), getAccounts(), getUiPreferences().catch(() => null)])
      .then(([nextMeta, nextAccounts, serverPreferences]) => {
        if (cancelled) return
        adoptUiPreferences(serverPreferences)
        setMeta(nextMeta)
        setAccounts(topLevelAccounts(nextAccounts))
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
    scheduleUpload('theme', theme)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B0D12' : '#FFFFFF')
  }, [theme])

  useEffect(() => {
    if (accounts.length === 0) return
    if (accountId === null) {
      setAccountId(accounts[0].id)
    } else if (!accounts.some((account) => account.id === accountId)) {
      // Wait for the refetch that will bring the account just created.
      if (pendingAccount.current === accountId) return
      setAccountId(accounts[0].id)
    } else if (pendingAccount.current === accountId) {
      pendingAccount.current = null
    }
  }, [accounts, accountId])

  useEffect(() => {
    if (accountId !== null) {
      localStorage.setItem(ACCOUNT_KEY, String(accountId))
      scheduleUpload('accountId', accountId)
    }
  }, [accountId])

  // The account is in the URL from the moment it is known, so the topbar and a
  // link a screen built (`?accountId=`) never disagree. `replaceState` keeps
  // the choice out of the history: the drill-down is one entry, not two.
  useEffect(() => {
    if (accountId === null) return
    const search = window.location.search
    const next = searchWithAccount(search, accountId)
    if (next === search) return
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${next}`)
  }, [accountId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleLogin(password: string) {
    const nextMeta = await login(password)
    const [nextAccounts, serverPreferences] = await Promise.all([
      getAccounts(),
      getUiPreferences().catch(() => null),
    ])
    adoptUiPreferences(serverPreferences)
    setMeta(nextMeta)
    setAccounts(topLevelAccounts(nextAccounts))
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
    getAccounts()
      .then((next) => setAccounts(topLevelAccounts(next)))
      .catch(() => {})
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
  // A portfolio shows the operations screens: budgets need categories a
  // portfolio does not track, so the overview takes their rail slot.
  const isPortfolio = account?.portfolioRole === 'CONTAINER'
  const activeView: View = isPortfolio && view === 'budgets' ? 'dashboard' : view

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
        {activeView === 'datos' ? (
          <AppData />
        ) : accounts.length === 0 ? (
          <div className="empty-page">
            <div className="card empty-card">
              <h2>{t`No accounts yet`}</h2>
              <p>{t`Create an account in the Android app and reload this page.`}</p>
            </div>
          </div>
        ) : account ? (
          activeView === 'dashboard' ? (
            <Dashboard
              account={account}
              onOpenTransactions={() => setView('transactions')}
              onNewTransaction={() => setEditor({ mode: 'create' })}
            />
          ) : activeView === 'reports' ? (
            <ReportsSection
              accounts={accounts}
              homeCurrency={meta.homeCurrency}
              onNavigate={navigate}
            />
          ) : activeView === 'files' ? (
            <Files />
          ) : activeView === 'budgets' ? (
            <Budgets
              accounts={accounts}
              defaultAccountId={account?.id ?? accountId ?? accounts[0]?.id ?? 0}
              onDataChanged={refreshData}
              onNavigate={navigate}
            />
          ) : isPortfolio ? (
            <Trades
              account={account}
              onNewTrade={() => setTradeEditor({ mode: 'create' })}
              onEditTrade={(id) => setTradeEditor({ mode: 'edit', id })}
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
          homeCurrency={meta?.homeCurrency ?? 'EUR'}
          onClose={() => setAccountEditor(false)}
          onSaved={(created, kind) => {
            setAccountEditor(false)
            pendingAccount.current = created.id
            setAccountId(created.id)
            refreshData(
              kind === 'portfolio' ? t`Portfolio created.` : t`Account created.`,
            )
          }}
        />
      ) : null}
      {(view === 'dashboard' || view === 'transactions') && accounts.length > 0 ? (
        <button
          type="button"
          className="fab"
          aria-label={isPortfolio ? t`New operation` : t`New transaction`}
          onClick={() =>
            isPortfolio
              ? setTradeEditor({ mode: 'create' })
              : setEditor({ mode: 'create' })
          }
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
      {tradeEditor && account ? (
        <TradeEditor
          mode={tradeEditor.mode}
          id={tradeEditor.mode === 'edit' ? tradeEditor.id : undefined}
          account={account}
          accounts={accounts}
          meta={meta}
          onClose={closeTradeEditor}
          onSaved={() => {
            closeTradeEditor()
            refreshData(t`Operation saved.`)
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
