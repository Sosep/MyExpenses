import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Contract tests for the dev mock. They run the real server in a child process
 * on an ephemeral port and exercise the rules the SPA relies on, so a fixture
 * edit cannot silently break the QA surface.
 */
const port = 4300 + Math.floor(Math.random() * 400)
const base = `http://127.0.0.1:${port}`
let server: ChildProcess

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cookie', 'myexpenses_session=mock')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  return fetch(base + path, { ...init, headers })
}

beforeAll(async () => {
  server = spawn(process.execPath, ['dev/mock-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, MOCK_PORT: String(port) },
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await api('/api/v1/meta')
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await delay(100)
  }
  throw new Error('the mock did not start')
}, 20_000)

afterAll(() => {
  server?.kill('SIGKILL')
})

describe('mock QA switches', () => {
  it('stores the portfolio licence limit from the documented switch', async () => {
    const page = await (await fetch(base + '/app/?portfolioLimit=1')).text()
    expect(page).toContain('mock_portfolio_limit=1')
    const response = await fetch(base + '/api/v1/portfolios', {
      method: 'POST',
      headers: {
        Cookie: 'myexpenses_session=mock; mock_portfolio_limit=1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: 'Limited', type: '6', currency: 'EUR' }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'portfolio_limit_reached' })
  })
})

describe('mock portfolio operations', () => {
  it('creates the cash sub-account on the first cash-funded buy', async () => {
    const portfolio = await (
      await api('/api/v1/portfolios', {
        method: 'POST',
        body: JSON.stringify({ label: 'Mock QA', type: '6', currency: 'EUR' }),
      })
    ).json()
    const tradeResponse = await api(`/api/v1/portfolios/${portfolio.id}/trades`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'BUY',
        assetSymbol: 'AAPL',
        quantity: '10',
        price: '5',
        fundingSource: 'PORTFOLIO',
        date: '2026-11-21',
      }),
    })
    expect(tradeResponse.status).toBe(201)
    const trade = await tradeResponse.json()
    expect(trade.peerAccountId).not.toBeNull()
    expect(trade.peerAccountLabel).toBe('Cash')

    const assets = await (await api(`/api/v1/portfolios/${portfolio.id}/assets`)).json()
    expect(assets.cashAccountId).toBe(trade.peerAccountId)

    const accounts = await (await api('/api/v1/accounts')).json()
    const cash = accounts.find((account: { id: number }) => account.id === trade.peerAccountId)
    expect(cash).toMatchObject({ portfolioRole: 'CASH', parentId: portfolio.id })
  })

  it('keeps the edited operation when its date moves it in the list', async () => {
    const portfolio = await (
      await api('/api/v1/portfolios', {
        method: 'POST',
        body: JSON.stringify({ label: 'Mock edit', type: '6', currency: 'EUR' }),
      })
    ).json()
    const trades = `/api/v1/portfolios/${portfolio.id}/trades`
    const first = await (
      await api(trades, {
        method: 'POST',
        body: JSON.stringify({
          type: 'DEPOSIT',
          quantity: '10',
          price: '1',
          fundingSource: 'EXTERNAL',
          date: '2026-11-01',
        }),
      })
    ).json()
    const second = await (
      await api(trades, {
        method: 'POST',
        body: JSON.stringify({
          type: 'DEPOSIT',
          quantity: '20',
          price: '1',
          fundingSource: 'EXTERNAL',
          date: '2026-11-02',
        }),
      })
    ).json()
    // Newest first: `second` is the row at index 0. Editing it to an older
    // date reorders the list, and the response must still be that operation.
    const updated = await api(`${trades}/${second.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'DEPOSIT',
        quantity: '20',
        price: '1',
        fundingSource: 'EXTERNAL',
        date: '2026-10-01',
      }),
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({ id: second.id, date: '2026-10-01' })

    const page = await (await api(trades)).json()
    expect(page.total).toBe(2)
    expect(page.items.map((item: { id: number }) => item.id)).toEqual([first.id, second.id])
  })
})

describe('mock validation', () => {
  it('rejects an asset that is not a registered commodity', async () => {
    const portfolio = await (
      await api('/api/v1/portfolios', {
        method: 'POST',
        body: JSON.stringify({ label: 'Mock asset guard', type: '6', currency: 'EUR' }),
      })
    ).json()
    const response = await api(`/api/v1/portfolios/${portfolio.id}/trades`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'BUY',
        assetSymbol: 'FAKE',
        quantity: '1',
        price: '1',
        fundingSource: 'PORTFOLIO',
        date: '2026-11-21',
      }),
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'unknown_asset' })
  })

  it('rejects a portfolio whose currency is not fiat', async () => {
    const response = await api('/api/v1/portfolios', {
      method: 'POST',
      body: JSON.stringify({
        label: 'Mock BTC',
        type: '6',
        currency: 'BTC',
        dynamicExchangeRates: true,
      }),
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'validation_failed' })
  })
})

describe('mock category rules', () => {
  it('refuses to delete a category used only by a split part', async () => {
    const before = await (await api('/api/v1/transactions/13')).json()
    const partCategory = before.splitParts.find(
      (part: { category: { id: number } | null }) => part.category?.id === 9,
    )
    expect(partCategory).toBeTruthy()

    const refused = await api('/api/v1/categories/9', { method: 'DELETE' })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toMatchObject({ error: 'category_in_use' })

    const remapped = await api('/api/v1/categories/9?remapTo=4', { method: 'DELETE' })
    expect(remapped.status).toBe(204)
    const after = await (await api('/api/v1/transactions/13')).json()
    const moved = after.splitParts.find(
      (part: { id: number }) => part.id === partCategory.id,
    )
    expect(moved.category).toMatchObject({ id: 4, label: 'Transport' })
  })

  it('rejects moving the movements into the deleted branch', async () => {
    const response = await api('/api/v1/categories/1?remapTo=2', { method: 'DELETE' })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'invalid_remapTo' })
  })
})

describe('mock reports', () => {
  const now = new Date()
  const from = `${now.getFullYear()}-01-01`
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  it('draws a dense balance series with a total per currency', async () => {
    const response = await api(
      `/api/v1/reports/balance-series?accountIds=1,2&from=${from}&to=${to}&granularity=month`,
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.granularity).toBe('MONTH')
    expect(body.accounts).toHaveLength(2)
    expect(body.accounts[0].series.length).toBeGreaterThan(1)
    expect(body.accounts[0].series.at(-1).date).toBe(to)
    expect(body.totals).toHaveLength(1)
    expect(body.totals[0].currency).toBe('EUR')
    expect(body.mixedCurrencies).toBe(false)
  })

  it('separates currencies instead of converting them', async () => {
    const response = await api(
      `/api/v1/reports/balance-series?accountIds=1&from=${from}&to=${to}&mixedCurrency=1`,
    )
    const body = await response.json()
    expect(body.mixedCurrencies).toBe(true)
    expect(body.totals.map((entry: { currency: string }) => entry.currency)).toEqual([
      'EUR',
      'USD',
    ])
  })

  it('rejects an unknown account or granularity', async () => {
    const missing = await api(
      `/api/v1/reports/balance-series?accountIds=99&from=${from}&to=${to}`,
    )
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: 'account_not_found' })
    const granularity = await api(
      `/api/v1/reports/balance-series?accountIds=1&from=${from}&to=${to}&granularity=hour`,
    )
    expect(granularity.status).toBe(400)
    expect(await granularity.json()).toMatchObject({ error: 'invalid_granularity' })
  })

  it('returns the investments with the last manual valuation', async () => {
    const body = await (await api('/api/v1/reports/investments')).json()
    expect(body.portfolios.length).toBeGreaterThan(0)
    expect(body.portfolios[0].lastValuationDate).toBeTruthy()
    expect(body.portfolios[0].assets.length).toBeGreaterThan(0)
    expect(body.totals[0].currency).toBe('EUR')
  })

  it('can hide the result when a cost is unknown', async () => {
    const body = await (await api('/api/v1/reports/investments?costUnknown=1')).json()
    const asset = body.portfolios[0].assets[0]
    expect(asset.costKnown).toBe(false)
    expect(asset.costMinor).toBeNull()
    expect(asset.resultMinor).toBeNull()
  })

  it('returns refunds separately from income', async () => {
    const body = await (
      await api(`/api/v1/reports/summary?accountId=all&from=${from}&to=${to}`)
    ).json()
    expect(body).toHaveProperty('returnsMinor')
    expect(body.returnsMinor).toBeGreaterThanOrEqual(0)
  })

  it('filters a category breakdown by its branch', async () => {
    const body = await (
      await api(
        `/api/v1/reports/breakdown?accountId=all&by=category&type=expense&from=${from}&to=${to}&categoryId=1`,
      )
    ).json()
    expect(body.items.length).toBeGreaterThan(0)
    expect(
      body.items.every((item: { id: number }) => [1, 2, 5, 9].includes(item.id)),
    ).toBe(true)
  })

  it('aggregates grouped flows for all accounts', async () => {
    const response = await api(
      `/api/v1/reports/grouped?accountId=all&grouping=MONTH&from=${from}&to=${to}`,
    )
    expect(response.status).toBe(200)
    expect((await response.json()).length).toBeGreaterThan(0)
  })
})
