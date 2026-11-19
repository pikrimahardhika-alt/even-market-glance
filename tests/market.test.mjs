import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMarketText, formatPercent, parseMarketSnapshot, rangePosition } from '../src/market.ts'

const validStats = { open: '100', high: '125', low: '75', last: '110', volume: '2500' }

test('snapshot parsing computes the 24-hour change from Coinbase open and last', () => {
  const snapshot = parseMarketSnapshot('BTC-USD', validStats, '2026-11-19T17:00:00.000Z')
  assert.equal(snapshot.changePercent, 10)
  assert.equal(snapshot.last, 110)
  assert.equal(snapshot.stale, false)
})

test('snapshot parsing rejects incomplete or impossible values', () => {
  assert.throws(() => parseMarketSnapshot('BTC-USD', { open: 0 }, '2026-11-19T17:00:00Z'), /Invalid Coinbase stats/)
  assert.throws(() => parseMarketSnapshot('BTC-USD', { ...validStats, open: 0 }, '2026-11-19T17:00:00Z'), /Impossible Coinbase stats/)
  assert.throws(() => parseMarketSnapshot('BTC-USD', { ...validStats, high: 10, low: 20 }, '2026-11-19T17:00:00Z'), /Impossible Coinbase stats/)
})

test('percent formatting marks positive movement but not negative movement', () => {
  assert.equal(formatPercent(2.345), '+2.35%')
  assert.equal(formatPercent(-0.7), '-0.70%')
})

test('G2 glance and detail views stay concise and explicitly read-only', () => {
  const snapshot = parseMarketSnapshot('BTC-USD', validStats, '2026-11-19T17:08:00Z')
  const glance = formatMarketText(snapshot, 0, 'glance')
  const detail = formatMarketText(snapshot, 0, 'detail')
  assert.match(glance, /MARKET GLANCE/)
  assert.match(glance, /24H\s+\+10\.00%/)
  assert.match(glance, /MENU: MARK/)
  assert.match(detail, /READ ONLY \| MENU: MARK \| TAP BACK/)
  assert.ok(Buffer.byteLength(glance, 'utf8') < 1_000)
  assert.ok(Buffer.byteLength(detail, 'utf8') < 1_000)
  assert.ok(glance.split('\n').length <= 9)
  assert.ok(detail.split('\n').length <= 10)
  assert.doesNotMatch(`${glance}\n${detail}`, /buy now|sell now|recommendation/i)
})

test('range position is bounded and handles a flat 24-hour range', () => {
  const normal = parseMarketSnapshot('BTC-USD', validStats, '2026-11-19T17:08:00Z')
  assert.equal(rangePosition(normal), 70)
  const flat = parseMarketSnapshot('BTC-USD', { open: 100, high: 100, low: 100, last: 100, volume: 0 }, '2026-11-19T17:08:00Z')
  assert.equal(rangePosition(flat), 50)
})
