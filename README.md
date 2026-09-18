# Kendall-Jackson × LiquidCommerce Elements

A Kendall-Jackson storefront running the real **LiquidCommerce Elements** SDK
against the Kendall-Jackson partner account. The commerce is live: real catalog
data, real retailers, real prices, real cart and checkout.

Live: https://noshiftsherlock.github.io/kendall-jackson-lc-demo/

| Page | What it is |
| --- | --- |
| `index.html` | Home + collection |
| `product.html` | PDP with the stock Elements product element |
| `product-noprice.html` | Same PDP with **all pricing suppressed** until the cart |
| `checkout.html` | Hosted checkout page |

## How it is wired

Everything lives in **`elements-config.js`**. That file builds the SDK script tag
and holds the `customTheme` that makes the SDK's components match this site.

```js
window.ELEMENTS = {
  enabled: true,
  token: 'pk_…',        // Partner App > Quick Start > Main Script (data-token)
  partnerCode: 'kenda', // first path segment of the script src
  env: 'production',
  defaultUpc: '00081584013105'
}
```

The product container carries its own UPC:

```html
<div id="lce-product" data-upc="00081584013105"></div>
```

`?upc=` on `product.html` swaps which product renders. That override must run
**before** `elements-config.js`, which reads the attribute synchronously.

## Four things that will cost you a day each

These are all verified against the shipped bundle, not guessed from docs.

**1. There are two different keys.** Elements takes the `pk_` **data-token** from
Partner App → Quick Start. The key on Integration Credentials is the REST key and
is rejected by Elements. The failure is a `403 apiKey.error.invalid` that is
byte-identical to the error for a key that does not exist, so it reads like an
unprovisioned account rather than the wrong credential.

**2. The product container is `data-lce-product`.** Older docs show
`data-container-N` / `data-product-N` on the script tag. Those do not exist in
this bundle. They are accepted silently and render nothing, which looks exactly
like an auth failure. The full attribute map:

```
data-lce-product              product container, value = UPC
data-lce-checkout             checkout container
data-lce-cart-toggle-button   put on your own cart button; the SDK binds it
data-lce-cart-items-count     the badge count; the SDK sets the number
```

**3. `cart.addProduct` takes `fulfillmentType`, not `fulfillmentId`.** The
accepted fields are `identifier`, `fulfillmentType` (`"shipping"` | `"onDemand"`),
`quantity`, `engravingLines`. There is no retailer selector, and `fulfillmentType`
**defaults to `shipping`** when omitted, so a same-day selection silently adds a
shipping retailer at a different price.

**4. The shadow root is closed.** `attachShadow({mode:"closed"})`, no `::part`,
no `exportparts`, no CSS custom properties. Nothing inside the SDK's components
can be styled from `styles.css`. Your only levers are `customTheme` and the width
you give the host. That width is load-bearing: at the full content width the
SDK's address-entry state collapses its details column to a sliver, which is why
`.lce-host` is capped at 960px.

## The no-pricing variant

`product-noprice.html` shows no price on the product page, the retailer tiles or
the listing. Price appears only in the cart and checkout.

The SDK cannot do this. Its whole `product.layout.*` registry has no price
toggle, and the closed shadow root rules out hiding it with CSS. So that page
renders the product UI itself from the SDK's own data
(`actions.product.getDetails`) and hands the cart back to the SDK
(`actions.cart.addProduct`). See `noprice.js`. The price is present in the
payload as `variant.price`; it is simply never painted.

Two notes on it: `getDetails` only answers for a product the SDK has already
loaded, which is why the page keeps an off-screen product element as the data
source. And because `addProduct` has no retailer selector, the tiles are a real
availability list but the specific tile clicked is not yet honoured by the cart.

## Caching

Local asset URLs carry a `?v=` stamp. GitHub Pages plus Chrome will otherwise
serve a stale `styles.css` or `noprice.js` through a normal reload after a
deploy. Bump the stamp when you change those files.

## Deploying

Pages serves `main` at the repo root, so **a push to `main` is a deploy**. There
is no review step and no staging. `.nojekyll` is required and already present.

## Notes

- Only the Vintner's Reserve Chardonnay (`00081584013105`) has retailers
  attached. The other SKUs are in the catalog but return no variants, so they
  render as unavailable. That is a catalog setting, not a bug in this code.
- Elements provisioning and retailer connection are separate switches.
- The Google Places key lives in the Partner App. Without it address
  autocomplete degrades to accepting free text.
- `app.js` no longer renders commerce. It is kept only for the catalog snapshot
  the collection grid reads.
- The `pk_` token is publishable and ships in page source on every live Elements
  site, which is why it is committed here.

Built by AccelPay / ReserveBar as a working demonstration for Jackson Family Wines.
