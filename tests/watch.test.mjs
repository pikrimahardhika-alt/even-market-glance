import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPriceWatch,
  formatMarketText,
  isPriceWatchReached,
  parseMarketSnapshot,
  parsePriceWatchStore,
} from '../src/market.ts'

const stats = { open: 100, high: 125, low: 75, last: 110, volume: 2500 }
const fetchedAt = '2026-11-20T00:00:00.000Z'
const snapshot = (overrides = {}) => parseMarketSnapshot(
  'BTC-USD',
  { ...stats, ...overrides },
  fetchedAt,
  overrides.stale ?? false,
)

test('price watch markers are local ±1% presets from a fresh reference price', () => {
  const live = snapshot()
  const above = createPriceWatch(live, 'above', fetchedAt)
  const below = createPriceWatch(live, 'below', fetchedAt)

  assert.equal(above.productId, 'BTC-USD')
  assert.equal(above.referencePrice, 110)
  assert.equal(above.targetPrice, 111.1)
  assert.equal(above.movePercent, 1)
  assert.equal(below.targetPrice, 108.9)
})

test('stale snapshots and invalid timestamps cannot create a price watch', () => {
  assert.throws(() => createPriceWatch(snapshot({ stale: true }), 'above', fetchedAt), /live snapshot/i)
  assert.throws(() => createPriceWatch(snapshot(), 'above', 'not-a-date'), /timestamp/i)
})

test('watch storage round-trips valid per-asset markers and ignores corrupt data', () => {
  const watch = createPriceWatch(snapshot(), 'above', fetchedAt)
  const serialized = JSON.stringify({ 'BTC-USD': watch })
  assert.deepEqual(parsePriceWatchStore(serialized), { 'BTC-USD': watch })
  assert.deepEqual(parsePriceWatchStore('{broken'), {})
  assert.deepEqual(parsePriceWatchStore(JSON.stringify({ 'BTC-USD': { ...watch, targetPrice: 1 } })), {})
  assert.deepEqual(parsePriceWatchStore(JSON.stringify({ 'NOT-ALLOWED': watch })), {})
})

test('watch reached state is live-only, asset-specific, and directional', () => {
  const live = snapshot()
  const above = createPriceWatch(live, 'above', fetchedAt)
  const below = createPriceWatch(live, 'below', fetchedAt)

  assert.equal(isPriceWatchReached(snapshot({ last: 111.1 }), above), true)
  assert.equal(isPriceWatchReached(snapshot({ last: 110.9 }), above), false)
  assert.equal(isPriceWatchReached(snapshot({ last: 108.9 }), below), true)
  assert.equal(isPriceWatchReached(snapshot({ last: 108.9, stale: true }), below), false)
  assert.equal(isPriceWatchReached(parseMarketSnapshot('ETH-USD', stats, fetchedAt), below), false)
})

test('an active marker adds one concise, read-only line to the G2 glance', () => {
  const live = snapshot()
  const watch = createPriceWatch(live, 'above', fetchedAt)
  const glance = formatMarketText(live, 0, 'glance', `WATCH ABOVE $${watch.targetPrice.toFixed(2)}`)

  assert.match(glance, /WATCH ABOVE \$111\.10/)
  assert.ok(glance.split('\n').length <= 10)
  assert.doesNotMatch(glance, /buy now|sell now|alert|trade/i)
})
