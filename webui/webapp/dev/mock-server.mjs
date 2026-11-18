/*
 * Dev-only server for the web app.
 *
 * Serves the built SPA from ../src/main/assets/webapp and an in-memory API
 * that follows the v1 contract. It is not part of the APK and it is not a
 * replacement for testing against the phone; it exists so UI work can be
 * checked without a device.
 *
 *   npm run build && npm run mock
 *   open http://localhost:4173/app/
 *
 * QA switches (query string):
 *   ?login=1            show the login screen instead of bypassing auth
 *   ?view=transactions  open the transactions screen
 *   ?view=budgets       open the budgets screen
 *   ?view=reports       open the reports screen
 *   ?panel=split        open the split transaction detail panel
 *   ?theme=dark         toggle dark mode
 *   ?metrics=1          show scroll/row metrics in a corner badge
 */

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const webapp = join(root, 'src/main/assets/webapp')
const favicon = join(root, 'src/main/assets/favicon.ico')
const port = Number(process.env.MOCK_PORT || 4173)

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1
const pad = (value) => String(value).padStart(2, '0')
const iso = (day) => `${year}-${pad(month)}-${pad(day)}`

/** ISO date `monthsAgo` months back, so grouping by month has history to show. */
const isoMonthsAgo = (monthsAgo, day) => {
  const date = new Date(year, month - 1 - monthsAgo, day)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const accounts = [
  {
    id: 1,
    label: 'Everyday',
    type: '2',
    typeName: 'BANK',
    currency: 'EUR',
    fractionDigits: 2,
    openingBalanceMinor: 0,
    currentBalanceMinor: 421080,
    totalMinor: 421080,
    incomeMinor: 312000,
    expensesMinor: -277790,
    excludeFromTotals: false,
    sealed: false,
    color: -16776961,
    parentId: null,
  },
  {
    id: 2,
    label: 'Joint',
    type: '2',
    typeName: 'BANK',
    currency: 'EUR',
    fractionDigits: 2,
    openingBalanceMinor: 0,
    currentBalanceMinor: 712055,
    totalMinor: 712055,
    incomeMinor: 180000,
    expensesMinor: -120000,
    excludeFromTotals: false,
    sealed: false,
    color: -16776961,
    parentId: null,
  },
  {
    id: 3,
    label: 'Savings',
    type: '4',
    typeName: 'ASSET',
    currency: 'EUR',
    fractionDigits: 2,
    openingBalanceMinor: 0,
    currentBalanceMinor: 114900,
    totalMinor: 114900,
    incomeMinor: 0,
    expensesMinor: 0,
    excludeFromTotals: false,
    sealed: false,
    color: -16776961,
    parentId: null,
  },
]

let nextAccountId = 10

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
  new Date(year, month - 1, 1),
)
const periodStart = `${year}-${pad(month)}-01`
const periodEnd = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
const totalDays = new Date(year, month, 0).getDate()

const budgets = [
  {
    id: 1,
    accountId: 1,
    title: 'Groceries',
    description: null,
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    color: 0,
    start: null,
    end: null,
    accountName: 'Everyday',
    isDefault: false,
    uuid: 'budget-groceries',
    allocationMinor: 40000,
    criteria: { categoryIds: [2, 5], payeeIds: [], methodIds: [], tagIds: [], statuses: [] },
    criteriaUnsupported: false,
  },
  {
    id: 2,
    accountId: 1,
    title: 'Restaurants',
    description: null,
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    color: 0,
    start: null,
    end: null,
    accountName: 'Everyday',
    isDefault: false,
    uuid: 'budget-restaurants',
    allocationMinor: 12000,
    criteria: { categoryIds: [5], payeeIds: [], methodIds: [], tagIds: [], statuses: [] },
    criteriaUnsupported: false,
  },
  {
    id: 3,
    accountId: 2,
    title: 'Fuel',
    description: 'Both cars',
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    color: 0,
    start: null,
    end: null,
    accountName: 'Joint',
    isDefault: false,
    uuid: 'budget-fuel',
    allocationMinor: 18000,
    criteria: null,
    criteriaUnsupported: false,
  },
  {
    id: 4,
    accountId: 1,
    title: 'Household',
    description: null,
    currency: 'EUR',
    fractionDigits: 2,
    grouping: 'MONTH',
    color: 0,
    start: null,
    end: null,
    accountName: 'Everyday',
    isDefault: false,
    uuid: 'budget-household',
    allocationMinor: 25000,
    criteria: null,
    criteriaUnsupported: false,
  },
]

const budgetProgresses = {
  1: { allocated: 40000, spent: 31200 },
  2: { allocated: 12000, spent: 14600 },
  3: { allocated: 18000, spent: 9630 },
  4: { allocated: 25000, spent: 12400 },
}
let nextBudgetId = 5

