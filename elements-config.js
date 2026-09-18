/* ============================================================================
 * THE SWITCH
 *
 * This is the only file you edit to turn on real LiquidCommerce Elements.
 * Everything else in this demo already speaks the SDK's event vocabulary.
 *
 * STATUS: LIVE as of 2026-09-18.
 *
 * The 403 that blocked this for two weeks was a wrong-key problem, not an
 * outage. The Elements service takes a DIFFERENT credential from the REST API:
 *
 *     REST      Partner App > Integration Credentials   secret key
 *     Elements  Partner App > Quick Start > Main Script  data-token, starts pk_
 *
 * The pk_ token is publishable by design and ships in the page source of every
 * live Elements site, so it lives in this file. The REST key never should.
 *
 *     Elements  .../api/auth/authenticate  production   -> 200  (verified 2026-09-18)
 *     Elements  .../api/auth/authenticate  staging      -> 403  (production-only token)
 *
 * Retailers are connected on the Chardonnay: 7 retailers, 2 same-day in LA.
 * Google Places key was added to the Partner App 2026-09-14, so address
 * autocomplete works; KJ must procure their own key before going live.
 *
 * TO TURN IT ON
 *   1. Re-run the preflight:
 *        ~/.claude/skills/liquidcommerce-elements-demo/scripts/lc-preflight.sh
 *      Only proceed when Elements returns 200.
 *   2. Set ELEMENTS.enabled = true and paste the key into ELEMENTS.token.
 *      Get PARTNER_CODE by copying the script tag from the Partner App; it is
 *      the first path segment of the src URL.
 *   3. Reload. The loader below injects the real SDK, which then renders its own
 *      product element into #lce-product and its own cart drawer, replacing the
 *      static ones. Delete app.js once you are happy.
 *
 * The customTheme below is already tuned to this site's CSS variables, so the
 * SDK's components will match the surrounding page on the first load.
 * ========================================================================== */

window.ELEMENTS = {
  enabled: true,
  token: 'pk_i7U6HzS1O4SZQxriKO4zo0Oh8QV78jES8cO4oRmM7VdX60H4EOr1uh6wMQeM1mKluhOGJnmCVcWPO01Snd8JwgfY',
  partnerCode: 'kenda',           // first path segment of the Partner App script src
  env: 'production',              // 'production' | 'staging'
  mockMode: false,                // true renders the Builder mock UPCs 99000000000001/2/3
  defaultUpc: '00081584013105',   // Vintner's Reserve Chardonnay 750ml

  // Real Kendall-Jackson identifiers, pulled from the LiquidCommerce catalog API.
  // Only the Chardonnay has variants/retailers attached today. The other three
  // are in the catalog but return no variants, so Elements renders them as
  // unavailable. Requested from onboarding 2026-09-07, still open.
  upcs: {
    chardonnay:        '00081584013105',
    sauvignonBlanc:    '00081584130406',
    pinotNoir:         '00081584131519',
    cabernetSauvignon: '00081584013174'
  },

  // Deep-merges over the account's server-side theme (currently the stock
  // LiquidCommerce blue #1D4ED8). Keep in sync with styles.css :root.
  customTheme: {
    global: {
      theme: {
        primaryColor:          '#1a1512',
        accentColor:           '#a9702e',
        defaultTextColor:      '#2b2624',
        selectedTextColor:     '#ffffff',
        linkTextColor:         '#a9702e',
        errorColor:            '#9b2c2c',
        successColor:          '#2f6b4f',
        drawerBackgroundColor: '#ffffff',
        // Set these explicitly. The SDK measures contrast at runtime and will
        // silently shift your palette toward WCAG AA if a token fails.
        inputBorderColor:      '#767c85',
        focusRingColor:        '#a9702e',
        buttonCornerRadius:    '999px',
        cardCornerRadius:      '14px',
        headingFont:   { name: 'Cormorant Garamond', weights: [300, 400, 500, 600] },
        paragraphFont: { name: 'Roboto Condensed',   weights: [400, 500, 700] }
      },
      layout: {
        enablePersonalization: true,
        personalizationText: 'Add engraving',
        personalizationCardStyle: 'outlined',
        allowPromoCodes: true,
        inputFieldStyle: 'outlined',
        enableOrderedProductSizes: true,
        orderedProductSizes: ['750ml', '1.5L', '3L']
      }
    },
    product: {
      theme: { backgroundColor: '#ffffff' },
      layout: {
        showImages: true, showTitle: true, showDescription: true,
        descriptionPosition: 'below', showQuantityCounter: true, showOffHours: true,
        quantityCounterStyle: 'outlined', fulfillmentDisplay: 'carousel',
        enableShippingFulfillment: true, enableOnDemandFulfillment: true,
        primaryFulfillmentMethod: 'onDemand',
        addToCartButtonText: 'Add to cart',
        addToCartButtonShowTotalPrice: true,
        noAvailabilityText: 'Not available at this address yet'
      }
    },
    cart: {
      theme: { backgroundColor: '#ffffff' },
      layout: {
        showQuantityCounter: true, quantityCounterStyle: 'outlined',
        drawerHeaderText: 'Your Cart', goToCheckoutButtonText: 'Checkout'
      }
    },
    checkout: {
      theme: { backgroundColor: '#ffffff' },
      layout: {
        emailOptIn: { show: true, checked: true,
          text: 'Email me about new releases and offers from Kendall-Jackson.' },
        smsOptIn:   { show: true, checked: false,
          text: 'Text me order updates and exclusive offers.' },
        allowGiftCards: true,
        legalMessage: { show: true,
          text: 'By placing your order you confirm you are 21 or older. An adult signature is required on delivery.' },
        drawerHeaderText: 'Checkout',
        placeOrderButtonText: 'Place order',
        thankYouButtonText: 'Continue shopping'
      }
    },
    address: { theme: { backgroundColor: '#ffffff' } }
  }
};

