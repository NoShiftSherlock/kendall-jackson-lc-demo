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

## What works in the demo today

Address gate, same-day vs shipping toggle, retailer selection with open /
closing-soon / closed states, per-retailer delivery fees and order minimums,
bottle engraving with the SDK's clamping rules, cart drawer grouped by retailer,
promo codes (`HARVEST20`, `KJFRIEND`), a full checkout with gift and billing
branches, and an order confirmation. Cart state persists in localStorage.

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
| `index.html` | Homepage, collection grid, featured product element |
| `product.html` | PDP. `?upc=` selects the product |
| `checkout.html` | Checkout + confirmation (`?confirmed=1`) |

Product UPCs are real, pulled from the LiquidCommerce catalog API for brand
"Kendall Jackson". Prices are representative shelf prices, not live pricing.

## Disclaimer

Private sales demo. Not affiliated with Kendall-Jackson or Jackson Family Wines;
their trademarks and imagery belong to them. Not for public distribution.
