# Kendall-Jackson x LiquidCommerce Elements — sales demo

A Kendall-Jackson storefront wired for **LiquidCommerce Elements** (the real
AccelPay / ReserveBar embedded commerce SDK), currently running a static
stand-in for the commerce layer.

Live: https://noshiftsherlock.github.io/kendall-jackson-lc-demo/

## Why the commerce is static right now

KJ's partner API key authenticates against the LiquidCommerce **REST API** but is
rejected by the **Elements service**:

| Service | Result |
| --- | --- |
| `api.liquidcommerce.cloud/authentication` | `200` — token issued, catalog readable |
| Elements production `/api/auth/authenticate` | `403 apiKey.error.invalid` |
| Elements staging `/api/auth/authenticate` | `403 apiKey.error.invalid` |

Two separately provisioned backends behind one key: Elements has not been enabled
for this partner account. Not a domain allowlist — localhost, the GitHub Pages
origin and kj.com all return the same 403.

Verified 2026-09-05 with
`~/.claude/skills/liquidcommerce-elements-demo/scripts/lc-preflight.sh`.

## Turning on the real SDK

Everything is pre-wired. Edit **`elements-config.js`** only:

```js
window.ELEMENTS = {
  enabled: true,                 // was false
  token: '<elements api key>',
  partnerCode: '<from the Partner App script tag>',
  ...
}
```

Reload. The loader injects the SDK with the theme already matched to this site,
and the SDK renders its own product element and cart drawer in place of the
static ones. Then delete `app.js` and its two `<script src="app.js">` tags.

Ask solutions@liquidapp.co to enable Elements for the account, confirm whether
the Elements key differs from the REST key, and allowlist
`https://noshiftsherlock.github.io` if a domain allowlist applies.

## The retailers and prices are real

Updated 2026-09-11. Retailers, prices, stock, fees, minimums and opening hours
come from `GET /catalog/availability` against a Hollywood address, not from
invention. Re-pull them any time:

```bash
./scripts/refresh-availability.sh          # paste the output over RETAILERS / VARIANTS in app.js
```

**Vintner's Reserve Chardonnay 750ml** is the only SKU with retailers attached:

| Retailer | Mode | Price | Stock | Delivery |
| --- | --- | --- | --- | --- |
| Cork Runner Wine and Spirits, LA | same-day, 60 min | $16.99 | 9 | $2.99 |
| Robert Burns Wines, Beverly Hills | same-day, 60 min | $17.99 | 2 | $4.99, free over $25 |
| Liquor Barn, Wheeling IL | ship 2–3 days | $13.99 | 159 | free |
| Mission Wine & Spirits, Pasadena | ship 2–3 days | $14.99 | 250 | free |
| Bottles & Cases, Huntington NY | ship 2–3 days | $15.99 | 350 | free |
| W & J Liquor, Brooklyn | ship 2–3 days | $17.95 | 198 | free |
| Prime Wine & Liquor, Kings Park NY | ship 2–3 days | $27.59 | 135 | free |

Both same-day retailers carry a $25 order minimum and a $5.99 platform fee, and
open 10:30 to 21:45 local. The demo derives open / closing-soon / closed from
those hours at page load, so the status badges are live.

Sauvignon Blanc, Pinot Noir, Cabernet and Merlot are in the Kendall-Jackson
catalog but have **no retailer variants attached**, so they render the real
"not available at this address" state. That is a genuine platform state, not a
placeholder. Engraving is off because the size returned `engraving.status: false`.

## What works in the demo today

Address gate, same-day vs shipping toggle, retailer selection with live open /
closing-soon / closed status, per-retailer pricing, stock caps (try adding more
than 2 from Robert Burns), delivery fees, free-delivery thresholds, order
minimums, platform fee, cart drawer grouped by retailer, promo codes
(`HARVEST20`, `KJFRIEND`), a full checkout with gift and billing branches, and an
order confirmation. Cart state persists in localStorage.

The spread is the point on a call: the same bottle is $13.99 shipped from
Illinois or $17.99 in an hour from Beverly Hills, and the shopper chooses.

**Every state change publishes the same `lce:actions.*` CustomEvent the real SDK
publishes**, with the same `{ data, metadata }` shape. Anything wired to those
events keeps working after the switchover. Open the console and run:

```js
window.addEventListener('lce:actions', e => console.log(e.detail.metadata.event, e.detail.data));
```

## Files

| File | Role |
| --- | --- |
| `elements-config.js` | The switch. SDK config + customTheme. Edit this one. |
| `app.js` | Static commerce stand-in. Delete when the SDK is live. |
| `styles.css` | KJ palette and type; `.lce-*` classes mimic the SDK's components |
| `scripts/refresh-availability.sh` | re-pulls live retailer data, emits a paste-ready JS block |
| `index.html` | Homepage, collection grid, featured product element |
| `product.html` | PDP. `?upc=` selects the product |
| `checkout.html` | Checkout + confirmation (`?confirmed=1`) |

Product UPCs, retailers, prices and stock are all live values from the
LiquidCommerce catalog API. Tax is estimated at 9.75%.

## Disclaimer

Private sales demo. Not affiliated with Kendall-Jackson or Jackson Family Wines;
their trademarks and imagery belong to them. Not for public distribution.
