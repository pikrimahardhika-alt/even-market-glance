import './style.css'
import {
  CreateStartUpPageContainer,
  MenuContainerProperty,
  MenuItemProperty,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import {
  formatMarketText,
  formatPercent,
  createPriceWatch,
  isPriceWatchReached,
  parseMarketSnapshot,
  parsePriceWatchStore,
  rangePosition,
  WATCHLIST,
  type MarketApiResponse,
  type MarketSnapshot,
  type ProductId,
  type PriceWatchStore,
  type WatchDirection,
} from './market.ts'

const MARKET_API_BASE = (import.meta.env.VITE_MARKET_API_BASE ?? '').replace(/\/$/, '')
const WATCH_STORAGE_KEY = 'market-glance:price-watch:v1'
const WATCH_MENU_IDS = { above: 1, below: 2, clear: 3 } as const
const WATCH_MENU = new MenuContainerProperty({
  menuItems: [
    new MenuItemProperty({ itemName: 'Mark +1%', itemID: WATCH_MENU_IDS.above }),
    new MenuItemProperty({ itemName: 'Mark -1%', itemID: WATCH_MENU_IDS.below }),
    new MenuItemProperty({ itemName: 'Clear mark', itemID: WATCH_MENU_IDS.clear }),
  ],
})

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root')

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="Market Glance home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>MARKET<span class="brand-light">GLANCE</span></span>
      </a>
      <div class="topbar-meta">
        <span class="prototype-tag"><span class="tag-dot"></span> PRIVATE PROTOTYPE</span>
        <span class="environment-pill" id="environment-label">WEB PREVIEW</span>
      </div>
    </header>

    <main id="top">
      <section class="intro" aria-labelledby="page-title">
        <div class="intro-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> EVEN REALITIES G2 · EXCHANGES &amp; STOCKS</p>
          <h1 id="page-title">The market,<br /><em>without the noise.</em></h1>
          <p class="intro-description">A calm live market briefing with a local price marker. One glance at three markets; no trade controls, accounts or background alerts.</p>
        </div>
        <div class="intro-aside">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <div class="intro-stat"><span class="intro-stat-label">DESIGNED FOR</span><strong>576 × 288</strong><span class="intro-stat-foot">monochrome G2 display</span></div>
          <div class="aside-index">01 <span>/</span> GLANCE</div>
        </div>
      </section>

      <section class="workspace" aria-label="Market briefing preview">
        <aside class="watchlist-panel panel">
          <div class="panel-heading">
            <div><span class="section-kicker">YOUR TAPE</span><h2>Watchlist</h2></div>
            <span class="count-badge">03</span>
          </div>
          <p class="panel-subtitle">Coinbase Exchange · USD pairs</p>
          <div class="asset-list" id="asset-list" aria-label="Choose an asset"></div>
          <div class="watchlist-bottom">
            <div class="read-only-badge"><span aria-hidden="true">◌</span> READ ONLY</div>
            <p>No orders, custody, or<br />financial recommendations.</p>
          </div>
        </aside>

        <section class="preview-column" aria-label="Even G2 display simulator">
          <div class="display-panel panel">
            <div class="panel-heading display-heading">
              <div><span class="section-kicker">LIVE DISPLAY PREVIEW</span><h2>Even G2</h2></div>
              <div class="data-state" id="data-state"><span class="state-light"></span><span id="data-state-text">CONNECTING</span></div>
            </div>

            <div class="device-frame">
              <div class="device-bridge" aria-hidden="true"><span></span><span></span></div>
              <div class="device-screen" aria-label="G2 monochrome display preview">
                <div class="screen-topline"><span>EVEN / G2</span><span id="screen-status">MARKET BRIEF</span></div>
                <pre id="screen-content" aria-live="polite">MARKET GLANCE     01/03
COINBASE EXCHANGE
BTC-USD

Loading market data...

SWIPE: CHANGE ASSET</pre>
                <div class="screen-bottomline"><span>576 × 288</span><span class="screen-led"></span></div>
              </div>
            </div>

            <div class="display-controls">
              <button class="control-button" id="previous-button" type="button" aria-label="Previous asset"><span aria-hidden="true">←</span><kbd>SWIPE UP</kbd></button>
              <button class="control-button primary-control" id="toggle-button" type="button"><span id="toggle-label">Show details</span><kbd>TAP</kbd></button>
              <button class="control-button" id="next-button" type="button" aria-label="Next asset"><kbd>SWIPE DOWN</kbd><span aria-hidden="true">→</span></button>
            </div>
          </div>

          <div class="quote-panel panel" aria-live="polite">
            <div class="quote-topline"><div><span class="section-kicker" id="active-asset-name">BITCOIN / USD</span><span class="quote-source">COINBASE EXCHANGE · PUBLIC STATS</span></div><button class="refresh-button" id="refresh-button" type="button"><span class="refresh-icon" aria-hidden="true">↻</span> Refresh</button></div>
            <div class="quote-main"><div><span class="quote-label">LAST TRADE PRICE</span><strong class="quote-price" id="quote-price">—</strong></div><div class="change-block" id="change-block"><span class="quote-label">24H CHANGE</span><strong id="quote-change">—</strong></div></div>
            <div class="range-block">
              <div class="range-labels"><span>24H LOW <strong id="quote-low">—</strong></span><span>24H HIGH <strong id="quote-high">—</strong></span></div>
              <div class="range-track" aria-label="Last price position in 24-hour range"><span class="range-fill" id="range-fill"></span><span class="range-pin" id="range-pin"></span></div>
            </div>
            <div class="quote-footer"><span id="quote-volume">24H VOLUME —</span><span id="quote-time">AS OF —</span></div>
            <section class="watch-box" aria-label="Local price marker">
              <div class="watch-box-copy">
                <div class="watch-box-heading"><span class="section-kicker">LOCAL PRICE MARK</span><span class="watch-device-label">ON THIS DEVICE</span></div>
                <p id="watch-status" aria-live="polite">No local mark. Choose +1% or -1% from a live price.</p>
              </div>
              <div class="watch-actions" role="group" aria-label="Set a local price mark">
                <button class="watch-button" id="watch-above-button" type="button">Mark +1%</button>
                <button class="watch-button" id="watch-below-button" type="button">Mark -1%</button>
                <button class="watch-button watch-clear-button" id="watch-clear-button" type="button" aria-label="Clear local marker">Clear</button>
              </div>
              <p class="watch-note">Checked only on live refresh while this app is open. No notifications or trades.</p>
            </section>
          </div>
        </section>
      </section>

      <section class="how-it-works" aria-label="How the app works">
        <div class="how-title"><span class="section-kicker">BUILT FOR A GLANCE</span><h2>Calm data.<br />Clear boundaries.</h2></div>
        <div class="how-item"><span class="step-number">01</span><div><h3>Read the moment</h3><p>Last price, 24-hour move, range and volume—nothing to scroll through on your phone.</p></div></div>
        <div class="how-item"><span class="step-number">02</span><div><h3>Mark a price</h3><p>Choose +1% or -1% from a fresh quote using the G2 action menu; the marker stays on this device.</p></div></div>
        <div class="how-item"><span class="step-number">03</span><div><h3>Keep it bounded</h3><p>Public market stats and local-only markers. No orders, custody, accounts or financial advice.</p></div></div>
      </section>
    </main>

    <footer class="footer"><span>MARKET GLANCE <span class="footer-separator">/</span> LOCAL BUILD</span><span>DATA FROM COINBASE EXCHANGE · DISPLAYED FOR INFORMATION ONLY</span></footer>
  </div>
`

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

const assetList = $('#asset-list')
const screenContent = $('#screen-content')
const screenStatus = $('#screen-status')
const environmentLabel = $('#environment-label')
const dataState = $('#data-state')
const dataStateText = $('#data-state-text')
const quotePrice = $('#quote-price')
const quoteChange = $('#quote-change')
const changeBlock = $('#change-block')
const quoteLow = $('#quote-low')
const quoteHigh = $('#quote-high')
const quoteVolume = $('#quote-volume')
const quoteTime = $('#quote-time')
const assetName = $('#active-asset-name')
const rangePin = $('#range-pin')
const rangeFill = $('#range-fill')
const refreshButton = $('#refresh-button') as HTMLButtonElement
const toggleButton = $('#toggle-button') as HTMLButtonElement
const toggleLabel = $('#toggle-label')
const watchStatus = $('#watch-status')
const watchAboveButton = $('#watch-above-button') as HTMLButtonElement
const watchBelowButton = $('#watch-below-button') as HTMLButtonElement
const watchClearButton = $('#watch-clear-button') as HTMLButtonElement

let activeIndex = 0
let detailsVisible = false
let snapshots = new Map<ProductId, MarketSnapshot>()
let failedProducts = new Set<ProductId>()
let bridge: EvenAppBridge | null = null
let bridgeReady = false
let lastCheckedAt: Date | null = null
let refreshInProgress = false
let priceWatches: PriceWatchStore = {}
let watchFeedback = ''
let watchPersistenceFailed = false

const formatPrice = (value: number): string => {
  const digits = value > 0 && value < 1 ? 4 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value)
}

const formatVolume = (value: number, ticker: string): string =>
  `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ${ticker}`

const formatUtcTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(date)} UTC`
}

