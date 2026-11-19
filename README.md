# Market Glance — Even Realities G2

Market Glance is a calm, glanceable Coinbase market brief for Even G2. Swipe between BTC-USD, ETH-USD and SOL-USD; tap for compact detail. A G2 contextual-menu action or a browser control can set a local price marker at +1% or -1% from the current live price. The market feed remains read-only: there are no orders, accounts, API keys, custody or trading recommendations.

**Track:** Exchanges & Stocks (Coinbase is listed in this track).

## Simulator proof

The official Even Hub simulator screenshot below shows a live quote and the +1% marker restored after a full process restart, with no simulator warnings or errors. `evidence/g2-final-watch.png` is the raw RGBA framebuffer; its preview composites the lit-pixel alpha against a dark background for readability.

![Market Glance with a restored local price marker on the Even G2 simulator](evidence/g2-final-watch-preview.png)

## Important timing note

This is a **private pre-hackathon prototype** created on 20 November 2026. The official build window begins on 23 November 2026 at 12:00 Dubai time (15:00 WIB). DoraHacks rules say projects must be built during the hackathon. Do not present this pre-event work as a compliant final submission: continue or rebuild during the event and disclose pre-existing code/assets in the final README. Nothing in this folder has been published, deployed or submitted.

## Run the local demo

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The browser preview has asset selection, detail controls, refresh, and local marker buttons. The local Node middleware fetches Coinbase Exchange public statistics through `/api/market/:product`, validates the response, restricts product IDs to the three-item watchlist, caches briefly and serves the last successful response with a visible stale marker during an upstream outage.

### Even Hub simulator

Keep the Vite dev server running, then start the official simulator in a second terminal:

```bash
npx --yes @evenrealities/evenhub-simulator@0.9.5 http://localhost:5173 --automation-port 9898
```

On G2/R1, swipe up/down to move through the watchlist and tap once for details. Open the Even OS contextual menu to choose **Mark +1%**, **Mark -1%** or **Clear mark**. The menu selection is handled by `menuItemClickEvent`; the value is saved via Even Hub local storage. Simulator automation can open that menu with `POST /api/input` and `{"action":"context_menu"}`, then move/select with `up`/`down` and `click`. A double tap invokes the system-confirmed root-page exit. In a regular browser, use the matching buttons; arrow keys and Enter demonstrate navigation without hardware.

Custom contextual menus require Even App 2.2.9 or newer. The project pins Even Hub SDK 0.0.16 and the simulator 0.9.5.

## Local marker behavior and safety

A marker is set at exactly 1% above or below the selected product's current `last` price. On G2, its JSON is written to both Even Hub local storage and WebView `localStorage`; preview mode uses browser `localStorage`. At startup the app prefers the Even Hub copy and falls back to the WebView copy. The simulator was restarted after setting a marker, and the marker returned automatically. The value never leaves the device/browser and is not sent to Coinbase or the backend. A fresh quote is required to set one.

The app checks the marker only after fresh market data arrives while the page is visible (normally every 30 seconds). Stale/cached data is never used to report that the marker was reached. There are no background actions, push notifications or trade execution; the state is shown only on the open app display. Coinbase market-data requests are read-only. No user funds are held and displayed values are not financial advice.

## Data and production boundary

- Source: [Coinbase Exchange Get product stats](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductstats), public `GET /products/{product_id}/stats`. The app computes 24-hour change as `(last - open) / open × 100`; volume is in the base asset.
- Coinbase is the only external data provider, and the app has no Coinbase credentials. The local Node middleware—not the Even Hub web app—calls Coinbase.
- `app.json` is a local development manifest. Its `https://api.example.invalid` whitelist entry is an intentional non-working placeholder. The local Vite middleware is not bundled into an installed app. Before packaging, host the same read-only API behind HTTPS, set `VITE_MARKET_API_BASE`, and replace the placeholder with the exact backend origin in `app.json`'s `network.whitelist`. Do not call Coinbase directly from the packaged app or ship API keys in it. No backend has been deployed and no `.ehpk` has been packaged.
- `.env*` files are ignored except `.env.example`; commit no local secrets or production credentials.

## Test and build

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=moderate
```

Tests cover market parsing/change calculation, display formatting/range behavior, watch creation from live snapshots, corrupted local storage, threshold evaluation and compact G2 rendering, plus endpoint validation, product allow-listing, CORS, cache behavior, stale fallback and malformed upstream data. Tests use deterministic fixtures and do not place orders or call a live market endpoint.

## Before any hackathon submission

After the build window opens, continue/rebuild during the event and accurately disclose pre-existing work; run the simulator journey and validate on G2 if available; host/configure the HTTPS backend and test the package CORS/whitelist; prepare the public GitHub/GitLab repository required by the rules, setup notes, a demo video up to 3 minutes, and the short problem/user/how-it-works/track description; list up to five API feature requests if any are discovered; then submit through DoraHacks before the deadline. The repository, deployment and submission have deliberately not been created.

## Official references

- [Heads Up: Even Realities Hackathon — rules, tracks, schedule and judging](https://dorahacks.io/hackathon/even-realities)
- [Even Hub — Your First App](https://hub.evenrealities.com/docs/get-started/quickstart/first-app)
- [Even Hub — Device APIs](https://hub.evenrealities.com/docs/build/device-apis)
- [Even Hub — Contextual Menu](https://hub.evenrealities.com/docs/build/contextual-menu)
- [Even Hub — Networking and CORS](https://hub.evenrealities.com/docs/build/networking)
- [Even Hub — simulator workflow](https://hub.evenrealities.com/docs/test/simulator)
