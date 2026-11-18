import { Fragment, useEffect, useMemo, useState } from 'react'
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
  parseAmountMinor,
  statusClass,
  statusLabel,
} from '../format'
import { t } from '@lingui/core/macro'
import { useHistoryPanel } from '../navigation'
import { useAsync } from '../hooks'
import { MultiPicker } from './MultiPicker'
import { NO_FILTERS, filtersFromUrl, searchWithFilters } from '../filters'
import type { Filters, Grouping, RangePreset, RangeState } from '../filters'
import {
  activeFilterCount as countFilters,
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

/** Minor units typed back into the decimal field the user edits. */
function amountText(value: number | null, fractionDigits: number): string {
  if (value === null) return ''
  return (value / Math.pow(10, fractionDigits)).toString().replace('.', ',')
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
  const activeFilterCount = countFilters(filters)
  const hasFilters = activeFilterCount > 0

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
  }, ['references'])
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
    const list: Array<{ key: string; label: string; clear: () => void }> = []
    const idChips = [
      ['categoryIds', 'categories', 'categoryId'],
      ['payeeIds', 'payees', 'payeeId'],
      ['tagIds', 'tags', 'tagId'],
      ['methodIds', 'methods', 'methodId'],
    ] as const
    for (const [field, source, name] of idChips) {
      for (const id of filters[field]) {
        const item = (references.data?.[source] ?? []).find((entry) => entry.id === id)
        const text =
          item && 'label' in item ? item.label : item && 'name' in item ? item.name : null
        const label =
          field === 'categoryIds' ? (paths.get(id) ?? text ?? String(id)) : (text ?? String(id))
        list.push({
          key: `${name}-${id}`,
          label,
          clear: () =>
            setFilters((previous) => ({
              ...previous,
              [field]: previous[field].filter((value) => value !== id),
            })),
        })
      }
    }
    if (filters.uncategorized) {
      list.push({
        key: 'uncategorized',
        label: t`No category`,
        clear: () => setFilters((previous) => ({ ...previous, uncategorized: false })),
      })
    }
    if (filters.text) {
      list.push({
        key: 'q',
        label: `“${filters.text}”`,
        clear: () => setFilters((previous) => ({ ...previous, text: null })),
      })
    }
    if (filters.amountMin !== null || filters.amountMax !== null) {
      const min = filters.amountMin ?? 0
      const max = filters.amountMax
      list.push({
        key: 'amount',
        label:
          max === null
            ? `≥ ${formatMoney(min, account.currency, account.fractionDigits)}`
            : `${formatMoney(min, account.currency, account.fractionDigits)} – ${formatMoney(
                max,
                account.currency,
                account.fractionDigits,
              )}`,
        clear: () =>
          setFilters((previous) => ({ ...previous, amountMin: null, amountMax: null })),
      })
    }
    for (const status of filters.statuses) {
      list.push({
        key: `status-${status}`,
        label: statusLabel(status),
        clear: () =>
          setFilters((previous) => ({
            ...previous,
            statuses: previous.statuses.filter((value) => value !== status),
          })),
      })
    }
    if (filters.transfer !== 'any') {
      list.push({
        key: 'transfer',
        label: filters.transfer === 'only' ? t`Only transfers` : t`No transfers`,
        clear: () => setFilters((previous) => ({ ...previous, transfer: 'any' })),
      })
    }
    return list
  }, [filters, references.data, paths, account.currency, account.fractionDigits])

  const grouped = useAsync(
    () => getGrouped(account.id, grouping, window_.from ?? '1970-01-01', window_.to ?? '2999-12-31'),
    ['transaction-groups', account.id, grouping, window_.from, window_.to],
  )
  // Grouped views pool every transaction of the window in one page (up to the
  // API maximum) so each period header has rows under it. With 50 rows only the
  // newest months had content and the older headers were empty accordions that
  // clicked but did nothing.
  const pageSize = grouping === 'NONE' ? 50 : 500
  const page = useAsync(
    () => getTransactions(account.id, window_.from, window_.to, apiType, pageSize, 0, filters),
    ['transaction-page', account.id, window_.from, window_.to, apiType, filtersKey, pageSize],
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
        pageSize,
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

  // The detail panel is a history entry: back closes it and closing it from the
  // UI pops that entry.
  const closeTransaction = useHistoryPanel(selectedId !== null, () => setSelectedId(null))
  const openTransaction = (id: number) => setSelectedId(id)

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
        onClick={() => openTransaction(transaction.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openTransaction(transaction.id)
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
              onClick={chip.clear}
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
          <span className="field-label">{t`Search`}</span>
          <input
            type="search"
            aria-label={t`Search in description, payee and reference`}
            placeholder={t`Description, payee or reference`}
            value={filters.text ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setFilters((previous) => ({ ...previous, text: value === '' ? null : value }))
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Amount from`}</span>
          <input
            inputMode="decimal"
            aria-label={t`Amount from`}
            placeholder="0"
            value={amountText(filters.amountMin, account.fractionDigits)}
            onChange={(event) => {
              const value = parseAmountMinor(event.target.value, account.fractionDigits)
              setFilters((previous) => ({ ...previous, amountMin: value }))
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Amount to`}</span>
          <input
            inputMode="decimal"
            aria-label={t`Amount to`}
            placeholder="—"
            value={amountText(filters.amountMax, account.fractionDigits)}
            onChange={(event) => {
              const value = parseAmountMinor(event.target.value, account.fractionDigits)
              setFilters((previous) => ({ ...previous, amountMax: value }))
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Category`}</span>
          <MultiPicker
            ariaLabel={t`Filter by category`}
            options={categoryOptions}
            values={filters.categoryIds.map(String)}
            onChange={(values) =>
              setFilters((previous) => ({
                ...previous,
                categoryIds: values.map(Number),
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Payee`}</span>
          <MultiPicker
            ariaLabel={t`Filter by payee`}
            options={(references.data?.payees ?? []).map((payee) => ({
              value: String(payee.id),
              label: payee.name,
            }))}
            values={filters.payeeIds.map(String)}
            onChange={(values) =>
              setFilters((previous) => ({
                ...previous,
                payeeIds: values.map(Number),
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Tag`}</span>
          <MultiPicker
            ariaLabel={t`Filter by tag`}
            options={(references.data?.tags ?? []).map((tag) => ({
              value: String(tag.id),
              label: tag.label,
            }))}
            values={filters.tagIds.map(String)}
            onChange={(values) =>
              setFilters((previous) => ({
                ...previous,
                tagIds: values.map(Number),
              }))
            }
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Method`}</span>
          <MultiPicker
            ariaLabel={t`Filter by method`}
            options={(references.data?.methods ?? []).map((method) => ({
              value: String(method.id),
              label: method.label,
            }))}
            values={filters.methodIds.map(String)}
            onChange={(values) =>
              setFilters((previous) => ({
                ...previous,
                methodIds: values.map(Number),
              }))
            }
          />
        </label>
        <div className="field">
          <span className="field-label">{t`Status`}</span>
          <div className="segmented" role="group" aria-label={t`Status`}>
            {(['UNRECONCILED', 'CLEARED', 'RECONCILED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={filters.statuses.includes(status) ? 'active' : ''}
                aria-pressed={filters.statuses.includes(status)}
                onClick={() =>
                  setFilters((previous) => ({
                    ...previous,
                    statuses: previous.statuses.includes(status)
                      ? previous.statuses.filter((value) => value !== status)
                      : [...previous.statuses, status],
                  }))
                }
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t`Transfers`}</span>
          <div className="segmented" role="group" aria-label={t`Transfers`}>
            {(
              [
                ['any', t`All`],
                ['only', t`Only transfers`],
                ['none', t`No transfers`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filters.transfer === value ? 'active' : ''}
                aria-pressed={filters.transfer === value}
                onClick={() => setFilters((previous) => ({ ...previous, transfer: value }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
                      <Fragment key={group.firstDate}>
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
                      </Fragment>
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
          onClose={closeTransaction}
          onEdit={(id) => {
            closeTransaction()
            onEditTransaction(id)
          }}
          onDeleted={() => {
            closeTransaction()
            onDataChanged()
          }}
        />
      ) : null}
    </>
  )
}
