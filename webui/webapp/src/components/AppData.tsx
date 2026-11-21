import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import type {
  AccountTypeEntry,
  Category,
  CurrencyEntry,
  Method,
  Price,
  Tag,
} from '../types'
import {
  ApiError,
  createCategory,
  createCurrency,
  createMethod,
  createTag,
  deleteCategory,
  deleteCurrency,
  deleteMethod,
  deletePrice,
  deleteTag,
  describeError,
  getAccountTypes,
  getCategories,
  getCurrencies,
  getMethods,
  getPrices,
  getTags,
  savePrice,
  updateCategory,
  updateCurrency,
  updateMethod,
  updatePrice,
  updateTag,
} from '../api'
import {
  accountTypeNames,
  branchIds,
  FLAG_EXPENSE,
  FLAG_INCOME,
  nonFiatCurrencies,
  remapCandidates,
} from '../appDataUi'
import { decimalInputValue, formatDate } from '../format'
import { useAsync } from '../hooks'
import { useHistoryPanel } from '../navigation'
import { useFocusTrap } from '../useFocusTrap'
import { SearchSelect } from './SearchSelect'
import { IconX } from './Icons'

type Tab = 'categories' | 'methods' | 'tags' | 'currencies' | 'prices'

const TABS: { id: Tab; label: () => string }[] = [
  { id: 'categories', label: () => t`Categories` },
  { id: 'methods', label: () => t`Methods` },
  { id: 'tags', label: () => t`Tags` },
  { id: 'currencies', label: () => t`Currencies` },
  { id: 'prices', label: () => t`Prices` },
]

/**
 * Management of the app's master data, mirroring Android's Settings > Data:
 * categories (with the remap on delete), payment methods, tags, currencies and
 * the manual price history. Writes go through the app's repository rules; this
 * screen never re-derives them.
 */
export function AppData() {
  const [tab, setTab] = useState<Tab>('categories')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`App data`}</h1>
          <p>{t`Categories, methods, tags, currencies and prices.`}</p>
        </div>
      </div>
      <div className="segmented wrap app-data-tabs" role="group" aria-label={t`Data sections`}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tab === entry.id ? 'active' : ''}
            aria-pressed={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label()}
          </button>
        ))}
      </div>
      {tab === 'categories' ? (
        <CategoriesTab />
      ) : tab === 'methods' ? (
        <MethodsTab />
      ) : tab === 'tags' ? (
        <TagsTab />
      ) : tab === 'currencies' ? (
        <CurrenciesTab />
      ) : (
        <PricesTab />
      )}
    </>
  )
}

// ---- shared bits ---------------------------------------------------------

function Panel({
  title,
  kicker,
  children,
  footer,
  onClose,
}: {
  title: string
  kicker: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside ref={panelRef} className="panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head">
          <div>
            <div className="panel-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t`Close editor`}>
            <IconX />
          </button>
        </div>
        <div className="panel-body">{children}</div>
        <div className="panel-footer">
          <div className="panel-actions">{footer}</div>
        </div>
      </aside>
    </>
  )
}

function Banner({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="banner" role="alert">
      <span>{describeError(error, t`Could not load the data.`)}</span>
      <button type="button" className="btn ghost banner-action" onClick={retry}>
        {t`Retry`}
      </button>
    </div>
  )
}

function ErrorText({ message }: { message: string | null }) {
  return message ? <p className="error-text">{message}</p> : null
}

// ---- categories ----------------------------------------------------------

