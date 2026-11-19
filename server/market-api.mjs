import { createServer } from 'node:http'

const ALLOWED_PRODUCTS = new Set(['BTC-USD', 'ETH-USD', 'SOL-USD'])
const UPSTREAM = 'https://api.exchange.coinbase.com/products'
const CACHE_TTL_MS = 10_000
const REQUEST_TIMEOUT_MS = 7_000

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(payload))
}

export function createMarketApiHandler({
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  cacheTtlMs = CACHE_TTL_MS,
} = {}) {
  const cache = new Map()

  return async function handleMarketApi(req, res, next = () => {}) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '86400',
      })
      return res.end()
    }

    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'market-glance-local-api' })
    }

    const match = /^\/api\/market\/([A-Z0-9-]+)$/.exec(url.pathname)
    if (!match || req.method !== 'GET') {
      return sendJson(res, 404, { error: 'Not found' })
    }

    const productId = match[1]
    if (!ALLOWED_PRODUCTS.has(productId)) {
      return sendJson(res, 400, { error: 'Unsupported market product' })
    }

    const previous = cache.get(productId)
    if (previous && now() - previous.cachedAt < cacheTtlMs) {
      return sendJson(res, 200, { ...previous.payload, cached: true })
    }

    try {
      const response = await fetchImpl(`${UPSTREAM}/${productId}/stats`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': 'MarketGlance-local-prototype/0.1',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Coinbase returned HTTP ${response.status}`)

      const raw = await response.json()
      const stats = Object.fromEntries(['open', 'high', 'low', 'last', 'volume'].map((key) => {
        const value = Number(raw?.[key])
        if (!Number.isFinite(value)) throw new Error(`Coinbase response is missing ${key}`)
        return [key, value]
      }))
      if (stats.open <= 0 || stats.high < stats.low || stats.volume < 0) {
        throw new Error('Coinbase response contains invalid market statistics')
      }

      const payload = {
        productId,
        stats,
        fetchedAt: new Date(now()).toISOString(),
        source: 'Coinbase Exchange public market stats',
        stale: false,
      }
      cache.set(productId, { payload, cachedAt: now() })
      return sendJson(res, 200, payload)
    } catch (error) {
      if (previous) {
        return sendJson(res, 200, {
          ...previous.payload,
          stale: true,
          warning: 'Upstream unavailable; showing the last successful response.',
        })
      }
      return sendJson(res, 502, {
        error: 'Market data is temporarily unavailable.',
        detail: error instanceof Error ? error.message : 'Unknown upstream error',
      })
    }
  }
}

export function createMarketApiServer(options = {}) {
  const handler = createMarketApiHandler(options)
  return createServer((req, res) => {
    void handler(req, res, () => sendJson(res, 404, { error: 'Not found' }))
  })
}