function formatWatchLine(snapshot: MarketSnapshot): string | undefined {
  const watch = priceWatches[snapshot.productId]
  if (!watch) return undefined
  if (watchPersistenceFailed) return 'WATCH SESSION ONLY'

  const side = watch.direction === 'above' ? 'ABOVE' : 'BELOW'
  const target = formatPrice(watch.targetPrice)
  if (snapshot.stale) return `WATCH ${side} ${target} STALE`
  return isPriceWatchReached(snapshot, watch)
    ? `${side} MARK REACHED ${target}`
    : `WATCH ${side} ${target}`
}

function describeWatch(snapshot: MarketSnapshot | undefined): string {
  if (watchFeedback) return watchFeedback
  if (!snapshot) return 'Wait for a live quote before setting a local marker.'

  const watch = priceWatches[snapshot.productId]
  if (snapshot.stale) {
    return watch
      ? `Cached quote; marker at ${formatPrice(watch.targetPrice)} is not evaluated.`
      : 'Cached quote; refresh before setting a marker.'
  }
  if (!watch) return 'No marker. Choose +1% or -1% from the current live price.'

  const side = watch.direction === 'above' ? 'above' : 'below'
  if (watchPersistenceFailed) return `Session only: watch ${side} ${formatPrice(watch.targetPrice)}.`
  if (isPriceWatchReached(snapshot, watch)) {
    return `Price is ${side} ${formatPrice(watch.targetPrice)} on an open-app live refresh.`
  }
  return `Watch ${side} ${formatPrice(watch.targetPrice)} (1% from ${formatPrice(watch.referencePrice)}).`
}