function CategoriesTab() {
  const categories = useAsync(() => getCategories(), ['categories'])
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [remapping, setRemapping] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeEditor = useHistoryPanel(editing !== null, () => setEditing(null))
  const closeRemap = useHistoryPanel(remapping !== null, () => setRemapping(null))

  async function remove(category: Category, remapTo?: number) {
    setError(null)
    try {
      await deleteCategory(category.id, remapTo)
      closeRemap()
      categories.reload()
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'category_in_use') {
        setRemapping(category)
      } else {
        setError(describeError(cause, t`Could not delete the category.`))
      }
    }
  }

  return (
    <>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Categories`}</h2>
            <p>{t`The tree used by transactions and budgets`}</p>
          </div>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            {t`New category`}
          </button>
        </div>
        {categories.error ? (
          <Banner error={categories.error} retry={categories.reload} />
        ) : null}
        <ErrorText message={error} />
        <table className="table">
          <thead>
            <tr>
              <th>{t`Name`}</th>
              <th>{t`Type`}</th>
              <th className="num">{t`Actions`}</th>
            </tr>
          </thead>
          <tbody>
            {categories.loading ? (
              <tr>
                <td colSpan={3}>
                  <div className="skeleton skeleton-row" />
                </td>
              </tr>
            ) : (
              (categories.data ?? []).map((category) => (
                <tr key={category.id} data-category-id={category.id}>
                  <td style={{ paddingLeft: `${16 + (category.level ?? 0) * 16}px` }}>
                    {category.label}
                  </td>
                  <td>
                    {category.type === FLAG_INCOME
                      ? t`Income`
                      : category.type === FLAG_EXPENSE
                        ? t`Expense`
                        : t`Neutral`}
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setEditing(category)}
                    >
                      {t`Edit`}
                    </button>
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => void remove(category)}
                    >
                      {t`Delete`}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      {editing ? (
        <CategoryEditor
          category={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            categories.reload()
          }}
        />
      ) : null}
      {remapping ? (
        <RemapPanel
          category={remapping}
          categories={categories.data ?? []}
          error={error}
          onClose={() => {
            closeRemap()
            setError(null)
          }}
          onConfirm={(target) => {
            void remove(remapping, target)
          }}
        />
      ) : null}
    </>
  )
}

function CategoryEditor({
  category,
  categories,
  onClose,
  onSaved,
}: {
  category: Category | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(category?.label ?? '')
  const [parentId, setParentId] = useState(
    category?.parentId ? String(category.parentId) : '',
  )
  const [type, setType] = useState(
    category?.type === FLAG_INCOME ? String(FLAG_INCOME) : String(FLAG_EXPENSE),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const descendants = category
    ? new Set(branchIds(categories, category.id))
    : new Set<number>()
  const parentOptions = categories
    .filter((candidate) => !descendants.has(candidate.id))
    .map((candidate) => ({
      value: String(candidate.id),
      label: candidate.level > 0 ? `· ${candidate.label}` : candidate.label,
    }))

  async function save() {
    if (!label.trim()) {
      setError(t`Required.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        label: label.trim(),
        parentId: parentId ? Number(parentId) : null,
        type: Number(type),
      }
      if (category) await updateCategory(category.id, payload)
      else await createCategory(payload)
      onSaved()
    } catch (cause) {
      setError(describeError(cause, t`Could not save the category.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={category ? t`Edit category` : t`New category`}
      kicker={category ? t`Edit` : t`New`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t`Name`}</span>
        <input
          className="input"
          aria-label={t`Category name`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">{t`Parent`}</span>
        <SearchSelect
          ariaLabel={t`Parent category`}
          value={parentId}
          options={parentOptions}
          disabled={category !== null}
          onChange={setParentId}
        />
      </label>
      <label className="field">
        <span className="field-label">{t`Type`}</span>
        <select
          className="input"
          aria-label={t`Category type`}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value={FLAG_EXPENSE}>{t`Expense`}</option>
          <option value={FLAG_INCOME}>{t`Income`}</option>
        </select>
      </label>
      <ErrorText message={error} />
    </Panel>
  )
}

function RemapPanel({
  category,
  categories,
  error,
  onClose,
  onConfirm,
}: {
  category: Category
  categories: Category[]
  error: string | null
  onClose: () => void
  onConfirm: (target: number) => void
}) {
  const [target, setTarget] = useState('')
  const options = remapCandidates(categories, category.id).map((candidate) => ({
    value: String(candidate.id),
    label: candidate.label,
  }))
  return (
    <Panel
      title={t`Delete category`}
      kicker={t`In use`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!target}
            onClick={() => onConfirm(Number(target))}
          >
            {t`Move and delete`}
          </button>
        </>
      }
    >
      <p>
        {t`The category has movements. Choose where to move them before deleting it.`}
      </p>
      <label className="field">
        <span className="field-label">{t`Move to`}</span>
        <SearchSelect
          ariaLabel={t`Move to`}
          value={target}
          options={options}
          onChange={setTarget}
        />
      </label>
      <ErrorText message={error} />
    </Panel>
  )
}

// ---- methods -------------------------------------------------------------

function MethodsTab() {
  const methods = useAsync(() => getMethods(), ['methods'])
  const accountTypes = useAsync(() => getAccountTypes(), ['account-types'])
  const [editing, setEditing] = useState<Method | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeEditor = useHistoryPanel(editing !== null, () => setEditing(null))

  async function remove(method: Method) {
    setError(null)
    try {
      await deleteMethod(method.id)
      methods.reload()
    } catch (cause) {
      setError(describeError(cause, t`Could not delete the method.`))
    }
  }

  return (
    <>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Payment methods`}</h2>
            <p>{t`Cash, card, transfers and custom methods`}</p>
          </div>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            {t`New method`}
          </button>
        </div>
        {methods.error ? <Banner error={methods.error} retry={methods.reload} /> : null}
        <ErrorText message={error} />
        <table className="table">
          <thead>
            <tr>
              <th>{t`Name`}</th>
              <th>{t`Type`}</th>
              <th>{t`Account types`}</th>
              <th className="num">{t`Actions`}</th>
            </tr>
          </thead>
          <tbody>
            {(methods.data ?? []).map((method) => (
              <tr key={method.id} data-method-id={method.id}>
                <td>{method.label}</td>
                <td>
                  {method.type < 0 ? t`Expense` : method.type > 0 ? t`Income` : t`Neutral`}
                </td>
                <td>
                  {accountTypeNames(method, accountTypes.data ?? []) || t`All`}
                </td>
                <td className="num">
                  <button type="button" className="btn ghost" onClick={() => setEditing(method)}>
                    {t`Edit`}
                  </button>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => void remove(method)}
                  >
                    {t`Delete`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing ? (
        <MethodEditor
          method={editing === 'new' ? null : editing}
          accountTypes={accountTypes.data ?? []}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            methods.reload()
          }}
        />
      ) : null}
    </>
  )
}

