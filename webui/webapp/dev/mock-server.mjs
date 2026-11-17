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

const accounts = [
  {
    id: 1,
    label: 'Everyday',
    type: 'BANK',
    currency: 'EUR',
    fractionDigits: 2,
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
    type: 'BANK',
    currency: 'EUR',
    fractionDigits: 2,
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
    type: 'SAVINGS',
    currency: 'EUR',
    fractionDigits: 2,
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
]

const payees = [
  { id: 1, name: 'Mercadona' },
  { id: 2, name: 'Employer' },
  { id: 3, name: 'Renfe' },
  { id: 4, name: 'Pizzeria Antonella' },
  { id: 5, name: 'Electricity' },
  { id: 6, name: 'Bookshop' },
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
  { id: 1, label: 'Card', isNumbered: false, type: 0, accountTypes: ['BANK', 'CASH'] },
  { id: 2, label: 'Cash', isNumbered: false, type: 0, accountTypes: ['CASH'] },
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
    category: { id: 7, label: 'Leisure', path: 'Leisure' },
    tags: [{ id: 4, label: 'gift' }],
  }),
]

const fillerNames = ['Cafe', 'Supermarket', 'Pharmacy', 'Cinema', 'Fuel']
const fillerPaths = ['Food > Groceries', 'Food > Restaurants', 'Home > Household', 'Transport']
const fillers = Array.from({ length: 52 }, (_, index) =>
  tx({
    id: 100 + index,
    amountMinor: -(1000 + (index % 9) * 137),
    date: iso((index % 27) + 1),
    valueDate: iso((index % 27) + 1),
    payee: { id: 20 + (index % 5), label: fillerNames[index % 5] },
    category: {
      id: 20 + (index % 4),
      label: fillerPaths[index % 4].split(' > ').at(-1),
      path: fillerPaths[index % 4],
    },
    tags: index % 3 === 0 ? [{ id: 10, label: 'daily' }] : [],
    crStatus: index % 4 === 0 ? 'RECONCILED' : 'UNRECONCILED',
  }),
)

const transactions = [...special, ...fillers].sort((a, b) => b.date.localeCompare(a.date))

const splitParts = [
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
  },
]

const currentExpenses = transactions
  .filter((item) => item.amountMinor < 0)
  .reduce((total, item) => total + item.amountMinor, 0)
const currentIncome = transactions
  .filter((item) => item.amountMinor > 0)
  .reduce((total, item) => total + item.amountMinor, 0)

const incomes = [280000, 295000, 310000, 290000, 305000, 312000, 298000, 301000, 320000, 309000, 315000]
const expenses = [-240000, -255000, -268000, -250000, -262000, -271000, -259000, -266000, -280000, -272000]
const groups = []
for (let index = 11; index >= 0; index -= 1) {
  const date = new Date(year, month - 1 - index, 1)
  groups.push({
    year: date.getFullYear(),
    second: date.getMonth() + 1,
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
        if (q.get('login') !== '1') {
          sessionStorage.setItem('myexpenses.auth','Basic '+btoa(':'))
        }
        localStorage.setItem('myexpenses.theme','light')
        window.addEventListener('load', function(){
          if (q.get('theme') === 'dark') {
            setTimeout(function(){ document.querySelector('button[aria-label="Switch to dark"]')?.click() }, 120)
          }
          if (q.get('view') === 'transactions') {
            setTimeout(function(){ document.querySelector('button[aria-label="Transactions"]')?.click() }, 250)
            var panel = q.get('panel')
            if (panel) {
              setTimeout(function(){
                var rows = document.querySelectorAll('tbody tr')
                var target = null
                for (var i = 0; i < rows.length; i++) {
                  if (rows[i].textContent && rows[i].textContent.indexOf('Split transaction') >= 0) {
                    target = rows[i]
                    break
                  }
                }
                ;(target || rows[Number(panel) - 1])?.click()
              }, 900)
            }
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
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`)
  const path = decodeURIComponent(url.pathname)

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
  if (path === '/api/v1/accounts') return send(response, 200, JSON.stringify(accounts))
  if (path === '/api/v1/categories') return send(response, 200, JSON.stringify(categories))
  if (path === '/api/v1/payees') return send(response, 200, JSON.stringify(payees))
  if (path === '/api/v1/tags') return send(response, 200, JSON.stringify(tags))
  if (path === '/api/v1/methods') return send(response, 200, JSON.stringify(methods))

  if (path === '/api/v1/reports/grouped') {
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''
    const fromYear = Number(from.slice(0, 4))
    const fromMonth = Number(from.slice(5, 7))
    const toYear = Number(to.slice(0, 4))
    const toMonth = Number(to.slice(5, 7))
    const filtered = groups.filter((group) => {
      const value = group.year * 12 + group.second
      return value >= fromYear * 12 + fromMonth && value <= toYear * 12 + toMonth
    })
    return send(response, 200, JSON.stringify(filtered))
  }

  if (path === '/api/v1/transactions') {
    const from = url.searchParams.get('from') ?? ''
    const to = url.searchParams.get('to') ?? ''
    const type = url.searchParams.get('type') ?? 'both'
    const limit = Number(url.searchParams.get('limit') ?? 50)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    let items = transactions.filter((item) => item.date >= from && item.date <= to)
    if (type === 'income') items = items.filter((item) => item.amountMinor > 0)
    if (type === 'expense') items = items.filter((item) => item.amountMinor < 0)
    const total = items.length
    items = items.slice(offset, offset + limit).map((item) => ({ ...item, splitParts: null }))
    return send(response, 200, JSON.stringify({ items, total, limit, offset }))
  }

  const match = path.match(/^\/api\/v1\/transactions\/(\d+)$/)
  if (match) {
    const id = Number(match[1])
    const transaction = transactions.find((item) => item.id === id)
    if (!transaction) {
      return send(response, 404, JSON.stringify({ error: 'not_found', message: 'Not found' }))
    }
    return send(
      response,
      200,
      JSON.stringify({
        ...transaction,
        splitParts: transaction.kind === 'SPLIT' ? splitParts : null,
      }),
    )
  }

  send(response, 404, 'Not found', 'text/plain')
}).listen(port, '127.0.0.1', () => {
  console.log(`mock web server on http://localhost:${port}/app/`)
  console.log('QA: ?login=1 ?view=transactions ?panel=split ?theme=dark ?metrics=1')
})