/* -------------------------------------------------------------------------
 * Loader. Inert while enabled === false.
 * ---------------------------------------------------------------------- */
(function () {
  var E = window.ELEMENTS;
  if (!E.enabled) {
    console.info('[KJ demo] Elements SDK OFF — static stand-in active. ' +
                 'See elements-config.js to switch it on.');
    return;
  }

  var base = 'https://elements.reservebar-worker.workers.dev';
  var path = (E.partnerCode ? '/' + E.partnerCode : '') +
             (/checkout\.html$/.test(location.pathname) ? '/checkout/checkout.js' : '/all/elements.js');

  function jsonTag(attr, obj) {
    var s = document.createElement('script');
    s.setAttribute(attr, '');
    s.type = 'application/json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }
  // Retire the stand-in DOM. app.js's boot() already returns early when enabled,
  // so these nodes would otherwise sit on the page empty and unwired.
  document.addEventListener('DOMContentLoaded', function () {
    ['#drawer', '#scrim', '#checkout-view'].forEach(function (sel) {
      var n = document.querySelector(sel);
      if (n) n.style.display = 'none';
    });
    var note = document.querySelector('.lce-note');
    if (note) note.remove();
  });

  jsonTag('data-liquid-commerce-elements-development', { mockMode: !!E.mockMode });
  jsonTag('data-liquid-commerce-elements-custom-theme', E.customTheme);

  var repoBase = location.origin + location.pathname.replace(/[^/]*$/, '');
  var s = document.createElement('script');
  s.defer = true;
  s.type = 'text/javascript';
  s.setAttribute('data-liquid-commerce-elements', '');
  s.setAttribute('data-token', E.token);
  s.setAttribute('data-env', E.env);
  s.setAttribute('data-checkout-url', repoBase + 'checkout.html?lce_checkout={token}');
  s.setAttribute('data-checkout-param', 'lce_checkout');

  // Verified against the shipped bundle 2026-09-18. The SDK's attribute map is:
  //   ELEMENT.PRODUCT       data-lce-product   (on the container div, value = UPC)
  //   CART_TOGGLE_BUTTON    data-lce-cart-toggle-button
  //   CART_ITEMS_COUNT      data-lce-cart-items-count
  //   CHECKOUT              data-lce-checkout
  // There is NO data-container-N / data-product-N in this bundle; those are from
  // older docs and are silently ignored, which renders no product at all.
  // We do not set data-cart-badge-button: this site has its own branded cart
  // pill carrying data-lce-cart-toggle-button, which the SDK binds natively.
  var host = document.getElementById('lce-product');
  if (host) host.setAttribute('data-lce-product', host.getAttribute('data-upc') || E.defaultUpc);
  s.src = base + path;
  document.head.appendChild(s);

  // client_ready is dispatched twice by the SDK; {once:true} is not optional.
  window.addEventListener('lce:actions.client_ready', function () {
    console.info('[KJ demo] Elements SDK ready.');
  }, { once: true });

  setTimeout(function () {
    if (!(window.LiquidCommerce && (window.LiquidCommerce.elements || window.LiquidCommerce.elementsCheckout))) {
      console.error('[KJ demo] Elements client is null. Auth almost certainly failed — run lc-preflight.sh.');
    }
  }, 8000);
})();