function MethodEditor({
  method,
  accountTypes,
  onClose,
  onSaved,
}: {
  method: Method | null
  accountTypes: AccountTypeEntry[]
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(method?.label ?? '')
  const [type, setType] = useState(String(method?.type ?? 0))
  const [isNumbered, setIsNumbered] = useState(method?.isNumbered ?? false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(method?.accountTypes ?? [])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!label.trim()) {
      setError(t`Required.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        label: label.trim(),
        type: Number(type),
        isNumbered,
        accountTypes: selectedTypes,
      }
      if (method) await updateMethod(method.id, payload)
      else await createMethod(payload)
      onSaved()
    } catch (cause) {
      setError(describeError(cause, t`Could not save the method.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={method ? t`Edit method` : t`New method`}
      kicker={method ? t`Edit` : t`New`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t`Name`}</span>
        <input
          className="input"
          aria-label={t`Method name`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">{t`Type`}</span>
        <select
          className="input"
          aria-label={t`Method type`}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="-1">{t`Expense`}</option>
          <option value="0">{t`Neutral`}</option>
          <option value="1">{t`Income`}</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={isNumbered}
          aria-label={t`Numbered`}
          onChange={(event) => setIsNumbered(event.target.checked)}
        />
        <span>{t`Numbered`}</span>
      </label>
      <div className="field">
        <span className="field-label">{t`Account types`}</span>
        {accountTypes.map((entry) => (
          <label className="check-row" key={entry.id}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(String(entry.id))}
              aria-label={entry.name}
              onChange={(event) =>
                setSelectedTypes((current) =>
                  event.target.checked
                    ? [...current, String(entry.id)]
                    : current.filter((value) => value !== String(entry.id)),
                )
              }
            />
            <span>{entry.name}</span>
          </label>
        ))}
      </div>
      <ErrorText message={error} />
    </Panel>
  )
}

// ---- tags ----------------------------------------------------------------

function TagsTab() {
  const tags = useAsync(() => getTags(), ['tags'])
  const [editing, setEditing] = useState<Tag | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeEditor = useHistoryPanel(editing !== null, () => setEditing(null))

  async function remove(tag: Tag) {
    setError(null)
    try {
      await deleteTag(tag.id)
      tags.reload()
    } catch (cause) {
      setError(describeError(cause, t`Could not delete the tag.`))
    }
  }

  return (
    <>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Tags`}</h2>
            <p>{t`Free labels attached to transactions`}</p>
          </div>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            {t`New tag`}
          </button>
        </div>
        {tags.error ? <Banner error={tags.error} retry={tags.reload} /> : null}
        <ErrorText message={error} />
        <table className="table">
          <thead>
            <tr>
              <th>{t`Name`}</th>
              <th className="num">{t`Actions`}</th>
            </tr>
          </thead>
          <tbody>
            {(tags.data ?? []).map((tag) => (
              <tr key={tag.id} data-tag-id={tag.id}>
                <td>#{tag.label}</td>
                <td className="num">
                  <button type="button" className="btn ghost" onClick={() => setEditing(tag)}>
                    {t`Edit`}
                  </button>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => void remove(tag)}
                  >
                    {t`Delete`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing ? (
        <TagEditor
          tag={editing === 'new' ? null : editing}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            tags.reload()
          }}
        />
      ) : null}
    </>
  )
}

function TagEditor({
  tag,
  onClose,
  onSaved,
}: {
  tag: Tag | null
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(tag?.label ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!label.trim()) {
      setError(t`Required.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (tag) await updateTag(tag.id, { label: label.trim() })
      else await createTag({ label: label.trim() })
      onSaved()
    } catch (cause) {
      setError(describeError(cause, t`Could not save the tag.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={tag ? t`Edit tag` : t`New tag`}
      kicker={tag ? t`Edit` : t`New`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t`Name`}</span>
        <input
          className="input"
          aria-label={t`Tag name`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <ErrorText message={error} />
    </Panel>
  )
}

// ---- currencies ----------------------------------------------------------

function CurrenciesTab() {
  const currencies = useAsync(() => getCurrencies(), ['currencies'])
  const [editing, setEditing] = useState<CurrencyEntry | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeEditor = useHistoryPanel(editing !== null, () => setEditing(null))

  async function remove(currency: CurrencyEntry) {
    setError(null)
    try {
      await deleteCurrency(currency.code)
      currencies.reload()
    } catch (cause) {
      setError(describeError(cause, t`Could not delete the currency.`))
    }
  }

  return (
    <>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Currencies and assets`}</h2>
            <p>{t`Fiat currencies plus the assets the app tracks`}</p>
          </div>
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>
            {t`New currency`}
          </button>
        </div>
        {currencies.error ? (
          <Banner error={currencies.error} retry={currencies.reload} />
        ) : null}
        <ErrorText message={error} />
        <table className="table">
          <thead>
            <tr>
              <th>{t`Code`}</th>
              <th className="hide-sm">{t`Symbol`}</th>
              <th className="num hide-sm">{t`Digits`}</th>
              <th>{t`Type`}</th>
              <th className="num">{t`Actions`}</th>
            </tr>
          </thead>
          <tbody>
            {(currencies.data ?? []).map((currency) => (
              <tr key={currency.code} data-currency-code={currency.code}>
                <td>{currency.code}</td>
                <td className="hide-sm">{currency.symbol}</td>
                <td className="num hide-sm">{currency.fractionDigits}</td>
                <td>{currency.commodityType}</td>
                <td className="num">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setEditing(currency)}
                  >
                    {t`Edit`}
                  </button>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => void remove(currency)}
                  >
                    {t`Delete`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing ? (
        <CurrencyEditor
          currency={editing === 'new' ? null : editing}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            currencies.reload()
          }}
        />
      ) : null}
    </>
  )
}

function CurrencyEditor({
  currency,
  onClose,
  onSaved,
}: {
  currency: CurrencyEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(currency?.code ?? '')
  const [symbol, setSymbol] = useState(currency?.symbol ?? '')
  const [label, setLabel] = useState(currency?.label ?? '')
  const [digits, setDigits] = useState(String(currency?.fractionDigits ?? 2))
  const [commodityType, setCommodityType] = useState(currency?.commodityType ?? 'SECURITY')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isNew = currency === null

  async function save() {
    if (isNew && !code.trim()) {
      setError(t`Required.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        symbol: symbol.trim() || code.trim().toUpperCase(),
        label: label.trim() || null,
        fractionDigits: Number(digits),
        commodityType,
      }
      if (currency) await updateCurrency(currency.code, payload)
      else
        await createCurrency({
          ...payload,
          code: code.trim().toUpperCase(),
        })
      onSaved()
    } catch (cause) {
      setError(describeError(cause, t`Could not save the currency.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={currency ? t`Edit currency` : t`New currency`}
      kicker={currency ? t`Edit` : t`New`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      {isNew ? (
        <label className="field">
          <span className="field-label">{t`Code`}</span>
          <input
            className="input"
            aria-label={t`Currency code`}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
      ) : null}
      <label className="field">
        <span className="field-label">{t`Symbol`}</span>
        <input
          className="input"
          aria-label={t`Currency symbol`}
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">{t`Name`}</span>
        <input
          className="input"
          aria-label={t`Currency name`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <div className="form-row">
        <label className="field">
          <span className="field-label">{t`Digits`}</span>
          <input
            className="input"
            aria-label={t`Fraction digits`}
            inputMode="numeric"
            value={digits}
            onChange={(event) => setDigits(event.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
        <label className="field">
          <span className="field-label">{t`Type`}</span>
          <select
            className="input"
            aria-label={t`Currency type`}
            value={commodityType}
            onChange={(event) => setCommodityType(event.target.value)}
          >
            <option value="FIAT">{t`Fiat`}</option>
            <option value="SECURITY">{t`Security`}</option>
            <option value="CRYPTO">{t`Crypto`}</option>
            <option value="COMMODITY">{t`Commodity`}</option>
          </select>
        </label>
      </div>
      <ErrorText message={error} />
    </Panel>
  )
}

// ---- prices --------------------------------------------------------------

function PricesTab() {
  const currencies = useAsync(() => getCurrencies(), ['currencies'])
  const commodities = nonFiatCurrencies(currencies.data ?? [])
  const [commodity, setCommodity] = useState('')
  useEffect(() => {
    if (!commodity && commodities.length > 0) setCommodity(commodities[0].code)
  }, [commodity, commodities])
  const prices = useAsync(
    () => (commodity ? getPrices(commodity) : Promise.resolve([])),
    ['prices', commodity],
  )
  const [editing, setEditing] = useState<Price | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeEditor = useHistoryPanel(editing !== null, () => setEditing(null))

  async function remove(price: Price) {
    setError(null)
    try {
      await deletePrice(price.commodity, price.date)
      prices.reload()
    } catch (cause) {
      setError(describeError(cause, t`Could not delete the price.`))
    }
  }

  return (
    <>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>{t`Price history`}</h2>
            <p>{t`Manual prices used for the portfolio valuation`}</p>
          </div>
          <div className="page-actions">
            <label className="field field-inline">
              <span className="sr-only">{t`Asset`}</span>
              <select
                className="input"
                aria-label={t`Asset`}
                value={commodity}
                onChange={(event) => setCommodity(event.target.value)}
              >
                {commodities.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn primary"
              onClick={() => setEditing('new')}
              disabled={!commodity}
            >
              {t`New price`}
            </button>
          </div>
        </div>
        {prices.error ? <Banner error={prices.error} retry={prices.reload} /> : null}
        <ErrorText message={error} />
        {commodities.length === 0 ? (
          <div className="empty">
            <h3>{t`No assets yet`}</h3>
            <p>{t`Add a currency of type Security, Crypto or Commodity first.`}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t`Date`}</th>
                <th className="num">{t`Price`}</th>
                <th>{t`Source`}</th>
                <th className="num">{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {(prices.data ?? []).map((price) => (
                <tr key={`${price.date}-${price.source}`} data-price-date={price.date}>
                  <td>{formatDate(price.date, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="num">
                    {price.value.toLocaleString(undefined, { maximumFractionDigits: 8 })}{' '}
                    {price.currency}
                  </td>
                  <td>{price.source}</td>
                  <td className="num">
                    {price.source === 'USER' ? (
                      <>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setEditing(price)}
                        >
                          {t`Edit`}
                        </button>
                        <button
                          type="button"
                          className="btn ghost danger"
                          onClick={() => void remove(price)}
                        >
                          {t`Delete`}
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {(prices.data ?? []).length === 0 && !prices.loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">
                      <h3>{t`No prices yet`}</h3>
                      <p>{t`Add the first price for this asset.`}</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
      {editing ? (
        <PriceEditor
          price={editing === 'new' ? null : editing}
          commodity={commodity}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor()
            prices.reload()
          }}
        />
      ) : null}
    </>
  )
}

function PriceEditor({
  price,
  commodity,
  onClose,
  onSaved,
}: {
  price: Price | null
  commodity: string
  onClose: () => void
  onSaved: () => void
}) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const now = new Date()
  const [date, setDate] = useState(
    price?.date ??
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  )
  const [value, setValue] = useState(price ? decimalInputValue(price.value) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsed = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t`Enter a price above zero.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (price) await updatePrice(commodity, price.date, { commodity, date, value: parsed })
      else await savePrice({ commodity, date, value: parsed })
      onSaved()
    } catch (cause) {
      setError(describeError(cause, t`Could not save the price.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={price ? t`Edit price` : t`New price`}
      kicker={commodity}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t`Saving…` : t`Save`}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t`Date`}</span>
        <input
          type="date"
          className="input"
          aria-label={t`Date`}
          value={date}
          disabled={price !== null}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">{t`Price`}</span>
        <input
          className="input"
          aria-label={t`Price`}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^\d.,]/g, ''))}
        />
      </label>
      <ErrorText message={error} />
    </Panel>
  )
}
