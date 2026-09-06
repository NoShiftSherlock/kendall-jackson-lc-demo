/* ============================================================================
 * THE SWITCH
 *
 * This is the only file you edit to turn on real LiquidCommerce Elements.
 * Everything else in this demo already speaks the SDK's event vocabulary.
 *
 * WHY IT IS OFF
 * Kendall-Jackson's partner API key (Partner App > Integration Credentials >
 * Production) authenticates fine against the LiquidCommerce REST API but is
 * rejected by the Elements service:
 *
 *     REST      api.liquidcommerce.cloud/authentication        -> 200
 *     Elements  .../api/auth/authenticate  production          -> 403 apiKey.error.invalid
 *     Elements  .../api/auth/authenticate  staging             -> 403 apiKey.error.invalid
 *
 * Two separately provisioned backends behind one key. Elements has not been
 * enabled for this partner account. Verified 2026-09-05, and not a domain
 * allowlist issue (localhost, the Pages origin and kj.com all 403 identically).
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
  enabled: false,                 // <- flip to true once preflight passes
  token: 'PASTE_ELEMENTS_API_KEY',
  partnerCode: '',                // e.g. 'kj' — first path segment from the Partner App script tag
  env: 'production',              // 'production' | 'staging'
  mockMode: false,                // true renders the Builder mock UPCs 99000000000001/2/3
  defaultUpc: '00081584013105',   // Vintner's Reserve Chardonnay 750ml

  // Real Kendall-Jackson identifiers, pulled from the LiquidCommerce catalog API.
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
  jsonTag('data-liquid-commerce-elements-development', { mockMode: !!E.mockMode });
  jsonTag('data-liquid-commerce-elements-custom-theme', E.customTheme);

  var repoBase = location.origin + location.pathname.replace(/[^/]*$/, '');
  var s = document.createElement('script');
  s.defer = true;
  s.type = 'text/javascript';
  s.setAttribute('data-liquid-commerce-elements', '');
  s.setAttribute('data-token', E.token);
  s.setAttribute('data-env', E.env);
  s.setAttribute('data-cart-badge-button', 'header-cart');
  s.setAttribute('data-checkout-url', repoBase + 'checkout.html?lce_checkout={token}');
  s.setAttribute('data-checkout-param', 'lce_checkout');

  var host = document.getElementById('lce-product');
  if (host) {
    s.setAttribute('data-container-1', 'lce-product');
    s.setAttribute('data-product-1', host.getAttribute('data-upc') || E.defaultUpc);
  }
  s.src = base + path;
  document.head.appendChild(s);

  // client_ready is dispatched twice by the SDK; {once:true} is not optional.
  window.addEventListener('lce:actions.client_ready', function () {
    console.info('[KJ demo] Elements SDK ready — static stand-in should be removed.');
  }, { once: true });

  setTimeout(function () {
    if (!(window.LiquidCommerce && (window.LiquidCommerce.elements || window.LiquidCommerce.elementsCheckout))) {
      console.error('[KJ demo] Elements client is null. Auth almost certainly failed — run lc-preflight.sh.');
    }
  }, 8000);
})();
