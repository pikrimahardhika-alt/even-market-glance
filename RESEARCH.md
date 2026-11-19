# Official research notes — Market Glance

These notes preserve the official references used to shape the private prototype. Checked on 20 November 2026.

## Hackathon: Heads Up — Even Realities × TVM Ventures × Daos Hub

Primary source: https://dorahacks.io/hackathon/even-realities

- The event is a seven-day online hackathon; build starts 23 Nov 2026 at 12:00 Dubai time (15:00 WIB), and the overview lists the submission deadline as 29 Nov 2026 at 23:59 Dubai time (30 Nov, 02:59 WIB).
- The overview says projects must be built during the hackathon. Existing open-source libraries/APIs are allowed, but the README should state what existed before 23 Nov. This prototype was created on 20 Nov and therefore is not represented as a compliant final build/submission.
- The Exchanges & Stocks track explicitly lists Coinbase, Binance, OKX, Bybit and Interactive Brokers. The prototype uses only Coinbase public market stats and aligns with this track.
- The G2 app is a web app (HTML/CSS/JavaScript or TypeScript) running in the Even Realities mobile app WebView and communicating with G2 over Bluetooth through Even Hub SDK. The official page says the free simulator is sufficient for development and glasses are not required.
- Device constraints listed by the event: monochrome green 576×288 display per eye; microphone/touch/R1 ring input; no camera or speaker on the glasses. One app is visible at a time; no access to other apps' notifications and no pop-up alerts while another app is active.
- Integrations should talk directly to their service API, use a backend for external calls, whitelist external origins in `app.json`, satisfy CORS and never ship API keys inside the app.
- Finance demos must be read-only, testnet or paper trading; must not hold user funds and must not offer financial advice.
- Required submission materials: a public GitHub/GitLab repository with setup README, demo video up to 3 minutes, and a short description (problem, audience, how it works, track). Up to five API feature requests may be included; `.ehpk` is optional.
- Judging: usefulness on G2 30%; read/write interaction 25%; technical execution 20%; display/voice UX 15%; business potential/safety 10%.

## Even Hub SDK and simulator

Official overview: https://hub.evenrealities.com/docs/get-started/overview
First-app guide: https://hub.evenrealities.com/docs/get-started/quickstart/first-app
Device APIs: https://hub.evenrealities.com/docs/build/device-apis
Simulator and headless automation: https://hub.evenrealities.com/docs/test/simulator
Networking/CORS: https://hub.evenrealities.com/docs/build/networking

- Official first-app flow uses Vite + TypeScript, `@evenrealities/even_hub_sdk`, and `app.json`.
- The app waits for `waitForEvenAppBridge()`, creates one full-canvas 576×288 `TextContainerProperty` inside `CreateStartUpPageContainer`, sets `isEventCapture: 1`, listens through `bridge.onEvenHubEvent`, and updates text with `TextContainerUpgrade` / `textContainerUpgrade()`.
- The device docs identify `CLICK_EVENT` (0), `SCROLL_TOP_EVENT` (1), `SCROLL_BOTTOM_EVENT` (2), and `DOUBLE_CLICK_EVENT` (3). SDK normalization may deliver the click event type as `undefined`; the root page should use `shutDownPageContainer(1)` for system-confirmed exit on double tap.
- Simulator headless automation is documented from v0.7.0+: `GET /api/ping`, `GET /api/screenshot/glasses` (576×288 RGBA), `GET /api/console`, and `POST /api/input` with actions `up`, `down`, `click`, `double_click`, etc. Wait about four seconds after launch/container creation before sending input. For the glasses framebuffer, use alpha > 0 to identify lit pixels; RGB is green for both background and text. Simulator automation does not replace real-device/beta validation.
- Network whitelist entries use exact origins; whitelist is not a CORS bypass. The remote API still needs an appropriate `Access-Control-Allow-Origin` header. HTTP is for local development; use HTTPS in production. If a third-party endpoint's CORS is unsuitable, proxy through a server you control.

## Coinbase public market stats

Official endpoint docs: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductstats

- Endpoint: `GET https://api.exchange.coinbase.com/products/{product_id}/stats`.
- Relevant fields: `open`, `high`, `low`, `last`, `volume`; Coinbase documents that price/range fields are in quote currency and `volume` is in base currency.
- The app computes 24-hour change as `(last - open) / open × 100`; it displays data with a UTC timestamp and labels staleness. The project middleware calls Coinbase server-side, validates numeric fields and restricts IDs to BTC-USD, ETH-USD and SOL-USD.
- The public endpoint responded successfully in this sandbox on 20 Nov 2026 and returned `Access-Control-Allow-Origin: *`; server-side proxying is still used to follow the event's backend architecture requirement and to keep the app's network boundary simple.

## Read/write interaction reference

Official contextual-menu guide: https://hub.evenrealities.com/docs/build/contextual-menu

- A custom menu is declared with `menuObject` on `createStartUpPageContainer` or `rebuildPageContainer`; it is held by the OS and can be chosen without waking the WebView. Each `MenuItemProperty` contains a verb-like `itemName` and a non-zero unique `itemID`; the label limit is 32 UTF-8 bytes and the menu supports at most 10 app actions.
- Selection arrives as the top-level `menuItemClickEvent` with the declared `itemID`, independent of the text container's event capture. The OS closes the menu after the action. Simulator 0.9.0+ can open it through `POST /api/input` with `{"action":"context_menu"}` and select items with `click`; its menu navigation can be tested with `up`/`down`.
- Custom menus require Even App 2.2.9+ (SDK 0.0.14+); the installed project SDK is 0.0.16 and the simulator used in this project is 0.9.5.
- The official Device APIs page (https://hub.evenrealities.com/docs/build/device-apis) documents `bridge.setLocalStorage(key, value)` and `bridge.getLocalStorage(key)`. This makes a per-device watch marker possible without any external write. Price state is only evaluated from fresh responses while the app is open; it does not produce background alerts or transactions.

The official hackathon rules (https://dorahacks.io/hackathon/even-realities) give 25% to read/write interaction and mention price alerts/quick actions in the Exchanges & Stocks track. They separately require finance demos to stay read-only, paper trading, or testnet; no user funds and no financial advice. The local price marker is designed as an on-device read/write setting while keeping the market API itself read-only.