function currentSnapshot(): MarketSnapshot | undefined {
  return snapshots.get(WATCHLIST[activeIndex].productId)
}

function renderWatchlist(): void {
  assetList.innerHTML = WATCHLIST.map((asset, index) => {
    const snapshot = snapshots.get(asset.productId)
    const selected = index === activeIndex
    const changeClass = snapshot ? (snapshot.changePercent >= 0 ? 'positive' : 'negative') : ''
    return `<button class="asset-row ${selected ? 'selected' : ''}" type="button" data-index="${index}" aria-pressed="${selected}" aria-label="Select ${asset.name}">
      <span class="asset-symbol">${asset.ticker.slice(0, 1)}</span>
      <span class="asset-ident"><strong>${asset.ticker}<span> / USD</span></strong><small>${asset.name}</small></span>
      <span class="asset-values"><strong>${snapshot ? formatPrice(snapshot.last) : '—'}</strong><small class="${changeClass}">${snapshot ? formatPercent(snapshot.changePercent) : 'WAITING'}</small></span>
      <span class="row-chevron" aria-hidden="true">${selected ? '●' : '○'}</span>
    </button>`
  }).join('')

  assetList.querySelectorAll<HTMLButtonElement>('.asset-row').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index)
      if (Number.isInteger(index)) selectAsset(index)
    })
  })
}

