import { useEffect, useMemo, useState } from 'react'
import type { Account, Transaction } from '../types'
import { describeError, getCategories, getGrouped, getMethods, getPayees, getTags, getTransactions } from '../api'
import {
  addMonths,
  currentMonth,
  formatDate,
  formatMoney,
  formatMonth,
  categoryPathMap,
  kindLabel,
  monthRange,
  statusClass,
  statusLabel,
} from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { IconChevronLeft, IconChevronRight } from './Icons'
import { SearchSelect } from './SearchSelect'
import { NO_FILTERS, filtersFromUrl, searchWithFilters } from '../filters'
import type { Filters } from '../filters'
import { TransactionPanel } from './TransactionPanel'

interface TransactionsProps {
  account: Account
  onNewTransaction: () => void
  onEditTransaction: (id: number) => void
  onDataChanged: () => void
}

type TypeFilter = 'all' | 'income' | 'expense'

function description(transaction: Transaction): string {
  if (transaction.payee?.label) return transaction.payee.label
  if (transaction.comment) return transaction.comment
  return kindLabel(transaction.kind)
}

function amountClass(transaction: Transaction): string {
  if (transaction.kind === 'TRANSFER') return 'amount-neutral'
  return transaction.amountMinor > 0 ? 'amount-pos' : 'amount-neg'
}

