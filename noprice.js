/* ============================================================================
 * Price-suppressed product element.
 *
 * WHY THIS FILE EXISTS
 * The Elements SDK cannot hide prices. Its full product.layout.* registry is:
 *   showTitle, showImages, showDescription, descriptionPosition, showOnlyMainImage,
 *   showQuantityCounter, quantityCounterStyle, showOffHours, fulfillmentDisplay,
 *   primaryFulfillmentMethod, enableShippingFulfillment, enableOnDemandFulfillment,
 *   addToCartButtonText, addToCartButtonShowTotalPrice, buyNowButtonText,
 *   preSaleButtonText, prioritizeEngraving, noAvailabilityText
 * There is no price toggle, and the shadow root is attachShadow({mode:"closed"})
 * with no ::part, no exportparts and no CSS custom properties, so it cannot be
 * hidden with CSS either. (showPrice exists but only under productCard, which is
 * the injectProductList config, not the single product element.)
 *
 * So this renders the product UI ourselves from the SDK's own data and hands the
 * cart back to the SDK. Price still lives in the payload (variant.price); we
 * simply never paint it. The SDK's cart drawer and checkout are untouched, which
 * is where price is meant to appear.
 * ========================================================================== */
(function () {
  var UPC = (document.getElementById('np-product') || {}).dataset
    ? document.getElementById('np-product').dataset.upc : null;
  var money = function (c) { return '$' + (c / 100).toFixed(2); };
  var el, product, sizeId, mode = 'onDemand', selectedFulfillmentId = null, qty = 1;

  function host() { return document.getElementById('np-product'); }

  function fulfillments() {
    if (!product) return {};
    var sz = product.sizes[sizeId];
    return (mode === 'onDemand' ? sz.onDemandFulfillments : sz.shippingFulfillments) || {};
  }

  function render() {
    var h = host(); if (!h) return;
    if (!product) { h.innerHTML = '<div class="np-empty">Loading…</div>'; return; }

    var sz = product.sizes[sizeId];
    var od = Object.keys(sz.onDemandFulfillments || {}).length;
    var sh = Object.keys(sz.shippingFulfillments || {}).length;
    var list = fulfillments();
    var ids = Object.keys(list);
    if (ids.length && !list[selectedFulfillmentId]) selectedFulfillmentId = ids[0];

    var img = (product.images || [])[0] || '';
    var addr = el.actions.address.getDetails && el.actions.address.getDetails();

    h.innerHTML =
      '<div class="np-grid">' +
        '<div class="np-gallery"><img src="' + img + '" alt="' + product.name + '"></div>' +
        '<div class="np-detail">' +
          '<h1 class="np-title">' + product.name + '</h1>' +

          '<div class="np-label">Size</div>' +
          '<div class="np-sizes"><button class="np-size on">' + sz.size + '</button></div>' +

          (addr ? '<div class="np-label">Delivers to:</div>' +
                  '<button class="np-addr" id="np-change-addr">' +
                    [addr.one, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') +
                  '</button>' : '') +

          '<div class="np-tabs">' +
            '<button class="np-tab' + (mode === 'onDemand' ? ' on' : '') + '" data-mode="onDemand">Same-Day Delivery (' + od + ')</button>' +
            '<button class="np-tab' + (mode === 'shipping' ? ' on' : '') + '" data-mode="shipping">Shipping (' + sh + ')</button>' +
          '</div>' +

          '<div class="np-tiles">' + (ids.length ? ids.map(function (id) {
            var f = list[id];
            var closed = f.hourStatus && f.hourStatus.isClosed;
            return '<button class="np-tile' + (id === selectedFulfillmentId ? ' on' : '') +
                     (closed ? ' closed' : '') + '" data-fid="' + id + '"' + (closed ? ' disabled' : '') + '>' +
              '<span class="np-rname">' + f.retailerName + '</span>' +
              '<span class="np-raddr">' + (f.retailerAddressFormatted || '') + '</span>' +
              /* Deliberately no bottle price here. Delivery fee and ETA are
                 retailer service terms, not the product price, so they stay. */
              '<span class="np-fee">' + (f.fee ? '+ ' + money(f.fee) + ' delivery' : 'FREE Delivery') + '</span>' +
              '<span class="np-eta">' + (closed
                  ? 'Opens at ' + (f.hourStatus.openTime || '')
                  : (f.expectation || '')) + '</span>' +
            '</button>';
          }).join('') : '<div class="np-empty">No retailers deliver to this address yet.</div>') + '</div>' +

          '<div class="np-buy">' +
            '<div class="np-qty">' +
              '<button id="np-minus" aria-label="Decrease">&minus;</button>' +
              '<span id="np-q">' + qty + '</span>' +
              '<button id="np-plus" aria-label="Increase">+</button>' +
            '</div>' +
            '<button class="np-add" id="np-add"' + (ids.length ? '' : ' disabled') + '>Add to cart</button>' +
          '</div>' +
          '<p class="np-note">Pricing is shown in your cart at checkout.</p>' +

          '<div class="np-about"><strong>About this product:</strong>' +
            '<p>' + (product.description || '') + '</p></div>' +
        '</div>' +
      '</div>';

    wire();
  }

  function wire() {
    var h = host();
    Array.prototype.forEach.call(h.querySelectorAll('.np-tab'), function (b) {
      b.onclick = function () { mode = b.dataset.mode; selectedFulfillmentId = null; render(); };
    });
    Array.prototype.forEach.call(h.querySelectorAll('.np-tile'), function (b) {
      b.onclick = function () { selectedFulfillmentId = b.dataset.fid; render(); };
    });
    var minus = h.querySelector('#np-minus'), plus = h.querySelector('#np-plus');
    if (minus) minus.onclick = function () { if (qty > 1) { qty--; render(); } };
    if (plus) plus.onclick = function () { qty++; render(); };

    var add = h.querySelector('#np-add');
    if (add) add.onclick = async function () {
      add.disabled = true; add.textContent = 'Adding…';
      try {
        await el.actions.cart.addProduct([{
          identifier: UPC, fulfillmentId: selectedFulfillmentId, quantity: qty
        }]);
        add.textContent = 'Added';
        el.actions.cart.openCart();
        setTimeout(function () { add.textContent = 'Add to cart'; add.disabled = false; }, 1200);
      } catch (e) {
        add.textContent = 'Add to cart'; add.disabled = false;
        console.error('[KJ no-price] addProduct failed', e);
      }
    };
  }

  async function load() {
    try {
      product = await el.actions.product.getDetails(UPC);
      sizeId = Object.keys(product.sizes || {})[0];
      render();
    } catch (e) {
      console.error('[KJ no-price] getDetails failed', e);
      host().innerHTML = '<div class="np-empty">Enter a delivery address to see availability.</div>';
    }
  }

  function boot() {
    el = window.LiquidCommerce && window.LiquidCommerce.elements;
    if (!el) { setTimeout(boot, 500); return; }
    load();
    // Re-render whenever the shopper changes address, and keep the tiles honest.
    window.addEventListener('lce:actions.address_updated', load);
    window.addEventListener('lce:actions.cart_reset', function () { qty = 1; });
  }
  window.addEventListener('lce:actions.client_ready', boot, { once: true });
  setTimeout(boot, 4000); // client_ready may already have fired before this file ran
})();