function render(): void {
  const asset = WATCHLIST[activeIndex]
  const snapshot = currentSnapshot()
  const staleCount = [...snapshots.values()].filter((item) => item.stale).length
  const failedCount = failedProducts.size

  assetName.textContent = `${asset.name.toUpperCase()} / USD`
  quotePrice.textContent = snapshot ? formatPrice(snapshot.last) : '—'
  quoteChange.textContent = snapshot ? formatPercent(snapshot.changePercent) : '—'
  changeBlock.classList.toggle('negative', !!snapshot && snapshot.changePercent < 0)
  changeBlock.classList.toggle('positive', !!snapshot && snapshot.changePercent >= 0)
  quoteLow.textContent = snapshot ? formatPrice(snapshot.low) : '—'
  quoteHigh.textContent = snapshot ? formatPrice(snapshot.high) : '—'
  quoteVolume.textContent = snapshot ? `24H VOLUME ${formatVolume(snapshot.volume, asset.ticker)}` : '24H VOLUME —'
  quoteTime.textContent = snapshot ? `AS OF ${formatUtcTime(snapshot.fetchedAt)}` : (lastCheckedAt ? `CHECKED ${formatUtcTime(lastCheckedAt.toISOString())}` : 'AS OF —')
  const position = snapshot ? rangePosition(snapshot) : 0
  rangePin.style.left = `${position}%`
  rangeFill.style.width = `${position}%`

  const state = snapshots.size === 0
    ? (refreshInProgress ? 'CONNECTING' : 'OFFLINE')
    : (staleCount > 0 || failedCount > 0 ? 'CACHED / PARTIAL' : 'LIVE DATA')
  dataStateText.textContent = state
  dataState.className = `data-state ${state === 'LIVE DATA' ? 'state-live' : state === 'OFFLINE' ? 'state-offline' : 'state-waiting'}`
  screenStatus.textContent = state === 'LIVE DATA' ? 'LIVE SNAPSHOT' : state
  toggleLabel.textContent = detailsVisible ? 'Show glance' : 'Show details'
  const activeWatch = snapshot ? priceWatches[snapshot.productId] : undefined
  watchStatus.textContent = describeWatch(snapshot)
  watchStatus.classList.toggle('watch-reached', !!snapshot && !!activeWatch && !snapshot.stale && isPriceWatchReached(snapshot, activeWatch))
  const canSetWatch = !!snapshot && !snapshot.stale && !refreshInProgress
  watchAboveButton.disabled = !canSetWatch
  watchBelowButton.disabled = !canSetWatch
  watchClearButton.disabled = !activeWatch
  renderWatchlist()

  const watchLine = !detailsVisible && snapshot ? formatWatchLine(snapshot) : undefined
  const text = formatMarketText(snapshot, activeIndex, detailsVisible ? 'detail' : 'glance', watchLine)
  screenContent.textContent = text
  if (bridgeReady && bridge) {
    void bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 1,
      containerName: 'market-glance',
      content: text,
    })).catch((error: unknown) => console.warn('Even Hub display update failed', error))
  }
}

function selectAsset(index: number): void {
  activeIndex = (index + WATCHLIST.length) % WATCHLIST.length
  detailsVisible = false
  watchFeedback = ''
  render()
}

function moveAsset(direction: -1 | 1): void {
  selectAsset(activeIndex + direction)
}

function toggleDetails(): void {
  detailsVisible = !detailsVisible
  render()
}

async function readWatchStore(): Promise<void> {
  let serialized: string | null = null
  if (bridgeReady && bridge) {
    try {
      serialized = (await bridge.getLocalStorage(WATCH_STORAGE_KEY)) || null
    } catch (error) {
      console.warn('Could not read Even Hub local watch storage', error)
    }
  }
  if (!serialized) {
    try {
      serialized = window.localStorage.getItem(WATCH_STORAGE_KEY)
    } catch (error) {
      console.warn('Could not read browser local watch storage', error)
    }
  }
  priceWatches = parsePriceWatchStore(serialized)
  watchPersistenceFailed = false
}

async function persistWatchStore(next: PriceWatchStore): Promise<boolean> {
  const serialized = JSON.stringify(next)
  let saved = false
  if (bridgeReady && bridge) {
    try {
      saved = await bridge.setLocalStorage(WATCH_STORAGE_KEY, serialized)
    } catch (error) {
      console.warn('Even Hub local watch storage failed', error)
    }
  }
  try {
    window.localStorage.setItem(WATCH_STORAGE_KEY, serialized)
    saved = true
  } catch (error) {
    console.warn('Browser local watch storage failed', error)
  }
  return saved
}

async function setPriceWatch(direction: WatchDirection): Promise<void> {
  const snapshot = currentSnapshot()
  if (!snapshot || snapshot.stale) {
    watchFeedback = 'A live quote is required before setting a marker.'
    render()
    return
  }

  const marker = createPriceWatch(snapshot, direction)
  const next: PriceWatchStore = { ...priceWatches, [snapshot.productId]: marker }
  const saved = await persistWatchStore(next)
  priceWatches = next
  watchPersistenceFailed = !saved
  watchFeedback = saved ? 'Local marker saved on this device.' : 'Storage unavailable; marker is for this session only.'
  render()
}

async function clearPriceWatch(): Promise<void> {
  const productId = WATCHLIST[activeIndex].productId
  if (!priceWatches[productId]) return
  const next: PriceWatchStore = { ...priceWatches }
  delete next[productId]
  const saved = await persistWatchStore(next)
  priceWatches = next
  watchPersistenceFailed = !saved
  watchFeedback = saved ? 'Local marker cleared.' : 'Cleared for this session; storage unavailable.'
  render()
}