// One row per category with spend. Budget 1 keeps a parent with its children so
// the detail panel can show the indentation and the rolled-up figure.
const budgetBreakdowns = {
  1: [
    { categoryId: 1, label: 'Food', level: 1, parentId: null, allocatedMinor: 0, spentMinor: 31200, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
    { categoryId: 2, label: 'Groceries', level: 2, parentId: 1, allocatedMinor: 30000, spentMinor: 24000, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
    { categoryId: 5, label: 'Restaurants', level: 2, parentId: 1, allocatedMinor: 10000, spentMinor: 7200, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  2: [
    { categoryId: 5, label: 'Restaurants', level: 1, parentId: null, allocatedMinor: 12000, spentMinor: 14600, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  3: [
    { categoryId: 4, label: 'Transport', level: 1, parentId: null, allocatedMinor: 18000, spentMinor: 9630, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  4: [
    { categoryId: 8, label: 'Household', level: 1, parentId: null, allocatedMinor: 25000, spentMinor: 12400, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
}

const budgetAllocations = {
  1: [
    { categoryId: 2, label: 'Groceries', level: 1, parentId: 1, allocatedMinor: 30000, spentMinor: 24000, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
    { categoryId: 5, label: 'Restaurants', level: 1, parentId: 1, allocatedMinor: 10000, spentMinor: 7200, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  2: [
    { categoryId: 5, label: 'Restaurants', level: 1, parentId: 1, allocatedMinor: 12000, spentMinor: 14600, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  3: [
    { categoryId: 4, label: 'Transport', level: 0, parentId: null, allocatedMinor: 18000, spentMinor: 9630, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
  4: [
    { categoryId: 8, label: 'Household', level: 1, parentId: 6, allocatedMinor: 25000, spentMinor: 12400, rolloverPreviousMinor: 0, rolloverNextMinor: 0 },
  ],
}

const files = [
  {
    name: 'myexpenses-2026-11-17.backup',
    size: 482913,
    modified: Date.now() - 1000 * 60 * 60 * 3,
    link: '/api/v1/files/myexpenses-2026-11-17.backup',
  },
  {
    name: 'myexpenses-2026-11-10.backup',
    size: 471380,
    modified: Date.now() - 1000 * 60 * 60 * 24 * 7,
    link: '/api/v1/files/myexpenses-2026-11-10.backup',
  },
  {
    name: 'expenses-november-2026.csv',
    size: 18422,
    modified: Date.now() - 1000 * 60 * 60 * 26,
    link: '/api/v1/files/expenses-november-2026.csv',
  },
]

const meta = {
  appVersion: 'dev',
  serverTime: `${year}-${pad(month)}-17T10:00:00`,
  timeZone: 'Europe/Madrid',
  locale: 'en-GB',
  homeCurrency: 'EUR',
  preferences: { timeEnabled: false, valueDateEnabled: false },
}

const categories = [
  { id: 1, parentId: null, label: 'Food', level: 0, color: null, type: -1 },
  { id: 2, parentId: 1, label: 'Groceries', level: 1, color: null, type: -1 },
  { id: 3, parentId: null, label: 'Income', level: 0, color: null, type: 1 },
  { id: 4, parentId: null, label: 'Transport', level: 0, color: null, type: -1 },
  { id: 5, parentId: 1, label: 'Restaurants', level: 1, color: null, type: -1 },
  { id: 6, parentId: null, label: 'Home', level: 0, color: null, type: -1 },
  { id: 7, parentId: 6, label: 'Utilities', level: 1, color: null, type: -1 },
  { id: 8, parentId: 6, label: 'Household', level: 1, color: null, type: -1 },
  { id: 9, parentId: 1, label: 'Treats', level: 1, color: null, type: -1 },
  { id: 10, parentId: null, label: 'Leisure', level: 0, color: null, type: -1 },
]

const payees = [
  { id: 1, name: 'Mercadona' },
  { id: 2, name: 'Employer' },
  { id: 3, name: 'Renfe' },
  { id: 4, name: 'Pizzeria Antonella' },
  { id: 5, name: 'Electricity' },
  { id: 6, name: 'Bookshop' },
  { id: 20, name: 'Cafe' },
  { id: 21, name: 'Supermarket' },
  { id: 22, name: 'Pharmacy' },
  { id: 23, name: 'Cinema' },
  { id: 24, name: 'Fuel' },
]

const tags = [
  { id: 1, label: 'weekly', color: null },
  { id: 2, label: 'commute', color: null },
  { id: 3, label: 'family', color: null },
  { id: 4, label: 'gift', color: null },
  { id: 5, label: 'home', color: null },
  { id: 10, label: 'daily', color: null },
]

const methods = [
  { id: 1, label: 'Card', isNumbered: false, type: 0, accountTypes: ['1', '2'] },
  { id: 2, label: 'Cash', isNumbered: false, type: 0, accountTypes: ['1'] },
]

const tx = (over) => ({
  id: 0,
  kind: 'SIMPLE',
  accountId: 1,
  amountMinor: 0,
  currency: 'EUR',
  fractionDigits: 2,
  date: iso(1),
  time: null,
  valueDate: iso(1),
  payee: null,
  category: null,
  tags: [],
  comment: '',
  method: null,
  referenceNumber: null,
  crStatus: 'UNRECONCILED',
  transferPeerId: null,
  transferAccountId: null,
  splitParts: null,
  ...over,
})

const special = [
  tx({
    id: 10,
    amountMinor: -6420,
    date: iso(14),
    valueDate: iso(14),
    payee: { id: 1, label: 'Mercadona' },
    category: { id: 2, label: 'Groceries', path: 'Food > Groceries' },
    tags: [{ id: 1, label: 'weekly' }],
    comment: 'Weekly shop',
    method: { id: 1, label: 'Card' },
    crStatus: 'RECONCILED',
  }),
  tx({
    id: 11,
    amountMinor: 295000,
    date: iso(13),
    valueDate: iso(13),
    payee: { id: 2, label: 'Employer' },
    category: { id: 3, label: 'Income', path: 'Income' },
    crStatus: 'CLEARED',
  }),
  tx({
    id: 12,
    kind: 'TRANSFER',
    amountMinor: -50000,
    date: iso(12),
    valueDate: iso(12),
    comment: 'Savings transfer',
    transferPeerId: 22,
    transferAccountId: 2,
  }),
  tx({
    id: 13,
    kind: 'SPLIT',
    amountMinor: -10000,
    date: iso(11),
    valueDate: iso(11),
    payee: { id: 1, label: 'Mercadona' },
    comment: 'Weekly shop',
    tags: [{ id: 1, label: 'weekly' }],
    method: { id: 1, label: 'Card' },
  }),
  tx({
    id: 14,
    amountMinor: -3850,
    date: iso(10),
    valueDate: iso(10),
    payee: { id: 3, label: 'Renfe' },
    category: { id: 4, label: 'Transport', path: 'Transport' },
    tags: [{ id: 2, label: 'commute' }],
  }),
  tx({
    id: 15,
    amountMinor: -4630,
    date: iso(8),
    valueDate: iso(8),
    payee: { id: 4, label: 'Pizzeria Antonella' },
    category: { id: 5, label: 'Restaurants', path: 'Food > Restaurants' },
    tags: [{ id: 3, label: 'family' }],
  }),
  tx({
    id: 16,
    amountMinor: -7140,
    date: iso(5),
    valueDate: iso(5),
    payee: { id: 5, label: 'Electricity' },
    category: { id: 7, label: 'Utilities', path: 'Home > Utilities' },
  }),
  tx({
    id: 17,
    amountMinor: -2290,
    date: iso(2),
    valueDate: iso(2),
    payee: { id: 6, label: 'Bookshop' },
    category: { id: 10, label: 'Leisure', path: 'Leisure' },
    tags: [{ id: 4, label: 'gift' }],
  }),
]

const fillerNames = ['Cafe', 'Supermarket', 'Pharmacy', 'Cinema', 'Fuel']
const fillerCategories = [
  { id: 2, label: 'Groceries', path: 'Food > Groceries' },
  { id: 5, label: 'Restaurants', path: 'Food > Restaurants' },
  { id: 8, label: 'Household', path: 'Home > Household' },
  { id: 4, label: 'Transport', path: 'Transport' },
]
const fillers = Array.from({ length: 52 }, (_, index) =>
  tx({
    id: 100 + index,
    amountMinor: -(1000 + (index % 9) * 137),
    date: iso((index % 27) + 1),
    valueDate: iso((index % 27) + 1),
    payee: { id: 20 + (index % 5), label: fillerNames[index % 5] },
    category: fillerCategories[index % 4],
    tags: index % 3 === 0 ? [{ id: 10, label: 'daily' }] : [],
    crStatus: index % 4 === 0 ? 'RECONCILED' : 'UNRECONCILED',
  }),
)

const history = [
  { monthsAgo: 1, day: 3, amountMinor: -4200, name: 'Supermarket', category: fillerCategories[0] },
  { monthsAgo: 1, day: 17, amountMinor: -1850, name: 'Cafe', category: fillerCategories[1] },
  { monthsAgo: 1, day: 28, amountMinor: 295000, name: 'Salary', category: null },
  { monthsAgo: 2, day: 9, amountMinor: -78000, name: 'Rent', category: fillerCategories[2] },
  { monthsAgo: 2, day: 21, amountMinor: -3600, name: 'Fuel', category: fillerCategories[3] },
  { monthsAgo: 3, day: 12, amountMinor: -9900, name: 'Pharmacy', category: fillerCategories[2] },
].map((entry, index) =>
  tx({
    id: 300 + index,
    amountMinor: entry.amountMinor,
    date: isoMonthsAgo(entry.monthsAgo, entry.day),
    valueDate: isoMonthsAgo(entry.monthsAgo, entry.day),
    payee: entry.category ? { id: 30 + index, label: entry.name } : null,
    category: entry.category,
    comment: entry.name,
    crStatus: 'CLEARED',
  }),
)

/* ---- QA seed ------------------------------------------------------------
 * MOCK_QA_SEED=1 replaces the fixtures with six months of mixed transactions
 * (categories, payees, methods, tags, states, transfers and splits with their
 * own parts) so grouping, filters, reports and paging have volume. It is
 * deterministic: the same seed gives the same data on every run.
 */
function buildQaSeed() {
  const seedCategories = [
    { id: 11, parentId: null, label: 'Health', level: 0, color: null, type: -1 },
    { id: 12, parentId: 11, label: 'Pharmacy', level: 1, color: null, type: -1 },
    { id: 13, parentId: 10, label: 'Subscriptions', level: 1, color: null, type: -1 },
    { id: 14, parentId: 6, label: 'Rent', level: 1, color: null, type: -1 },
    { id: 15, parentId: 6, label: 'Insurance', level: 1, color: null, type: -1 },
  ]
  const seedPayees = [
    { id: 30, name: 'Landlord' },
    { id: 31, name: 'Streaming' },
    { id: 32, name: 'Dentist' },
    { id: 33, name: 'Gym' },
    { id: 34, name: 'Bakery' },
    { id: 35, name: 'Petrol' },
    { id: 36, name: 'Train Co' },
    { id: 37, name: 'Cinema Club' },
    { id: 38, name: 'Employer' },
  ]
  const seedTags = [
    { id: 11, label: 'monthly', color: null },
    { id: 12, label: 'work', color: null },
  ]
  categories.push(...seedCategories)
  payees.push(...seedPayees)
  tags.push(...seedTags)

  const category = (id) => {
    const row = categories.find((entry) => entry.id === id)
    const parent = row.parentId ? categories.find((entry) => entry.id === row.parentId) : null
    return { id: row.id, label: row.label, path: parent ? `${parent.label} > ${row.label}` : row.label }
  }
  const payee = (id) => {
    const row = payees.find((entry) => entry.id === id)
    return row ? { id: row.id, label: row.name } : null
  }
  const method = (id) => methods.find((entry) => entry.id === id) ?? null
  const tag = (id) => tags.find((entry) => entry.id === id) ?? null

  let nextId = 1000
  const rows = []
  const parts = []
  let seed = 424242
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const between = (min, max) => min + Math.floor(random() * (max - min + 1))
  const pick = (list) => list[Math.floor(random() * list.length)]

  const statuses = ['UNRECONCILED', 'CLEARED', 'RECONCILED']
  const comments = [
    'Compra semanal', 'Cafe con Ana', 'Cena fuera', 'Gasolina', 'Farmacia',
    'Cine', 'Libro', 'Tren a Valencia', 'Factura luz', 'Supermercado',
    'Panaderia', 'Revision coche', 'Regalo cumple', 'Peluqueria', 'Merienda',
    'Parking centro', 'Suscripcion musica', 'Material oficina', 'Lavadora',
    'Salida con amigos', 'Dentista', 'Ropa', 'Mercado', 'Cafeteria estacion',
  ]

  const add = (over) => {
    nextId += 1
    rows.push(tx({ id: nextId, ...over }))
    return rows[rows.length - 1]
  }

  const addSplit = (monthsAgo, day, splitIndex) => {
    const parent = add({
      id: nextId + 1,
      kind: 'SPLIT',
      accountId: 1,
      date: isoMonthsAgo(monthsAgo, day),
      valueDate: isoMonthsAgo(monthsAgo, day),
      payee: payee(1),
      comment: splitIndex === 0 ? 'Compra grande' : 'Casa y ocio',
      method: method(1),
      tags: [tag(1)],
      crStatus: 'CLEARED',
    })
    const combos = [
      [[2, -6000], [8, -2500], [9, -1500]],
      [[5, -4000], [10, -3000]],
      [[2, -5000], [5, -3500], [4, -1500]],
    ][(monthsAgo + splitIndex) % 3]
    const splitParts = combos.map(([categoryId, amountMinor], index) => {
      nextId += 1
      const part = {
        id: nextId,
        amountMinor,
        payee: index === 0 ? payee(1) : null,
        category: category(categoryId),
        tags: index === 0 ? [tag(1)] : [],
        comment: index === 0 ? 'Comida' : index === 1 ? 'Casa' : 'Extras',
        method: null,
        referenceNumber: null,
        transferPeerId: null,
        transferAccountId: null,
      }
      parts.push(part)
      return part
    })
    parent.amountMinor = splitParts.reduce((total, part) => total + part.amountMinor, 0)
    parent.splitParts = splitParts
  }

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {
    const day = (value) => isoMonthsAgo(monthsAgo, Math.min(value, 28))

    add({ amountMinor: -75000, date: day(1), valueDate: day(1), payee: payee(30), category: category(14), comment: 'Alquiler', method: method(1), tags: [tag(11)], crStatus: 'CLEARED' })
    add({ amountMinor: -between(3800, 6200), date: day(5), valueDate: day(5), payee: payee(5), category: category(7), comment: 'Factura luz', method: method(1), crStatus: 'RECONCILED' })
    add({ amountMinor: -between(990, 1590), date: day(7), valueDate: day(7), payee: payee(31), category: category(13), comment: 'Suscripcion musica', method: method(1), tags: [tag(11)], crStatus: 'CLEARED' })

    for (const groceryDay of [3, 11, 19]) {
      add({ amountMinor: -between(2800, 9500), date: day(groceryDay), valueDate: day(groceryDay), payee: pick([payee(1), payee(34)]), category: category(2), comment: pick(comments), method: method(pick([1, 2])), tags: random() < 0.5 ? [tag(1)] : [], crStatus: pick(statuses) })
    }
    for (const outDay of [8, 22]) {
      add({ amountMinor: -between(1600, 5200), date: day(outDay), valueDate: day(outDay), payee: pick([payee(4), payee(20)]), category: category(5), comment: pick(comments), method: method(1), tags: random() < 0.4 ? [tag(3)] : [], crStatus: pick(statuses) })
    }
    add({ amountMinor: -between(1200, 3900), date: day(6), valueDate: day(6), payee: payee(36), category: category(4), comment: 'Tren', method: method(1), tags: [tag(2)], crStatus: 'CLEARED' })
    add({ amountMinor: -between(3000, 7000), date: day(17), valueDate: day(17), payee: payee(35), category: category(4), comment: 'Gasolina', method: method(1), crStatus: 'UNRECONCILED' })

    if (random() < 0.7) {
      add({ amountMinor: -between(800, 4200), date: day(12), valueDate: day(12), payee: pick([payee(22), payee(32)]), category: category(12), comment: 'Farmacia', method: method(pick([1, 2])), crStatus: 'CLEARED' })
    }
    add({ amountMinor: -between(900, 2600), date: day(15), valueDate: day(15), payee: pick([payee(23), payee(37)]), category: category(10), comment: pick(comments), method: method(1), tags: random() < 0.3 ? [tag(4)] : [], crStatus: pick(statuses) })
    add({ amountMinor: -between(1500, 4800), date: day(21), valueDate: day(21), payee: payee(33), category: category(10), comment: 'Gimnasio', method: method(1), tags: [tag(11)], crStatus: 'RECONCILED' })

    // One row without category and one without payee, so "No category" and
    // "No payee" buckets exist in the reports.
    add({ amountMinor: -between(500, 1800), date: day(23), valueDate: day(23), payee: null, category: null, comment: 'Gasto suelto', method: method(2) })
    add({ amountMinor: -between(600, 2200), date: day(24), valueDate: day(24), payee: payee(6), category: null, comment: 'Sin clasificar', method: null })

    // A voided row: every total must ignore it.
    add({ amountMinor: -9999, date: day(26), valueDate: day(26), payee: payee(34), category: category(2), comment: 'Anulada', method: method(1), crStatus: 'VOID' })

    add({ amountMinor: between(195000, 215000), date: day(25), valueDate: day(25), payee: payee(38), category: category(3), comment: 'Nomina', method: method(1), tags: [tag(12)], crStatus: 'CLEARED' })
    if (random() < 0.5) {
      add({ amountMinor: between(1500, 8900), date: day(between(9, 20)), valueDate: day(between(9, 20)), payee: null, category: null, comment: 'Devolucion', method: null })
    }

    // A transfer leg: counted as transfers, never as income or expense.
    const transferId = nextId + 1
    add({ id: transferId, kind: 'TRANSFER', amountMinor: -between(20000, 40000), date: day(10), valueDate: day(10), comment: 'Ahorro', transferPeerId: transferId + 50000, transferAccountId: 2 })

    addSplit(monthsAgo, day(13).slice(-2), 0)
    addSplit(monthsAgo, day(27).slice(-2), 1)
  }

  return {
    transactions: rows.sort((left, right) => right.date.localeCompare(left.date)),
    splitParts: parts,
  }
}

const qaSeed = process.env.MOCK_QA_SEED === '1' ? buildQaSeed() : null
const defaultTransactions = [...special, ...fillers, ...history]
const transactions = (qaSeed ? qaSeed.transactions : defaultTransactions).sort((a, b) =>
  b.date.localeCompare(a.date),
)
const splitParts = qaSeed ? qaSeed.splitParts : defaultSplitParts

const defaultSplitParts = [
  {
    id: 131,
    amountMinor: -6000,
    payee: { id: 1, label: 'Mercadona' },
    category: { id: 2, label: 'Groceries', path: 'Food > Groceries' },
    tags: [{ id: 1, label: 'weekly' }],
    comment: 'Food',
    method: null,
    referenceNumber: null,
    transferPeerId: null,
    transferAccountId: null,
  },
  {
    id: 132,
    amountMinor: -2500,
    payee: null,
    category: { id: 8, label: 'Household', path: 'Home > Household' },
    tags: [{ id: 5, label: 'home' }],
    comment: 'Cleaning supplies',
    method: null,
    referenceNumber: null,
    transferPeerId: null,
    transferAccountId: null,
  },
  {
    id: 133,
    amountMinor: -1500,
    payee: null,
    category: { id: 9, label: 'Treats', path: 'Food > Treats' },
    tags: [],
    comment: '',
    method: null,
    referenceNumber: null,
    transferPeerId: null,
    transferAccountId: null,
  },
]

// Same set the summary uses: a transfer's leg is not income or expense, it is
// `transfersMinor`. Counting it here made the chart's current month disagree
// with /reports/summary by the transfer amount.
const bookable = transactions.filter((item) => !item.transferPeerId)
const currentExpenses = bookable
  .filter((item) => item.amountMinor < 0)
  .reduce((total, item) => total + item.amountMinor, 0)
const currentIncome = bookable
  .filter((item) => item.amountMinor > 0)
  .reduce((total, item) => total + item.amountMinor, 0)

const incomes = [280000, 295000, 310000, 290000, 305000, 312000, 298000, 301000, 320000, 309000, 315000]
const expenses = [-240000, -255000, -268000, -250000, -262000, -271000, -259000, -266000, -280000, -272000, -266000]
const groups = []
for (let index = 11; index >= 0; index -= 1) {
  const date = new Date(year, month - 1 - index, 1)
  groups.push({
    year: date.getFullYear(),
    second: date.getMonth(),
    incomeMinor: index === 0 ? currentIncome : incomes[11 - index],
    expensesMinor: index === 0 ? currentExpenses : expenses[11 - index],
    transfersMinor: 0,
  })
}

function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  response.end(body)
}

function serveAppIndex(response) {
  let index = readFileSync(join(webapp, 'index.html'), 'utf8')
  index = index.replace(
    '<head>',
    `<head><script>
      (function(){
        var q = new URLSearchParams(location.search)
        if (q.get('login') === '1') {
          document.cookie = 'myexpenses_session=; path=/; max-age=0'
        } else {
          document.cookie = 'myexpenses_session=mock; path=/'
        }
        if (q.get('locale')) localStorage.setItem('myexpenses.locale', q.get('locale'))
        localStorage.setItem('myexpenses.theme', q.get('theme') === 'dark' ? 'dark' : 'light')
        window.addEventListener('load', function(){
          if (q.get('view') === 'reports') {
            setTimeout(function(){ document.querySelector('button[data-view="reports"]')?.click() }, 250)
            if (q.get('allAccounts') === '1') {
              setTimeout(function(){
                document.querySelector('[data-action="all-accounts"]')?.click()
              }, 1100)
            }
            if (q.get('reportDrill') === '1') {
              setTimeout(function(){ document.querySelector('.breakdown-row.clickable')?.click() }, 1300)
            }
            ;[['reportBy', 900], ['reportType', 1000]].forEach(function(entry){
              var value = q.get(entry[0])
              if (!value) return
              setTimeout(function(){
                var buttons = document.querySelectorAll('.segmented button')
                for (var i = 0; i < buttons.length; i++) {
                  if (buttons[i].textContent && buttons[i].textContent.trim().toLowerCase() === value.toLowerCase()) {
                    buttons[i].click()
                    break
                  }
                }
              }, entry[1])
            })
          }
          if (q.get('view') === 'budgets') {
            setTimeout(function(){ document.querySelector('button[data-view="budgets"]')?.click() }, 250)
            if (q.get('budgetMonth') === '-1') {
              setTimeout(function(){
                document.querySelector('.month-nav button')?.click()
              }, 1000)
            }
            if (q.get('new') === '1') {
              setTimeout(function(){
                document.querySelector('.page-actions .btn.primary')?.click()
              }, 900)
            }
            if (q.get('edit') === '1') {
              setTimeout(function(){
                document.querySelector('.budget-edit')?.click()
              }, 900)
            }
            if (q.get('detail') === '1' || q.get('history') === '1') {
              setTimeout(function(){
                document.querySelector('[data-action="budget-detail"]')?.click()
              }, 1000)
            }
            if (q.get('periodOverride') === '1') {
              setTimeout(function(){ document.querySelector('.budget-edit')?.click() }, 900)
              setTimeout(function(){
                document.querySelector('[data-action="period-override"]')?.click()
              }, 1500)
              setTimeout(function(){
                var input = document.querySelector('[data-role="period-amount"]')
                var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
                if (!input) return
                if (setter) setter.call(input, '500')
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }, 1800)
              setTimeout(function(){
                document.querySelector('.editor-actions .btn.primary')?.click()
              }, 2200)
            }
          }
          if (q.get('view') === 'files') {
            setTimeout(function(){ document.querySelector('button[data-view="files"]')?.click() }, 250)
          }
          if (q.get('view') === 'transactions') {
            setTimeout(function(){ document.querySelector('button[data-view="transactions"]')?.click() }, 250)
            if (q.get('filter') === 'groceries') {
              setTimeout(function(){
                var input = document.querySelector('.transaction-filters input[role="combobox"]')
                var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
                if (!input) return
                input.focus()
                if (setter) setter.call(input, 'Grocer')
                input.dispatchEvent(new Event('input', { bubbles: true }))
              }, 1100)
              setTimeout(function(){
                document.querySelector('.search-select-menu .search-select-option')?.click()
              }, 1500)
            }
            var panel = q.get('panel')
            if (panel) {
              setTimeout(function(){
                var kind = panel === 'transfer' ? 'TRANSFER' : 'SPLIT'
                var target = document.querySelector('tbody tr[data-kind="' + kind + '"]')
                ;(target || document.querySelectorAll('tbody tr')[Number(panel) - 1])?.click()
              }, 900)
            }
          }
          if (q.get('combo') === '1') {
            setTimeout(function(){ document.querySelector('.kind-choice[data-kind="SIMPLE"]')?.click() }, 800)
            setTimeout(function(){
              var combos = document.querySelectorAll('input[role="combobox"]')
              var payee = combos[1]
              if (!payee) return
              var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
              payee.focus()
              if (setter) setter.call(payee, 'Ren')
              payee.dispatchEvent(new Event('input', { bubbles: true }))
            }, 1500)
          }
          var kind = q.get('kind')
          if (q.get('new') === '1') {
            setTimeout(function(){
              document.querySelector('button.btn.primary')?.click()
            }, 350)
            if (kind) {
              setTimeout(function(){
                var value = kind === 'transfer' ? 'TRANSFER' : kind === 'split' ? 'SPLIT' : 'SIMPLE'
                document.querySelector('.kind-choice[data-kind="' + value + '"]')?.click()
              }, 700)
            }
          }
          var edit = q.get('edit')
          if (edit) {
            if (edit === 'simple') {
              setTimeout(function(){
                document.querySelector('tbody tr')?.click()
              }, 900)
            }
            setTimeout(function(){
              var buttons = document.querySelectorAll('.panel-footer button')
              for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].textContent && buttons[i].textContent.trim() === 'Edit') {
                  buttons[i].click()
                  break
                }
              }
            }, 1400)
          }
          if (q.get('save') === '1' && (!kind || kind === 'simple')) {
            if (!kind) {
              setTimeout(function(){
                document.querySelector('.kind-choice[data-kind="SIMPLE"]')?.click()
              }, 700)
            }
            setTimeout(function(){
              var input = document.querySelector('input.amount-input')
              if (!input) return
              var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
              if (setter) setter.call(input, '12.34')
              input.dispatchEvent(new Event('input', { bubbles: true }))
              setTimeout(function(){
                document.querySelector('.editor-actions .btn.primary')?.click()
              }, 300)
            }, 1800)
          }
          if (q.get('metrics') === '1') {
            setTimeout(function(){
              var main = document.querySelector('.main')
              var doc = document.scrollingElement
              var card = document.querySelector('.table-card')
              var el = document.createElement('div')
              el.id = 'qa-metrics'
              el.textContent = 'main ' + main.scrollHeight + '/' + main.clientHeight +
                ' · doc ' + doc.scrollHeight + '/' + doc.clientHeight +
                ' · card ' + (card ? Math.round(card.getBoundingClientRect().height) : '-') +
                ' · rows ' + document.querySelectorAll('tbody tr').length
              el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;background:#000;color:#fff;font:12px monospace;padding:4px 6px;border-radius:4px;pointer-events:none'
              document.body.appendChild(el)
            }, 700)
          }
        })
      })()
    </script>`,
  )
  send(response, 200, index, 'text/html; charset=utf-8')
}

const mime = {
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

let nextId = 1000

function categoryRef(id) {
  const category = categories.find((item) => item.id === id)
  if (!category) return null
  const parent = category.parentId ? categoryRef(category.parentId) : null
  return {
    id: category.id,
    label: category.label,
    path: parent ? `${parent.path} > ${category.label}` : category.label,
  }
}

function payeeRef(id) {
  const payee = payees.find((item) => item.id === id)
  return payee ? { id: payee.id, label: payee.name } : null
}

function methodRef(id) {
  const method = methods.find((item) => item.id === id)
  return method ? { id: method.id, label: method.label } : null
}

function tagRefs(ids) {
  return (ids ?? [])
    .map((id) => tags.find((item) => item.id === id))
    .filter(Boolean)
    .map((tag) => ({ id: tag.id, label: tag.label }))
}

function accountFor(id) {
  return accounts.find((item) => item.id === id) ?? accounts[0]
}

function adjustBalance(accountId, delta) {
  const account = accounts.find((item) => item.id === accountId)
  if (account) account.currentBalanceMinor += delta
}

function sortTransactions() {
  transactions.sort((left, right) => right.date.localeCompare(left.date))
}

function recomputeTotals() {
  const group = groups[groups.length - 1]
  group.incomeMinor = transactions
    .filter((item) => item.amountMinor > 0)
    .reduce((total, item) => total + item.amountMinor, 0)
  group.expensesMinor = transactions
    .filter((item) => item.amountMinor < 0)
    .reduce((total, item) => total + item.amountMinor, 0)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
    })
    request.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function transactionFromBody(body, id, previous) {
  const account = accountFor(Number(body.accountId))
  return {
    ...(previous ?? tx({})),
    id,
    kind: 'SIMPLE',
    accountId: account.id,
    amountMinor: Number(body.amountMinor),
    currency: account.currency,
    fractionDigits: account.fractionDigits,
    date: body.date,
    time: body.time ?? previous?.time ?? null,
    valueDate: body.valueDate ?? body.date,
    payee: payeeRef(body.payeeId),
    category: categoryRef(body.categoryId),
    tags: tagRefs(body.tagIds),
    comment: body.comment ?? '',
    method: methodRef(body.methodId),
    referenceNumber: body.referenceNumber ?? null,
    crStatus: previous?.crStatus ?? 'UNRECONCILED',
    splitParts: null,
  }
}

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  response.end(JSON.stringify(value))
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`)
    const path = decodeURIComponent(url.pathname)
    const isSession = path === '/api/v1/session'

    if (isSession && request.method === 'POST') {
      await readJson(request)
      response.writeHead(204, {
        'Set-Cookie': 'myexpenses_session=mock; Path=/; HttpOnly; SameSite=Strict',
        'Cache-Control': 'no-store',
      })
      return response.end()
    }
    if (isSession && request.method === 'DELETE') {
      response.writeHead(204, {
        'Set-Cookie': 'myexpenses_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict',
        'Cache-Control': 'no-store',
      })
      return response.end()
    }
    if (path.startsWith('/api/v1/') && path !== '/api/v1/session') {
      const cookie = request.headers.cookie ?? ''
      if (!cookie.includes('myexpenses_session=mock')) {
        return sendJson(response, 401, {
          error: 'unauthorized',
          message: 'Sign in required',
        })
      }
    }

    if (path === '/app' || path === '/app/') return serveAppIndex(response)

    if (path.startsWith('/app/')) {
      const file = join(webapp, path.slice('/app/'.length))
      if (existsSync(file)) {
        return send(response, 200, readFileSync(file), mime[extname(file)] ?? 'application/octet-stream')
      }
      return serveAppIndex(response)
    }

    if (path === '/favicon.ico') {
      return send(response, 200, readFileSync(favicon), 'image/x-icon')
    }

    if (path === '/api/v1/meta') return send(response, 200, JSON.stringify(meta))
    if (path === '/api/v1/account-types') {
      return sendJson(response, 200, [
        { id: 1, name: 'CASH', isAsset: true, supportsReconciliation: false },
        { id: 2, name: 'BANK', isAsset: true, supportsReconciliation: true },
        { id: 4, name: 'ASSET', isAsset: true, supportsReconciliation: false },
      ])
    }
    if (path === '/api/v1/accounts' && request.method === 'POST') {
      const body = await readJson(request)
      if (!body.label || !body.type || !body.currency) {
        return sendJson(response, 422, {
          error: 'validation_failed',
          message: 'label, type and currency are required',
        })
      }
      const typeName = { 1: 'CASH', 2: 'BANK', 4: 'ASSET' }[Number(body.type)] ?? 'BANK'
      const account = {
        id: nextAccountId++,
        label: body.label,
        type: String(body.type),
        typeName,
        currency: body.currency,
        fractionDigits: 2,
        openingBalanceMinor: body.openingBalanceMinor ?? 0,
        currentBalanceMinor: body.openingBalanceMinor ?? 0,
        totalMinor: body.openingBalanceMinor ?? 0,
        incomeMinor: 0,
        expensesMinor: 0,
        excludeFromTotals: body.excludeFromTotals ?? false,
        sealed: false,
        color: body.color ?? 0,
        parentId: null,
      }
      accounts.push(account)
      return sendJson(response, 201, account, { Location: `/api/v1/accounts/${account.id}` })
    }
    const accountMatch = path.match(/^\/api\/v1\/accounts\/(\d+)$/)
    if (accountMatch) {
      const account = accounts.find((item) => item.id === Number(accountMatch[1]))
      if (!account) {
        return sendJson(response, 404, { error: 'account_not_found', message: 'Account not found' })
      }
      if (request.method === 'PUT') {
        const body = await readJson(request)
        account.label = body.label ?? account.label
        if (body.openingBalanceMinor !== undefined) {
          account.openingBalanceMinor = body.openingBalanceMinor
          account.currentBalanceMinor = body.openingBalanceMinor
        }
        if (body.excludeFromTotals !== undefined) account.excludeFromTotals = body.excludeFromTotals
        if (body.color !== undefined) account.color = body.color
        return sendJson(response, 200, account)
      }
      if (request.method === 'DELETE') {
        const index = accounts.findIndex((item) => item.id === account.id)
        accounts.splice(index, 1)
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        return response.end()
      }
      return sendJson(response, 200, account)
    }
    if (path === '/api/v1/accounts') return send(response, 200, JSON.stringify(accounts))
    if (path === '/api/v1/categories') return send(response, 200, JSON.stringify(categories))
    if (path === '/api/v1/payees') return send(response, 200, JSON.stringify(payees))
    if (path === '/api/v1/tags') return send(response, 200, JSON.stringify(tags))
    if (path === '/api/v1/methods') return send(response, 200, JSON.stringify(methods))

    const duplicateMatch = path.match(/^\/api\/v1\/budgets\/(\d+)\/duplicate$/)
    if (duplicateMatch) {
      const original = budgets.find((item) => item.id === Number(duplicateMatch[1]))
      if (!original) {
        return sendJson(response, 404, { error: 'budget_not_found', message: 'Budget not found' })
      }
      const copy = {
        ...original,
        id: nextBudgetId++,
        title: `${original.title} (copy)`,
        isDefault: false,
        uuid: `budget-${nextBudgetId}`,
        allocationMinor: original.allocationMinor ?? 0,
      }
      budgets.push(copy)
      budgetProgresses[copy.id] = {
        allocated: copy.allocationMinor ?? 0,
        spent: 0,
      }
      return sendJson(response, 201, copy, {
        Location: `/api/v1/budgets/${copy.id}`,
      })
    }

    const historyMatch = path.match(/^\/api\/v1\/budgets\/(\d+)\/history$/)
    if (historyMatch) {
      const id = Number(historyMatch[1])
      const values = budgetProgresses[id]
      if (!values) {
        return sendJson(response, 404, { error: 'budget_not_found', message: 'Budget not found' })
      }
      const count = Math.min(Math.max(Number(url.searchParams.get('months')) || 12, 1), 24)
      const points = []
      for (let offset = count - 1; offset >= 0; offset -= 1) {
        const date = new Date(year, month - 1 - offset, 1)
        const allocated = values.allocated
        const spent =
          offset === 0
            ? values.spent
            : Math.round(allocated * (0.55 + ((offset * 7) % 35) / 100))
        points.push({
          periodYear: date.getFullYear(),
          periodSecond: date.getMonth(),
          periodDescription: new Intl.DateTimeFormat('en-GB', {
            month: 'long',
            year: 'numeric',
          }).format(date),
          allocatedMinor: allocated,
          spentMinor: spent,
          remainingMinor: allocated - spent,
        })
      }
      return sendJson(response, 200, points)
    }

    const breakdownMatch = path.match(/^\/api\/v1\/budgets\/(\d+)\/breakdown$/)
    if (breakdownMatch) {
      const id = Number(breakdownMatch[1])
      const budget = budgets.find((item) => item.id === id)
      const values = budgetProgresses[id]
      if (!budget || !values) {
        return sendJson(response, 404, { error: 'budget_not_found', message: 'Budget not found' })
      }
      const qYear = Number(url.searchParams.get('year')) || year
      const rawSecond = url.searchParams.get('second')
      const qSecond = rawSecond === null ? month - 1 : Number(rawSecond)
      const qMonthNumber = qSecond + 1
      const override = (values.periodAllocated ?? {})[`${qYear}-${qSecond}`] ?? null
      return sendJson(response, 200, {
        budgetId: budget.id,
        accountId: budget.accountId,
        title: budget.title,
        currency: budget.currency,
        fractionDigits: budget.fractionDigits,
        grouping: budget.grouping,
        periodYear: qYear,
        periodSecond: qSecond,
        periodDescription: new Intl.DateTimeFormat('en-GB', {
          month: 'long',
          year: 'numeric',
        }).format(new Date(qYear, qSecond, 1)),
        periodStart: `${qYear}-${pad(qMonthNumber)}-01`,
        periodEnd: `${qYear}-${pad(qMonthNumber)}-${pad(
          new Date(qYear, qMonthNumber, 0).getDate(),
        )}`,
        totalAllocatedMinor: override ?? values.allocated,
        totalSpentMinor: values.spent,
        categories: budgetBreakdowns[id] ?? [],
      })
    }

    const allocationMatch = path.match(/^\/api\/v1\/budgets\/(\d+)\/allocations$/)
    if (allocationMatch) {
      const id = Number(allocationMatch[1])
      if (!budgets.some((item) => item.id === id)) {
        return sendJson(response, 404, { error: 'budget_not_found', message: 'Budget not found' })
      }
      if (request.method === 'PUT') {
        const body = await readJson(request)
        const rows = budgetAllocations[id] ?? []
        for (const allocation of body.allocations ?? []) {
          const row = rows.find((item) => item.categoryId === allocation.categoryId)
          if (row) row.allocatedMinor = allocation.amountMinor
          else {
            rows.push({
              categoryId: allocation.categoryId,
              label: `Category ${allocation.categoryId}`,
              level: 1,
              parentId: null,
              allocatedMinor: allocation.amountMinor,
              spentMinor: 0,
              rolloverPreviousMinor: 0,
              rolloverNextMinor: 0,
            })
          }
        }
        for (const allocation of body.allocations ?? []) {
          if (allocation.categoryId !== 0) continue
          const overrides = (budgetProgresses[id].periodAllocated ??= {})
          const key = `${body.year}-${body.second}`
          if (allocation.amountMinor === null) delete overrides[key]
          else overrides[key] = allocation.amountMinor
        }
        for (const rollover of body.rollover ?? []) {
          const row = rows.find((item) => item.categoryId === rollover.categoryId)
          if (row) row.rolloverNextMinor = rollover.amountMinor
        }
        budgetAllocations[id] = rows
        return sendJson(response, 200, rows)
      }
      return sendJson(response, 200, budgetAllocations[id] ?? [])
    }

    if (path === '/api/v1/budgets' && request.method === 'GET') {
      return sendJson(response, 200, budgets)
    }
    if (path === '/api/v1/budgets' && request.method === 'POST') {
      const body = await readJson(request)
      const account = accounts.find((item) => item.id === body.accountId)
      if (!account || !body.title || !body.amountMinor || !body.grouping) {
        return sendJson(response, 422, {
          error: 'validation_failed',
          message: 'accountId, title, grouping and amountMinor are required',
        })
      }
      if (!['DAY', 'WEEK', 'MONTH', 'YEAR', 'NONE'].includes(body.grouping)) {
        return sendJson(response, 422, { error: 'invalid_grouping', message: 'Invalid grouping' })
      }
      if (body.grouping === 'NONE' && (!body.start || !body.end)) {
        return sendJson(response, 422, {
          error: 'validation_failed',
          message: 'One-time budgets need start and end',
        })
      }
      const budget = {
        id: nextBudgetId++,
        accountId: account.id,
        title: body.title,
        description: body.description ?? null,
        currency: account.currency,
        fractionDigits: account.fractionDigits,
        grouping: body.grouping,
        color: 0,
        start: body.grouping === 'NONE' ? body.start : null,
        end: body.grouping === 'NONE' ? body.end : null,
        accountName: account.label,
        isDefault: body.isDefault ?? false,
        uuid: `budget-${nextBudgetId}`,
        allocationMinor: body.amountMinor,
        criteria: body.criteria ?? null,
        criteriaUnsupported: false,
      }
      budgets.push(budget)
      budgetProgresses[budget.id] = { allocated: body.amountMinor, spent: 0 }
      return sendJson(response, 201, budget, {
        Location: `/api/v1/budgets/${budget.id}`,
      })
    }
    const budgetMatch = path.match(/^\/api\/v1\/budgets\/(\d+)$/)
    if (budgetMatch) {
      const budget = budgets.find((item) => item.id === Number(budgetMatch[1]))
      const values = budgetProgresses[budgetMatch[1]]
      if (!budget || !values) {
        return sendJson(response, 404, { error: 'budget_not_found', message: 'Budget not found' })
      }
      if (request.method === 'PUT') {
        const body = await readJson(request)
        if (body.grouping && body.grouping !== budget.grouping) {
          return sendJson(response, 422, {
            error: 'unsupported_grouping_change',
            message: 'Changing the period type is not supported',
          })
        }
        budget.title = body.title ?? budget.title
        budget.description = body.description ?? null
        budget.isDefault = body.isDefault ?? budget.isDefault
        if (body.criteria) {
          const empty = !['categoryIds', 'payeeIds', 'methodIds', 'tagIds', 'statuses'].some(
            (key) => (body.criteria[key] ?? []).length > 0,
          )
          budget.criteria = empty ? null : body.criteria
        }
        if (body.amountMinor !== undefined) {
          budget.allocationMinor = body.amountMinor
          values.allocated = body.amountMinor
        }
        return sendJson(response, 200, budget)
      }
      if (request.method === 'DELETE') {
        budgets.splice(budgets.indexOf(budget), 1)
        delete budgetProgresses[budget.id]
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        return response.end()
      }
      const qYear = Number(url.searchParams.get('year')) || year
      // The API numbers months 0-11; `month` above is the UI's 1-12 value.
      const rawSecond = url.searchParams.get('second')
      const qSecond = rawSecond === null ? month - 1 : Number(rawSecond)
      const qMonthNumber = qSecond + 1
      const qMonthName = new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(qYear, qSecond, 1))
      const qStart = `${qYear}-${pad(qMonthNumber)}-01`
      const qEnd = `${qYear}-${pad(qMonthNumber)}-${pad(new Date(qYear, qMonthNumber, 0).getDate())}`
      const qTotalDays = new Date(qYear, qMonthNumber, 0).getDate()
      const qIsCurrent = qYear === year && qSecond === month - 1
      const qIsPast = qYear < year || (qYear === year && qSecond < month - 1)
      const qCurrentDay = qIsCurrent ? now.getDate() : qIsPast ? qTotalDays + 1 : 0
      const override = (values.periodAllocated ?? {})[`${qYear}-${qSecond}`] ?? null
      const allocated = override ?? values.allocated
      return sendJson(response, 200, {
        budgetId: budget.id,
        accountId: budget.accountId,
        title: budget.title,
        currency: budget.currency,
        fractionDigits: budget.fractionDigits,
        grouping: budget.grouping,
        periodYear: qYear,
        periodSecond: qSecond,
        periodStart: qStart,
        periodEnd: qEnd,
        periodDescription: qMonthName,
        allocatedMinor: allocated,
        spentMinor: values.spent,
        remainingMinor: allocated - values.spent,
        totalDays: qTotalDays,
        currentDay: qCurrentDay,
        periodAllocationMinor: override,
      })
    }

    if (path === '/api/v1/reports/transactions') {
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? ''
      const by = url.searchParams.get('by') ?? 'category'
      const type = url.searchParams.get('type') ?? 'expense'
      const groupId = Number(url.searchParams.get('id') ?? 0)
      const matchesType = (item) =>
        type === 'both' || (type === 'income' ? item.amountMinor > 0 : item.amountMinor < 0)
      const parents = transactions.filter(
        (item) =>
          item.date >= from &&
          item.date <= to &&
          !item.transferPeerId &&
          matchesType(item),
      )
      const rows = []
      for (const item of parents) {
        if (by === 'category' && item.kind === 'SPLIT') {
          for (const part of item.splitParts ?? splitParts) {
            if (part.category?.id !== groupId || !matchesType(part)) continue
            rows.push({
              ...item,
              id: part.id,
              kind: 'SIMPLE',
              amountMinor: part.amountMinor,
              payee: part.payee,
              category: part.category,
              tags: part.tags,
              comment: part.comment,
              method: part.method,
              splitParts: null,
            })
          }
          continue
        }
        const matches =
          by === 'category'
            ? item.category?.id === groupId
            : by === 'payee'
              ? (item.payee?.id ?? 0) === groupId
              : by === 'method'
                ? (item.method?.id ?? 0) === groupId
                : (item.tags ?? []).some((tag) => tag.id === groupId)
        if (matches) rows.push({ ...item, splitParts: null })
      }
      return sendJson(response, 200, {
        items: rows,
        total: rows.length,
        limit: 100,
        offset: 0,
      })
    }

    if (path === '/api/v1/reports/summary') {
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? ''
      const items = transactions.filter(
        (item) => item.date >= from && item.date <= to && !item.transferPeerId,
      )
      const income = items
        .filter((item) => item.amountMinor > 0)
        .reduce((total, item) => total + item.amountMinor, 0)
      const expenses = items
        .filter((item) => item.amountMinor < 0)
        .reduce((total, item) => total + item.amountMinor, 0)
      return sendJson(response, 200, {
        accountId: url.searchParams.get('accountId') === 'all' ? 0 : Number(url.searchParams.get('accountId')),
        from,
        to,
        currency: 'EUR',
        fractionDigits: 2,
        incomeMinor: income,
        expensesMinor: expenses,
        netMinor: income + expenses,
        count: items.length,
      })
    }

    if (path === '/api/v1/reports/breakdown') {
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? ''
      const by = url.searchParams.get('by') ?? 'category'
      const type = url.searchParams.get('type') ?? 'expense'
      const matchesType = (item) =>
        type === 'both' || (type === 'income' ? item.amountMinor > 0 : item.amountMinor < 0)
      const parents = transactions.filter(
        (item) =>
          item.date >= from &&
          item.date <= to &&
          !item.transferPeerId &&
          matchesType(item),
      )
      const entries = []
      if (by === 'category') {
        for (const item of parents) {
          if (item.kind === 'SPLIT') {
            for (const part of item.splitParts ?? splitParts) {
              if (!matchesType(part)) continue
              entries.push({
                id: part.category?.id ?? 0,
                label: part.category?.path ?? 'No category',
                amountMinor: Math.abs(part.amountMinor),
                count: 1,
              })
            }
          } else if (item.category) {
            entries.push({
              id: item.category.id,
              label: item.category.path ?? item.category.label,
              amountMinor: Math.abs(item.amountMinor),
              count: 1,
            })
          }
        }
      } else if (by === 'payee') {
        for (const item of parents) {
          entries.push({
            id: item.payee?.id ?? 0,
            label: item.payee?.label ?? 'No payee',
            amountMinor: Math.abs(item.amountMinor),
            count: 1,
          })
        }
      } else if (by === 'method') {
        for (const item of parents) {
          entries.push({
            id: item.method?.id ?? 0,
            label: item.method?.label ?? 'No method',
            amountMinor: Math.abs(item.amountMinor),
            count: 1,
          })
        }
      } else {
        for (const item of parents) {
          const list = item.tags?.length ? item.tags : []
          for (const tag of list) {
            entries.push({
              id: tag.id,
              label: tag.label,
              amountMinor: Math.abs(item.amountMinor),
              count: 1,
            })
          }
        }
      }
      const grouped = new Map()
      for (const entry of entries) {
        const key = `${entry.id}-${entry.label}`
        const current = grouped.get(key) ?? { ...entry, count: 0, amountMinor: 0 }
        current.count += entry.count
        current.amountMinor += entry.amountMinor
        grouped.set(key, current)
      }
      const items = [...grouped.values()]
      const total = items.reduce((sum, item) => sum + item.amountMinor, 0)
      const result = items
        .map((item) => ({
          ...item,
          share: total > 0 ? Math.round((item.amountMinor * 10000) / total) / 100 : 0,
        }))
        .sort((a, b) => b.amountMinor - a.amountMinor || a.label.localeCompare(b.label))
      return sendJson(response, 200, {
        accountId: url.searchParams.get('accountId') === 'all' ? 0 : Number(url.searchParams.get('accountId')),
        from,
        to,
        by,
        type,
        currency: 'EUR',
        fractionDigits: 2,
        totalMinor: total,
        items: result,
      })
    }

    if (path === '/api/v1/files') return sendJson(response, 200, files)
    const fileMatch = path.match(/^\/api\/v1\/files\/([^/]+)$/)
    if (fileMatch) {
      const name = fileMatch[1]
      const file = files.find((item) => item.name === name)
      if (!file) return send(response, 404, 'File not found', 'text/plain')
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      })
      return response.end(`Mock file ${name}\n`)
    }

    if (path === '/api/v1/reports/grouped') {
      // Same shape as the API: groups carry the first date of the period, so the
      // SPA can bucket rows without doing month or week arithmetic.
      const grouping = (url.searchParams.get('grouping') ?? 'MONTH').toUpperCase()
      const from = url.searchParams.get('from') || '0000-01-01'
      const to = url.searchParams.get('to') || '9999-12-31'
      const dayOfYear = (iso) => {
        const date = new Date(`${iso}T00:00:00`)
        const start = new Date(date.getFullYear(), 0, 1)
        return Math.floor((date - start) / 86400000) + 1
      }
      const weekNumber = (iso) => Math.floor((dayOfYear(iso) - 1) / 7) + 1
      const keyFor = (iso) => {
        if (grouping === 'NONE') return 'all'
        if (grouping === 'DAY') return iso
        if (grouping === 'WEEK') return `${iso.slice(0, 4)}-W${weekNumber(iso)}`
        if (grouping === 'YEAR') return iso.slice(0, 4)
        return iso.slice(0, 7)
      }
      const buckets = new Map()
      for (const item of transactions) {
        if (item.date < from || item.date > to) continue
        const key = keyFor(item.date)
        const entry = buckets.get(key) ?? {
          year: Number(item.date.slice(0, 4)),
          second: 0,
          incomeMinor: 0,
          expensesMinor: 0,
          transfersMinor: 0,
          firstDate: item.date,
        }
        if (grouping === 'MONTH') entry.second = Number(item.date.slice(5, 7)) - 1
        if (grouping === 'DAY') entry.second = dayOfYear(item.date)
        if (grouping === 'WEEK') entry.second = weekNumber(item.date)
        if (item.date < entry.firstDate) entry.firstDate = item.date
        if (item.transferPeerId) entry.transfersMinor += item.amountMinor
        else if (item.amountMinor > 0) entry.incomeMinor += item.amountMinor
        else entry.expensesMinor += item.amountMinor
        buckets.set(key, entry)
      }
      const result = [...buckets.values()].sort((left, right) =>
        left.firstDate.localeCompare(right.firstDate),
      )
      return sendJson(response, 200, result)
    }

    if (path === '/api/v1/transactions' && request.method === 'GET') {
      // No range means the whole history, newest first.
      const from = url.searchParams.get('from') || '0000-01-01'
      const to = url.searchParams.get('to') || '9999-12-31'
      const type = url.searchParams.get('type') ?? 'both'
      const limit = Number(url.searchParams.get('limit') ?? 50)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const ids = (name) =>
        url.searchParams
          .getAll(name)
          .flatMap((value) => value.split(','))
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0)
      const categoryIds = ids('categoryId')
      const payeeIds = ids('payeeId')
      const tagIds = ids('tagId')
      const methodIds = ids('methodId')
      const statuses = url.searchParams
        .getAll('status')
        .flatMap((value) => value.split(','))
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
      const fold = (value) =>
        String(value ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      const text = fold(url.searchParams.get('q') ?? '').trim()
      const amountMin = Number(url.searchParams.get('amountMin')) || null
      const amountMax = Number(url.searchParams.get('amountMax')) || null
      const transfer = url.searchParams.get('transfer')

      const matches = transactions.filter((item) => {
        if (item.date < from || item.date > to) return false
        if (type === 'income' && item.amountMinor <= 0) return false
        if (type === 'expense' && item.amountMinor >= 0) return false
        if (url.searchParams.get('uncategorized') === 'true' && item.category) return false
        if (categoryIds.length && !categoryIds.includes(item.category?.id)) return false
        if (payeeIds.length && !payeeIds.includes(item.payee?.id)) return false
        if (methodIds.length && !methodIds.includes(item.method?.id)) return false
        if (tagIds.length && !(item.tags ?? []).some((tag) => tagIds.includes(tag.id))) {
          return false
        }
        if (statuses.length && !statuses.includes(item.crStatus)) return false
        if (transfer === 'true' && !item.transferPeerId) return false
        if (transfer === 'false' && item.transferPeerId) return false
        if (amountMin !== null && Math.abs(item.amountMinor) < amountMin) return false
        if (amountMax !== null && Math.abs(item.amountMinor) > amountMax) return false
        if (text) {
          const haystack = fold(
            [item.comment, item.payee?.label, item.referenceNumber].filter(Boolean).join(' '),
          )
          if (!haystack.includes(text)) return false
        }
        return true
      })

      const items = matches
        .slice(offset, offset + limit)
        .map((item) => ({ ...item, splitParts: null }))
      return sendJson(response, 200, {
        items,
        total: matches.length,
        limit,
        offset,
      })
    }

    if (path === '/api/v1/transactions' && request.method === 'POST') {
      const body = await readJson(request)
      if (!body.accountId || !body.amountMinor || !body.date) {
        return sendJson(response, 422, {
          error: 'validation_failed',
          message: 'accountId, amountMinor and date are required',
          fields: { amountMinor: 'Required' },
        })
      }
      const item = transactionFromBody(body, nextId++)
      transactions.push(item)
      adjustBalance(item.accountId, item.amountMinor)
      sortTransactions()
      recomputeTotals()
      return sendJson(response, 201, item, {
        Location: `/api/v1/transactions/${item.id}`,
      })
    }

    const match = path.match(/^\/api\/v1\/transactions\/(\d+)$/)
    if (match) {
      const id = Number(match[1])
      const index = transactions.findIndex((item) => item.id === id)
      if (index < 0) {
        return sendJson(response, 404, { error: 'not_found', message: 'Not found' })
      }
      if (request.method === 'GET') {
        const transaction = transactions[index]
        return sendJson(response, 200, {
          ...transaction,
          splitParts: transaction.kind === 'SPLIT' ? transaction.splitParts ?? splitParts : null,
        })
      }
      if (request.method === 'PUT') {
        const previous = transactions[index]
        if (previous.kind !== 'SIMPLE') {
          return sendJson(response, 409, {
            error: 'unsupported_kind',
            message: 'Transfers and split transactions need their own endpoint',
          })
        }
        const body = await readJson(request)
        const updated = transactionFromBody(body, id, previous)
        transactions[index] = updated
        adjustBalance(previous.accountId, -previous.amountMinor)
        adjustBalance(updated.accountId, updated.amountMinor)
        sortTransactions()
        recomputeTotals()
        return sendJson(response, 200, updated)
      }
      if (request.method === 'DELETE') {
        const [removed] = transactions.splice(index, 1)
        adjustBalance(removed.accountId, -removed.amountMinor)
        recomputeTotals()
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        return response.end()
      }
      return sendJson(response, 405, { error: 'method_not_allowed', message: 'Method not allowed' })
    }

    send(response, 404, 'Not found', 'text/plain')
  } catch (error) {
    sendJson(response, 400, {
      error: 'bad_request',
      message: error instanceof Error ? error.message : 'Invalid request',
    })
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`mock web server on http://localhost:${port}/app/`)
  console.log('QA: ?login=1 ?view=transactions ?view=budgets ?view=files ?panel=split ?new=1 ?edit=split ?theme=dark ?metrics=1')
})
