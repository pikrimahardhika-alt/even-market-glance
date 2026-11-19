export const WATCHLIST = [
  { productId: 'BTC-USD', ticker: 'BTC', name: 'Bitcoin' },
  { productId: 'ETH-USD', ticker: 'ETH', name: 'Ethereum' },
  { productId: 'SOL-USD', ticker: 'SOL', name: 'Solana' },
] as const

export type ProductId = (typeof WATCHLIST)[number]['productId']
export type DisplayMode = 'glance' | 'detail'

export interface CoinbaseStats {
  open: number
  high: number
  low: number
  last: number
  volume: number
}

export interface MarketSnapshot extends CoinbaseStats {
  productId: ProductId
  changePercent: number
  fetchedAt: string
  stale: boolean
}

export interface MarketApiResponse {
  productId: ProductId
  stats: Record<string, unknown>
  fetchedAt: string
  stale: boolean
  source: string
}

export type WatchDirection = 'above' | 'below'

export interface PriceWatch {
  productId: ProductId
  direction: WatchDirection
  referencePrice: number
  targetPrice: number
  movePercent: 1
  createdAt: string
}

export type PriceWatchStore = Partial<Record<ProductId, PriceWatch>>

const money = (value: number): string => {
  const digits = value > 0 && value < 1 ? 4 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function getAsset(productId: ProductId) {
  return WATCHLIST.find((asset) => asset.productId === productId) ?? WATCHLIST[0]
}

export function parseMarketSnapshot(
  productId: ProductId,
  stats: Record<string, unknown>,
  fetchedAt: string,
  stale = false,
): MarketSnapshot {
  const values = ['open', 'high', 'low', 'last', 'volume'] as const
  const parsed: CoinbaseStats = {
    open: Number(stats.open),
    high: Number(stats.high),
    low: Number(stats.low),
    last: Number(stats.last),
    volume: Number(stats.volume),
  }

  if (values.some((key) => !Number.isFinite(parsed[key]))) {
    throw new Error(`Invalid Coinbase stats for ${productId}`)
  }
  if (parsed.open <= 0 || parsed.low < 0 || parsed.high < parsed.low || parsed.volume < 0) {
    throw new Error(`Impossible Coinbase stats for ${productId}`)
  }

  return {
    productId,
    ...parsed,
    changePercent: ((parsed.last - parsed.open) / parsed.open) * 100,
    fetchedAt,
    stale,
  }
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function roundPrice(value: number, referencePrice: number): number {
  const factor = referencePrice > 0 && referencePrice < 1 ? 10_000 : 100
  return Math.round(value * factor) / factor
}

export function createPriceWatch(
  snapshot: MarketSnapshot,
  direction: WatchDirection,
  createdAt = new Date().toISOString(),
): PriceWatch {
  if (snapshot.stale) throw new Error('A live snapshot is required to set a price watch')
  if (!Number.isFinite(snapshot.last) || snapshot.last <= 0) {
    throw new Error('A positive live price is required to set a price watch')
  }
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('Invalid price watch timestamp')

  const factor = direction === 'above' ? 1.01 : 0.99
  const targetPrice = roundPrice(snapshot.last * factor, snapshot.last)
  if (targetPrice <= 0) throw new Error('Price watch target must be positive')

  return {
    productId: snapshot.productId,
    direction,
    referencePrice: snapshot.last,
    targetPrice,
    movePercent: 1,
    createdAt,
  }
}

export function parsePriceWatchStore(serialized: string | null): PriceWatchStore {
  if (!serialized) return {}
  try {
    const value: unknown = JSON.parse(serialized)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    const source = value as Record<string, unknown>
    const result: PriceWatchStore = {}
    for (const asset of WATCHLIST) {
      const item = source[asset.productId]
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const candidate = item as Record<string, unknown>
      const direction = candidate.direction
      const referencePrice = candidate.referencePrice
      const targetPrice = candidate.targetPrice
      const createdAt = candidate.createdAt
      if (
        candidate.productId !== asset.productId ||
        (direction !== 'above' && direction !== 'below') ||
        typeof referencePrice !== 'number' || !Number.isFinite(referencePrice) || referencePrice <= 0 ||
        typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice <= 0 ||
        candidate.movePercent !== 1 ||
        typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))
      ) continue

      const expected = roundPrice(referencePrice * (direction === 'above' ? 1.01 : 0.99), referencePrice)
      if (Math.abs(expected - targetPrice) > (referencePrice < 1 ? 0.0001 : 0.01)) continue
      result[asset.productId] = {
        productId: asset.productId,
        direction,
        referencePrice,
        targetPrice,
        movePercent: 1,
        createdAt,
      }
    }
    return result
  } catch {
    return {}
  }
}

export function isPriceWatchReached(snapshot: MarketSnapshot, watch: PriceWatch): boolean {
  if (snapshot.stale || snapshot.productId !== watch.productId) return false
  return watch.direction === 'above'
    ? snapshot.last >= watch.targetPrice
    : snapshot.last <= watch.targetPrice
}

export function formatMarketText(
  snapshot: MarketSnapshot | undefined,
  index: number,
  mode: DisplayMode,
  watchLine?: string,
): string {
  const asset = WATCHLIST[index] ?? WATCHLIST[0]
  const ordinal = `${String(index + 1).padStart(2, '0')}/${WATCHLIST.length}`

  if (!snapshot) {
    return [
      `MARKET GLANCE ${ordinal}`,
      `${asset.productId} | COINBASE`,
      'DATA NOT AVAILABLE',
      'TRY REFRESH IN PREVIEW',
      'SWIPE: CHANGE ASSET',
    ].join('\n')
  }

  const asOf = new Date(snapshot.fetchedAt)
  const time = Number.isNaN(asOf.getTime())
    ? '--:-- UTC'
    : `${new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(asOf)} UTC`
  const staleNote = snapshot.stale ? '  STALE' : ''

  if (mode === 'detail') {
    return [
      `MARKET BRIEF ${ordinal}`,
      `${snapshot.productId} | COINBASE`,
      `LAST ${money(snapshot.last)}`,
      `OPEN ${money(snapshot.open)}`,
      `HIGH ${money(snapshot.high)}`,
      `LOW ${money(snapshot.low)}`,
      `24H ${formatPercent(snapshot.changePercent)}`,
      `VOL ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(snapshot.volume)} ${asset.ticker}`,
      `AS OF ${time}${staleNote}`,
      'READ ONLY | MENU: MARK | TAP BACK',
    ].join('\n')
  }

  const lines = [
    `MARKET GLANCE ${ordinal}`,
    `${snapshot.productId} | COINBASE`,
    `LAST ${money(snapshot.last)}`,
    `24H ${formatPercent(snapshot.changePercent)}`,
    `HIGH ${money(snapshot.high)}`,
    `LOW ${money(snapshot.low)}`,
    `VOL ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(snapshot.volume)} ${asset.ticker}`,
    `AS OF ${time}${staleNote}`,
    'SWIPE ASSET | TAP DETAIL | MENU: MARK',
  ]
  if (watchLine) lines.splice(lines.length - 1, 0, watchLine)
  return lines.join('\n')
}

export function rangePosition(snapshot: MarketSnapshot): number {
  const span = snapshot.high - snapshot.low
  if (span <= 0) return 50
  return Math.min(100, Math.max(0, ((snapshot.last - snapshot.low) / span) * 100))
}