async function handleWatchMenuAction(itemID: number): Promise<void> {
  if (itemID === WATCH_MENU_IDS.above) await setPriceWatch('above')
  else if (itemID === WATCH_MENU_IDS.below) await setPriceWatch('below')
  else if (itemID === WATCH_MENU_IDS.clear) await clearPriceWatch()
}

async function refreshMarkets(): Promise<void> {
  if (refreshInProgress) return
  refreshInProgress = true
  refreshButton.disabled = true
  render()

  await Promise.all(WATCHLIST.map(async (asset) => {
    try {
      const response = await fetch(`${MARKET_API_BASE}/api/market/${asset.productId}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(9_000),
      })
      const payload = await response.json() as MarketApiResponse | { error?: string }
      if (!response.ok || !('stats' in payload)) {
        throw new Error('Market data request failed')
      }
      const snapshot = parseMarketSnapshot(
        asset.productId,
        payload.stats,
        payload.fetchedAt,
        payload.stale,
      )
      snapshots.set(asset.productId, snapshot)
      failedProducts.delete(asset.productId)
    } catch (error) {
      failedProducts.add(asset.productId)
      console.warn(`Could not refresh ${asset.productId}`, error)
    }
  }))

  lastCheckedAt = new Date()
  refreshInProgress = false
  watchFeedback = ''
  refreshButton.disabled = false
  render()
}

async function connectEvenHub(): Promise<void> {
  const maybeWindow = window as Window & { EvenAppBridge?: unknown }
  if (!maybeWindow.EvenAppBridge) return

  try {
    bridge = await waitForEvenAppBridge()
    const firstText = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      containerID: 1,
      containerName: 'market-glance',
      content: formatMarketText(undefined, activeIndex, 'glance'),
      isEventCapture: 1,
      textColor: 4,
    })
    const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [firstText],
      menuObject: WATCH_MENU,
    }))
    if (result !== 0) throw new Error(`G2 startup page failed with code ${String(result)}`)

    bridgeReady = true
    await readWatchStore()
    environmentLabel.textContent = 'EVEN HUB LINKED'
    environmentLabel.classList.add('environment-linked')
    bridge.onEvenHubEvent((event) => {
      if (import.meta.env.DEV) console.debug('[Market Glance] G2 event', JSON.stringify(event))
      const menuItemID = event.menuItemClickEvent?.itemID
      if (menuItemID !== undefined) {
        void handleWatchMenuAction(menuItemID)
        return
      }
      const textEvent = event.textEvent
      if (!textEvent) {
        const systemType = event.sysEvent?.eventType
        const normalizedClick = systemType === undefined && event.sysEvent?.eventSource !== undefined
        if (systemType === OsEventTypeList.CLICK_EVENT || normalizedClick) toggleDetails()
        if (systemType === OsEventTypeList.DOUBLE_CLICK_EVENT) void bridge?.shutDownPageContainer(1)
        return
      }
      if (textEvent.containerID !== 1) return

      switch (textEvent.eventType) {
        case OsEventTypeList.CLICK_EVENT:
        case undefined:
          toggleDetails()
          break
        case OsEventTypeList.SCROLL_TOP_EVENT:
          moveAsset(-1)
          break
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
          moveAsset(1)
          break
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
          void bridge?.shutDownPageContainer(1)
          break
      }
    })
    render()
  } catch (error) {
    console.error('Even Hub bridge could not be initialized', error)
    environmentLabel.textContent = 'G2 BRIDGE ISSUE'
    environmentLabel.classList.add('environment-error')
  }
}

$('#previous-button').addEventListener('click', () => moveAsset(-1))
$('#next-button').addEventListener('click', () => moveAsset(1))
toggleButton.addEventListener('click', toggleDetails)
refreshButton.addEventListener('click', () => void refreshMarkets())
watchAboveButton.addEventListener('click', () => void setPriceWatch('above'))
watchBelowButton.addEventListener('click', () => void setPriceWatch('below'))
watchClearButton.addEventListener('click', () => void clearPriceWatch())
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLButtonElement) return
  if (event.key === 'ArrowUp') { event.preventDefault(); moveAsset(-1) }
  if (event.key === 'ArrowDown') { event.preventDefault(); moveAsset(1) }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleDetails() }
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshMarkets()
})

render()
if (!(window as Window & { EvenAppBridge?: unknown }).EvenAppBridge) {
  void readWatchStore().then(render)
}
void connectEvenHub()
void refreshMarkets()
window.setInterval(() => {
  if (!document.hidden) void refreshMarkets()
}, 30_000)
