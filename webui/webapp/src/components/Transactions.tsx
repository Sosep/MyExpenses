import { useEffect, useMemo, useState } from 'react'
import type { Account, Group, Transaction } from '../types'
import {
  describeError,
  getCategories,
  getGrouped,
  getMethods,
  getPayees,
  getTags,
  getTransactions,
} from '../api'
import {
  currentMonth,
  formatDate,
  formatMoney,
  formatMonth,
  lastMonths,
  monthRange,
  categoryPathMap,
  kindLabel,
  statusClass,
  statusLabel,
} from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { SearchSelect } from './SearchSelect'
import { NO_FILTERS, filtersFromUrl, searchWithFilters } from '../filters'
import type { Filters, Grouping, RangePreset, RangeState } from '../filters'
import {
  searchWithViewState,
  groupingFromUrl,
  rangeFromUrl,
  rememberGrouping,
} from '../filters'
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

/** `second` is 0-based for months; for days it is the day of the year (1-based). */
function groupTitle(grouping: Grouping, group: Group): string {
  if (grouping === 'MONTH') return formatMonth(group.year, group.second)
  if (grouping === 'YEAR') return String(group.year)
  if (grouping === 'DAY') {
    const date = new Date(group.year, 0, group.second)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`
    return formatDate(iso, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (grouping === 'WEEK') return t`Week ${group.second} · ${group.year}`
  return t`All`
}

/** Range presets resolve to the `from`/`to` the API expects; `all` sends none. */
function resolveRange(preset: RangePreset, range: RangeState): { from?: string; to?: string } {
  if (preset === 'month') {
    const month = monthRange(currentMonth())
    return { from: month.from, to: month.to }
  }
  if (preset === 'last3') {
    const months = lastMonths(3)
    return { from: months.from, to: months.to }
  }
  if (preset === 'year') {
    const year = new Date().getFullYear()
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  if (preset === 'custom' && range.from && range.to) {
    return { from: range.from, to: range.to }
  }
  return {}
}

export function Transactions({
  account,
  onNewTransaction,
  onEditTransaction,
  onDataChanged,
}: TransactionsProps) {
  const [grouping, setGrouping] = useState<Grouping>(() =>
    groupingFromUrl(window.location.search),
  )
  const [range, setRange] = useState<RangeState>(() => rangeFromUrl(window.location.search))
  const [type, setType] = useState<TypeFilter>('all')
  const [filters, setFilters] = useState<Filters>(() => filtersFromUrl(window.location.search))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [extra, setExtra] = useState<Transaction[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const window_ = resolveRange(range.preset, range)
  const apiType = type === 'all' ? 'both' : type
  const filtersKey = JSON.stringify(filters)
  const hasFilters = Object.values(filters).some((value) => value !== null)
  const activeFilterCount = Object.values(filters).filter((value) => value !== null).length

  useEffect(() => {
    rememberGrouping(grouping)
    const withFilters = searchWithFilters(window.location.search, filters)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${searchWithViewState(withFilters, grouping, range)}`,
    )
  }, [filters, grouping, range])

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
          (paths.get(left.id) ?? left.label).localeCompare(paths.get(right.id) ?? right.label),
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

  const grouped = useAsync(
    () => getGrouped(account.id, grouping, window_.from ?? '1970-01-01', window_.to ?? '2999-12-31'),
    ['transaction-groups', account.id, grouping, window_.from, window_.to],
  )
  const page = useAsync(
    () => getTransactions(account.id, window_.from, window_.to, apiType, 50, 0, filters),
    ['transaction-page', account.id, window_.from, window_.to, apiType, filtersKey],
  )

  useEffect(() => {
    setExtra([])
    setMoreError(null)
    setSelectedId(null)
  }, [account.id, grouping, range, type, filtersKey])

  const items = [...(page.data?.items ?? []), ...extra]
  const total = page.data?.total ?? 0

  // Groups are ordered and disjoint, so a row belongs to the last group whose
  // first transaction is not after it. No month or week arithmetic on the client.
  const buckets = useMemo(() => {
    const groups = (grouped.data ?? [])
      .filter((group): group is Group & { firstDate: string } => Boolean(group.firstDate))
      .slice()
      .sort((left, right) => (left.firstDate < right.firstDate ? -1 : 1))
    const rows = new Map<string, Transaction[]>()
    for (const group of groups) rows.set(group.firstDate, [])
    const orphans: Transaction[] = []
    for (const transaction of items) {
      let match = -1
      for (let index = 0; index < groups.length; index += 1) {
        if (groups[index].firstDate <= transaction.date) match = index
        else break
      }
      if (match === -1) orphans.push(transaction)
      else rows.get(groups[match].firstDate)?.push(transaction)
    }
    return { groups, rows, orphans }
  }, [grouped.data, items])

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await getTransactions(
        account.id,
        window_.from,
        window_.to,
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

  function toggleGroup(key: string) {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groupingAvailable = grouped.data !== undefined
  const showGroups = grouping !== 'NONE' && groupingAvailable && buckets.groups.length > 0

  const ranges: Array<[RangePreset, string]> = [
    ['all', t`History`],
    ['month', t`This month`],
    ['last3', t`Last 3 months`],
    ['year', t`This year`],
  ]

  function renderRow(transaction: Transaction) {
    return (
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
        <td className="hide-sm">{transaction.category?.path ?? kindLabel(transaction.kind)}</td>
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
    )
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
          <button
            type="button"
            className="btn primary new-transaction"
            onClick={onNewTransaction}
          >
            {t`New transaction`}
          </button>
        </div>
      </div>

      <div className="list-toolbar">
        {ranges.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${range.preset === value ? 'active' : ''}`}
            aria-pressed={range.preset === value}
            onClick={() => setRange({ preset: value, from: null, to: null })}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${range.preset === 'custom' ? 'active' : ''}`}
          aria-pressed={range.preset === 'custom'}
          onClick={() =>
            setRange({
              preset: 'custom',
              from: range.from ?? monthRange(currentMonth()).from,
              to: range.to ?? monthRange(currentMonth()).to,
            })
          }
        >
          {t`From / to`}
        </button>
        <label className="grouping-select">
          <span>{t`Group by`}</span>
          <select
            aria-label={t`Group by`}
            value={grouping}
            onChange={(event) => setGrouping(event.target.value as Grouping)}
          >
            <option value="NONE">{t`None`}</option>
            <option value="DAY">{t`Day`}</option>
            <option value="WEEK">{t`Week`}</option>
            <option value="MONTH">{t`Month`}</option>
            <option value="YEAR">{t`Year`}</option>
          </select>
        </label>
      </div>

      {range.preset === 'custom' ? (
        <div className="range-fields">
          <label className="field">
            <span className="field-label">{t`From`}</span>
            <input
              type="date"
              aria-label={t`From`}
              value={range.from ?? ''}
              max={range.to ?? undefined}
              onChange={(event) =>
                setRange((previous) => ({ ...previous, from: event.target.value || null }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">{t`To`}</span>
            <input
              type="date"
              aria-label={t`To`}
              value={range.to ?? ''}
              min={range.from ?? undefined}
              onChange={(event) =>
                setRange((previous) => ({ ...previous, to: event.target.value || null }))
              }
            />
          </label>
        </div>
      ) : null}

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
            onClick={() => setFilters(NO_FILTERS)}
          >
            {t`Clear filters`}
          </button>
        ) : null}
      </div>

      {page.error ? (
        <div className="banner" role="alert">
          <span>{describeError(page.error, t`Could not load the transactions.`)}</span>
          <button type="button" className="btn ghost banner-action" onClick={() => page.reload()}>
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
              showGroups ? (
                <>
                  {[...buckets.groups].reverse().map((group) => {
                    const isCollapsed = collapsed.has(group.firstDate)
                    const rows = buckets.rows.get(group.firstDate) ?? []
                    const transfers = group.transfersMinor
                    return (
                      <>
                        <tr
                          key={`group-${group.firstDate}`}
                          className={`group-row ${isCollapsed ? 'collapsed' : ''}`}
                          onClick={() => toggleGroup(group.firstDate)}
                        >
                          <td colSpan={5}>
                            <div className="group-head">
                              <button
                                type="button"
                                className="group-toggle"
                                aria-expanded={!isCollapsed}
                                aria-label={
                                  isCollapsed ? t`Expand period` : t`Collapse period`
                                }
                              >
                                <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                              </button>
                              <span className="group-title">{groupTitle(grouping, group)}</span>
                              <span className="group-sums">
                                {group.incomeMinor !== 0 ? (
                                  <span className="amount-pos" title={t`Income`}>
                                    {formatMoney(
                                      group.incomeMinor,
                                      account.currency,
                                      account.fractionDigits,
                                      true,
                                    )}
                                  </span>
                                ) : null}
                                {group.expensesMinor !== 0 ? (
                                  <span className="amount-neg" title={t`Expenses`}>
                                    {formatMoney(
                                      group.expensesMinor,
                                      account.currency,
                                      account.fractionDigits,
                                      true,
                                    )}
                                  </span>
                                ) : null}
                                {transfers !== 0 ? (
                                  <span className="amount-neutral" title={t`Transfer`}>
                                    {formatMoney(
                                      transfers,
                                      account.currency,
                                      account.fractionDigits,
                                      true,
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed ? rows.map(renderRow) : null}
                      </>
                    )
                  })}
                  {buckets.orphans.map(renderRow)}
                </>
              ) : (
                items.map(renderRow)
              )
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    <h3>
                      {hasFilters ? t`No transactions match these filters` : t`No transactions yet`}
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
                        onClick={() => setFilters(NO_FILTERS)}
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
