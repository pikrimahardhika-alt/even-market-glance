import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createMarketApiServer } from '../server/market-api.mjs'

const statsFixture = {
  open: '100',
  high: '120',
  low: '90',
  last: '110',
  volume: '1234.5',
}

async function startServer(t, options = {}) {
  const server = createMarketApiServer(options)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  const address = server.address()
  return `http://127.0.0.1:${address.port}`
}

test('health endpoint returns a local backend status', async (t) => {
  const base = await startServer(t)
  const response = await fetch(`${base}/api/health`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.deepEqual(await response.json(), { ok: true, service: 'market-glance-local-api' })
})

test('market endpoint returns validated, read-only Coinbase stats and caches briefly', async (t) => {
  let calls = 0
  const base = await startServer(t, {
    now: () => 1_800_000_000_000,
    fetchImpl: async (url, options) => {
      calls += 1
      assert.match(String(url), /\/products\/BTC-USD\/stats$/)
      assert.equal(options.method, 'GET')
      return new Response(JSON.stringify(statsFixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const first = await fetch(`${base}/api/market/BTC-USD`)
  const payload = await first.json()
  assert.equal(first.status, 200)
  assert.equal(payload.productId, 'BTC-USD')
  assert.deepEqual(payload.stats, { open: 100, high: 120, low: 90, last: 110, volume: 1234.5 })
  assert.equal(payload.stale, false)
  assert.equal(payload.source, 'Coinbase Exchange public market stats')

  const second = await fetch(`${base}/api/market/BTC-USD`)
  assert.equal(second.status, 200)
  assert.equal((await second.json()).cached, true)
  assert.equal(calls, 1)
})

test('market endpoint rejects unsupported products without calling upstream', async (t) => {
  let calls = 0
  const base = await startServer(t, { fetchImpl: async () => { calls += 1 } })
  const response = await fetch(`${base}/api/market/NOT-ALLOWED`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Unsupported market product' })
  assert.equal(calls, 0)
})

test('expired cached data is returned as stale if Coinbase is temporarily unavailable', async (t) => {
  let currentTime = 1_800_000_000_000
  let failing = false
  const base = await startServer(t, {
    now: () => currentTime,
    cacheTtlMs: 5,
    fetchImpl: async () => {
      if (failing) throw new Error('simulated upstream outage')
      return new Response(JSON.stringify(statsFixture), { status: 200 })
    },
  })

  const first = await fetch(`${base}/api/market/ETH-USD`)
  assert.equal(first.status, 200)
  const firstPayload = await first.json()
  currentTime += 10
  failing = true

  const second = await fetch(`${base}/api/market/ETH-USD`)
  const stalePayload = await second.json()
  assert.equal(second.status, 200)
  assert.equal(stalePayload.stale, true)
  assert.equal(stalePayload.fetchedAt, firstPayload.fetchedAt)
  assert.match(stalePayload.warning, /last successful response/i)
})

test('invalid upstream market data fails closed with 502', async (t) => {
  const base = await startServer(t, {
    fetchImpl: async () => new Response(JSON.stringify({ open: 'NaN' }), { status: 200 }),
  })
  const response = await fetch(`${base}/api/market/SOL-USD`)
  assert.equal(response.status, 502)
  assert.match((await response.json()).error, /unavailable/i)
})