export function Transactions({
  account,
  onNewTransaction,
  onEditTransaction,
  onDataChanged,
}: TransactionsProps) {
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState<TypeFilter>('all')
  const [filters, setFilters] = useState<Filters>(() => filtersFromUrl(window.location.search))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [extra, setExtra] = useState<Transaction[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const range = monthRange(month)
  const apiType = type === 'all' ? 'both' : type
  const filtersKey = JSON.stringify(filters)
  const hasFilters = Object.values(filters).some((value) => value !== null)
  const activeFilterCount = Object.values(filters).filter((value) => value !== null).length

  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${searchWithFilters(window.location.search, filters)}`,
    )
  }, [filters])
  const references = useAsync(async () => {
    const [categories, payees, tags, methods] = await Promise.all([
      getCategories(),
      getPayees(),
      getTags(),
      getMethods(),
    ])
    return { categories, payees, tags, methods }
  }, ['transaction-references'])
  const paths = useMemo(
    () => categoryPathMap(references.data?.categories ?? []),
    [references.data?.categories],
  )
  const categoryOptions = useMemo(
    () => [
      { value: '', label: t`All` },
      ...(references.data?.categories ?? [])
        .slice()
        .sort((left, right) =>
          (paths.get(left.id) ?? left.label).localeCompare(
            paths.get(right.id) ?? right.label,
          ),
        )
        .map((category) => ({
          value: String(category.id),
          label: paths.get(category.id) ?? category.label,
        })),
    ],
    [references.data?.categories, paths],
  )
  const chips = useMemo(() => {
    const list = [
      ['categoryId', 'categories'],
      ['payeeId', 'payees'],
      ['tagId', 'tags'],
      ['methodId', 'methods'],
    ] as const
    return list.flatMap(([key, source]) => {
      const id = filters[key]
      if (id === null) return []
      const item = (references.data?.[source] ?? []).find((entry) => entry.id === id)
      const text = item && 'label' in item ? item.label : item && 'name' in item ? item.name : null
      const label = key === 'categoryId' ? (paths.get(id) ?? text ?? String(id)) : (text ?? String(id))
      return [{ key, label }]
    })
  }, [filters, references.data, paths])

  const summary = useAsync(
    () => getGrouped(account.id, range.from, range.to),
    ['transaction-summary', account.id, range.from, range.to],
  )
  const page = useAsync(
    () => getTransactions(account.id, range.from, range.to, apiType, 50, 0, filters),
    ['transaction-page', account.id, range.from, range.to, apiType, filtersKey],
  )

  useEffect(() => {
    setExtra([])
    setMoreError(null)
    setSelectedId(null)
  }, [account.id, month, type, filtersKey])

  const [year, monthNumber] = month.split('-').map(Number)
  const items = [...(page.data?.items ?? []), ...extra]
  const total = page.data?.total ?? 0
  const current = summary.data?.[0]
  const income = current?.incomeMinor ?? 0
  const expenses = current?.expensesMinor ?? 0
  const net = income + expenses

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await getTransactions(
        account.id,
        range.from,
        range.to,
        apiType,
        50,
        items.length,
        filters,
      )
      setExtra((previous) => [...previous, ...next.items])
    } catch (cause) {
      setMoreError(describeError(cause, t`Could not load more transactions.`))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Transactions`}</h1>
          <p>
            {account.label} · {t`${total} transactions`}
          </p>
        </div>
        <div className="page-actions">
          <div className="month-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label={t`Previous month`}
            >
              <IconChevronLeft />
            </button>
            <span>{formatMonth(year, monthNumber)}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t`Next month`}
            >
              <IconChevronRight />
            </button>
          </div>
          <button
            type="button"
            className="btn primary new-transaction"
            onClick={onNewTransaction}
          >
            {t`New transaction`}
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="segmented" role="group" aria-label={t`Type`}>
          {(
            [
              ['all', t`All`],
              ['expense', t`Expenses`],
              ['income', t`Income`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={type === value ? 'active' : ''}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {!hasFilters ? (
        <div className="summary-strip">
          <div>
            <span>{t`Income`}</span>
            <b className="amount-pos">
              {summary.loading
                ? '—'
                : formatMoney(income, account.currency, account.fractionDigits)}
            </b>
          </div>
          <div>
            <span>{t`Expenses`}</span>
            <b className="amount-neg">
              {summary.loading
                ? '—'
                : formatMoney(expenses, account.currency, account.fractionDigits)}
            </b>
          </div>
          <div>
            <span>{t`Net`}</span>
            <b className={net >= 0 ? 'amount-pos' : 'amount-neg'}>
              {summary.loading
                ? '—'
                : formatMoney(net, account.currency, account.fractionDigits, true)}
            </b>
          </div>
        </div>
        ) : null}
      </div>

      <button
        type="button"
        className="btn ghost filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="transaction-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        {activeFilterCount > 0 ? t`Filters (${activeFilterCount})` : t`Filters`}
      </button>

      {chips.length > 0 ? (
        <div className="filter-chips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="filter-chip"
              aria-label={t`Remove filter: ${chip.label}`}
              onClick={() => setFilters((previous) => ({ ...previous, [chip.key]: null }))}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        id="transaction-filters"
        className={`transaction-filters ${filtersOpen ? 'open' : ''}`}
      >
        <label className="field">
          <span className="field-label">{t`Category`}</span>
          <SearchSelect
            ariaLabel={t`Filter by category`}
            value={filters.categoryId === null ? '' : String(filters.categoryId)}
            options={categoryOptions}
            onChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                categoryId: value ? Number(value) : null,
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Payee`}</span>
          <SearchSelect
            ariaLabel={t`Filter by payee`}
            value={filters.payeeId === null ? '' : String(filters.payeeId)}
            options={[
              { value: '', label: t`All` },
              ...(references.data?.payees ?? []).map((payee) => ({
                value: String(payee.id),
                label: payee.name,
              })),
            ]}
            onChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                payeeId: value ? Number(value) : null,
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Tag`}</span>
          <SearchSelect
            ariaLabel={t`Filter by tag`}
            value={filters.tagId === null ? '' : String(filters.tagId)}
            options={[
              { value: '', label: t`All` },
              ...(references.data?.tags ?? []).map((tag) => ({
                value: String(tag.id),
                label: tag.label,
              })),
            ]}
            onChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                tagId: value ? Number(value) : null,
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Method`}</span>
          <SearchSelect
            ariaLabel={t`Filter by method`}
            value={filters.methodId === null ? '' : String(filters.methodId)}
            options={[
              { value: '', label: t`All` },
              ...(references.data?.methods ?? []).map((method) => ({
                value: String(method.id),
                label: method.label,
              })),
            ]}
            onChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                methodId: value ? Number(value) : null,
              }))
            }
          />
        </label>
        {hasFilters ? (
          <button
            type="button"
            className="btn ghost clear-filters"
            onClick={() =>
              setFilters({ categoryId: null, payeeId: null, tagId: null, methodId: null })
            }
          >
            {t`Clear filters`}
          </button>
        ) : null}
      </div>

      {page.error ? (
        <div className="banner" role="alert">
          <span>{describeError(page.error, t`Could not load the transactions.`)}</span>
          <button
            type="button"
            className="btn ghost banner-action"
            onClick={() => page.reload()}
          >
            {t`Retry`}
          </button>
        </div>
      ) : null}

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>{t`Date`}</th>
              <th>{t`Description`}</th>
              <th className="hide-sm">{t`Category`}</th>
              <th className="hide-sm">{t`Tags`}</th>
              <th className="num">{t`Amount`}</th>
            </tr>
          </thead>
          <tbody>
            {page.loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={5}>
                    <div className="skeleton skeleton-row" />
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="clickable"
                  data-kind={transaction.kind}
                  data-id={transaction.id}
                  tabIndex={0}
                  aria-label={t`Open transaction: ${description(transaction)}`}
                  onClick={() => setSelectedId(transaction.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(transaction.id)
                    }
                  }}
                >
                  <td className="date">
                    <span
                      className={`status-dot ${statusClass(transaction.crStatus)}`}
                      title={statusLabel(transaction.crStatus)}
                    />
                    {formatDate(transaction.date)}
                  </td>
                  <td>
                    <div className="desc">{description(transaction)}</div>
                    {transaction.payee && transaction.comment ? (
                      <div className="sub">{transaction.comment}</div>
                    ) : null}
                  </td>
                  <td className="hide-sm">
                    {transaction.category?.path ?? kindLabel(transaction.kind)}
                  </td>
                  <td className="hide-sm">
                    {transaction.tags.length > 0 ? (
                      <>
                        <span className="tag">#{transaction.tags[0].label}</span>
                        {transaction.tags.length > 1 ? (
                          <span className="sub"> +{transaction.tags.length - 1}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td className={`num ${amountClass(transaction)}`}>
                    {formatMoney(
                      transaction.amountMinor,
                      transaction.currency,
                      transaction.fractionDigits,
                      true,
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    <h3>
                      {hasFilters
                        ? t`No transactions match these filters`
                        : t`No transactions in ${formatMonth(year, monthNumber)}`}
                    </h3>
                    <p>
                      {hasFilters
                        ? t`Remove a filter to see more.`
                        : t`Record one in the app and it will show up here.`}
                    </p>
                    {hasFilters ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() =>
                          setFilters(NO_FILTERS)
                        }
                      >
                        {t`Clear filters`}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {items.length < total ? (
          <div className="load-more">
            {moreError ? <span className="error-text">{moreError}</span> : null}
            <button
              type="button"
              className="btn"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? t`Loading…` : t`Load more (${total - items.length})`}
            </button>
          </div>
        ) : null}
      </section>

      {selectedId !== null ? (
        <TransactionPanel
          id={selectedId}
          account={account}
          onClose={() => setSelectedId(null)}
          onEdit={(id) => {
            setSelectedId(null)
            onEditTransaction(id)
          }}
          onDeleted={() => {
            setSelectedId(null)
            onDataChanged()
          }}
        />
      ) : null}
    </>
  )
}
