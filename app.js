/* Kendall-Jackson x LiquidCommerce Elements demo — static commerce stand-in.
 *
 * WHY THIS EXISTS
 * The Kendall-Jackson partner API key authenticates against the LiquidCommerce
 * REST API but is rejected by the Elements service (403 apiKey.error.invalid on
 * both production and staging), so the real SDK cannot initialize yet. This file
 * reproduces the Elements behaviour closely enough to demo, and is designed to be
 * deleted rather than migrated once the key is provisioned.
 *
 * DESIGN RULE
 * Every state change publishes the SAME `lce:actions.*` CustomEvent the real SDK
 * publishes, with the same detail shape ({ data, metadata }). Anything you wire to
 * these events now — analytics, pixels, UI — keeps working unchanged after the
 * switchover. See elements-config.js for the switch.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- catalog
  // UPCs are real, pulled from the LiquidCommerce catalog API for brand
  // "Kendall Jackson" / "Kendall-jackson". Prices are representative shelf prices.
  const CATALOG = {
    '00081584013105': {
      upc: '00081584013105', name: "Vintner's Reserve Chardonnay",
      varietal: 'Chardonnay', appellation: 'California', vintage: '2023',
      price: 1699, image: 'assets/bottle-chardonnay.png', engravable: true,
      desc: 'The most popular Chardonnay in America. Tropical fruit, citrus and a touch of vanilla from barrel ageing, with a long, bright finish.',
      notes: ['Pineapple', 'Mango', 'Vanilla', 'Toasted oak']
    },
    '00081584130406': {
      upc: '00081584130406', name: "Vintner's Reserve Sauvignon Blanc",
      varietal: 'Sauvignon Blanc', appellation: 'California', vintage: '2024',
      price: 1499, image: 'assets/bottle-sauvblanc.png', engravable: true,
      desc: 'Crisp and aromatic, with grapefruit, lemongrass and a clean mineral finish. Cool-fermented in stainless steel to keep the fruit bright.',
      notes: ['Grapefruit', 'Lemongrass', 'Green apple']
    },
    '00081584131519': {
      upc: '00081584131519', name: "Vintner's Reserve Pinot Noir",
      varietal: 'Pinot Noir', appellation: 'California', vintage: '2022',
      price: 1999, image: 'assets/bottle-pinotnoir.png', engravable: true,
      desc: 'Silky and layered. Black cherry and raspberry over soft tannins, with a hint of cola and baking spice from French oak.',
      notes: ['Black cherry', 'Raspberry', 'Cola', 'Clove']
    },
    '00081584013174': {
      upc: '00081584013174', name: "Vintner's Reserve Cabernet Sauvignon",
      varietal: 'Cabernet Sauvignon', appellation: 'Sonoma County', vintage: '2021',
      price: 2499, image: 'assets/bottle-cabernet.png', engravable: true,
      desc: 'Structured Sonoma Cabernet. Blackcurrant and cedar, firm but rounded tannins, and a finish that holds.',
      notes: ['Blackcurrant', 'Cedar', 'Dark chocolate']
    },
    '00081584013204': {
      upc: '00081584013204', name: "Vintner's Reserve Merlot",
      varietal: 'Merlot', appellation: 'California', vintage: '2022',
      price: 1799, image: 'assets/bottle-merlot.png', engravable: false,
      desc: 'Plush and approachable, with plum, blackberry and a soft mocha finish.',
      notes: ['Plum', 'Blackberry', 'Mocha']
    },
    '00081584013303': {
      upc: '00081584013303', name: "Vintner's Reserve Rosé",
      varietal: 'Rosé', appellation: 'California', vintage: '2024',
      price: 1599, image: 'assets/bottle-rose.png', engravable: false,
      desc: 'Pale, dry and refreshing. Strawberry and white peach with a crisp, clean finish.',
      notes: ['Strawberry', 'White peach', 'Citrus zest']
    }
  };

  // Retailers mirror the shapes the Elements mock UPCs exercise: open with a free
  // delivery fee, open with a paid fee, closing soon, and closed.
  const RETAILERS = {
    shipping: [
      { id: 'r-kj-dtc',  name: 'Kendall-Jackson Winery',  meta: 'Ships from Santa Rosa, CA', expectation: 'Arrives in 3–5 business days', fee: 0,    status: 'open', min: 0 },
      { id: 'r-vinoshp', name: 'Vino Shipping Partner',   meta: 'Ships from Napa, CA',       expectation: 'Arrives in 2–4 business days', fee: 995,  status: 'open', min: 3000 }
    ],
    onDemand: [
      { id: 'r-totalw',  name: 'Total Wine & More',       meta: 'Culver City · 2.1 mi',   expectation: 'Delivered in about 1 hour', fee: 0,    status: 'open',   min: 2500 },
      { id: 'r-bevmo',   name: 'BevMo!',                  meta: 'West Hollywood · 3.4 mi', expectation: 'Delivered in about 1 hour', fee: 599,  status: 'open',   min: 2000 },
      { id: 'r-vendome', name: 'Vendome Wine & Spirits',  meta: 'Los Feliz · 5.0 mi',      expectation: 'Closes at 9:00 PM',         fee: 499,  status: 'soon',   min: 0 },
      { id: 'r-gelsons', name: "Gelson's Market",         meta: 'Silver Lake · 4.2 mi',    expectation: 'Opens at 8:00 AM',          fee: 499,  status: 'closed', min: 0 }
    ]
  };

  const ENGRAVING = { maxLines: 2, maxCharsPerLine: 20, fee: 1500 };
  const PROMOS = { HARVEST20: { pct: 20, label: '20% off' }, KJFRIEND: { pct: 10, label: '10% off' } };

  // ---------------------------------------------------------------- state
  const LS = 'kj-lc-demo-v1';
  const state = load() || {
    address: null,            // { formattedAddress, address:{...}, coordinates:{...} }
    items: [],                // { key, upc, qty, fulfillmentType, retailerId, engravingLines }
    promo: null,
    cartId: 'cart_' + Math.random().toString(36).slice(2, 10)
  };
  function load() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  // ---------------------------------------------------------------- events
  // Same envelope the real SDK uses: CustomEvent('lce:actions.<name>', {detail:{data,metadata}}).
  let evtSeq = 0;
  function publish(name, data, ns) {
    const detail = {
      data: data,
      metadata: {
        eventId: 'evt_' + (++evtSeq), namespace: 'actions', event: name,
        originalEvent: name, actionNamespace: ns || 'other',
        timestamp: Date.now(), sdkVersion: 'static-standin',
        env: 'demo', tenantName: 'Kendall Jackson', tenantCode: 'kj'
      }
    };
    window.dispatchEvent(new CustomEvent('lce:actions.' + name, { detail: detail }));
    window.dispatchEvent(new CustomEvent('lce:actions', { detail: detail }));
  }

  // ---------------------------------------------------------------- helpers
  const money = c => '$' + (c / 100).toFixed(2);
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const retailerById = id =>
    RETAILERS.shipping.concat(RETAILERS.onDemand).filter(r => r.id === id)[0];

  function cartTotals() {
    let subtotal = 0, itemCount = 0;
    state.items.forEach(function (i) {
      const p = CATALOG[i.upc]; if (!p) return;
      subtotal += p.price * i.qty;
      if (i.engravingLines && i.engravingLines.length) subtotal += ENGRAVING.fee * i.qty;
      itemCount += i.qty;
    });
    const promo = state.promo && PROMOS[state.promo] ? PROMOS[state.promo] : null;
    const discount = promo ? Math.round(subtotal * promo.pct / 100) : 0;
    // delivery fee once per distinct retailer in the cart
    let delivery = 0;
    groupByRetailer().forEach(function (g) { delivery += g.retailer.fee; });
    const tax = Math.round((subtotal - discount) * 0.0975);
    return { subtotal, discount, delivery, tax, total: subtotal - discount + delivery + tax, itemCount };
  }

  function groupByRetailer() {
    const map = {};
    state.items.forEach(function (i) {
      if (!map[i.retailerId]) map[i.retailerId] = { retailer: retailerById(i.retailerId), items: [], subtotal: 0 };
      const p = CATALOG[i.upc]; if (!p) return;
      map[i.retailerId].items.push(i);
      map[i.retailerId].subtotal += p.price * i.qty +
        ((i.engravingLines && i.engravingLines.length) ? ENGRAVING.fee * i.qty : 0);
    });
    return Object.keys(map).map(k => map[k]).filter(g => g.retailer);
  }

  function unmetMinimums() {
    return groupByRetailer()
      .filter(g => g.retailer.min > 0 && g.subtotal < g.retailer.min)
      .map(g => ({ name: g.retailer.name, needed: g.retailer.min - g.subtotal }));
  }

  // ---------------------------------------------------------------- address
  function setAddress(raw) {
    const text = (raw || '').trim();
    if (!text) return false;
    state.address = {
      formattedAddress: text,
      address: { one: text, two: '', city: 'Los Angeles', state: 'CA', zip: '90028', country: 'US' },
      coordinates: { latitude: 34.0928, longitude: -118.3287 }
    };
    save();
    publish('address_updated', {
      googlePlacesId: 'demo_places_id',
      formattedAddress: state.address.formattedAddress,
      address: state.address.address,
      coordinates: state.address.coordinates
    }, 'address');
    renderAll();
    return true;
  }
  function clearAddress() {
    state.address = null; state.items = []; state.promo = null; save();
    publish('address_cleared', true, 'address');
    publish('cart_reset', true, 'cart');
    renderAll();
  }

  // ---------------------------------------------------------------- cart ops
  function addProduct(params, openCart) {
    if (!state.address) {
      pendingAdd = { params: params, openCart: openCart };
      const a = $('#lce-address-input');
      if (a) { a.focus(); a.closest('.lce-address').classList.add('needs'); }
      announce('Enter a delivery address to continue');
      return false;
    }
    const p = CATALOG[params.upc]; if (!p) return false;
    let lines = params.engravingLines || [];
    // Same degradation rules the SDK documents: strip blanks, clamp, drop if unsupported.
    lines = lines.filter(l => l && l.trim()).slice(0, ENGRAVING.maxLines)
                 .map(l => l.trim().slice(0, ENGRAVING.maxCharsPerLine));
    if (!p.engravable) lines = [];

    const key = [params.upc, params.fulfillmentType, params.retailerId, lines.join('|')].join('::');
    const existing = state.items.filter(i => i.key === key)[0];
    if (existing) existing.qty += (params.quantity || 1);
    else state.items.push({
      key: key, upc: params.upc, qty: params.quantity || 1,
      fulfillmentType: params.fulfillmentType, retailerId: params.retailerId,
      engravingLines: lines
    });
    save();

    publish('product_add_to_cart', {
      identifier: params.upc, fulfillmentId: params.retailerId,
      partNumber: params.upc, quantity: params.quantity || 1, engravingLines: lines
    }, 'product');
    publish('cart_item_added', {
      cartId: state.cartId, itemId: key, fulfillmentId: params.retailerId,
      partNumber: params.upc, quantity: params.quantity || 1, engravingLines: lines
    }, 'cart');
    publish('cart_updated', { current: cartSnapshot() }, 'cart');

    renderAll();
    if (openCart !== false) openDrawer();
    return true;
  }

  function cartSnapshot() {
    const t = cartTotals();
    return { cartId: state.cartId, subtotal: t.subtotal, itemCount: t.itemCount,
             promoCodeDiscount: t.discount || null };
  }

  function setQty(key, delta) {
    const it = state.items.filter(i => i.key === key)[0]; if (!it) return;
    const prev = it.qty;
    it.qty += delta;
    if (it.qty < 1) {
      state.items = state.items.filter(i => i.key !== key);
      publish('cart_item_removed', { cartId: state.cartId, itemId: key }, 'cart');
    } else {
      publish(delta > 0 ? 'cart_item_quantity_increase' : 'cart_item_quantity_decrease',
        { cartId: state.cartId, itemId: key, quantity: it.qty, previousQuantity: prev }, 'cart');
    }
    save(); renderAll();
  }
  function removeItem(key) {
    state.items = state.items.filter(i => i.key !== key);
    save();
    publish('cart_item_removed', { cartId: state.cartId, itemId: key }, 'cart');
    renderAll();
  }
  function applyPromo(code) {
    const c = (code || '').trim().toUpperCase();
    if (!PROMOS[c]) {
      publish('cart_promo_code_failed', { cartId: state.cartId, error: 'Promo code not valid' }, 'cart');
      announce('Promo code not valid');
      return false;
    }
    state.promo = c; save();
    const t = cartTotals();
    publish('cart_promo_code_applied', { cartId: state.cartId, discount: t.discount, newSubtotal: t.subtotal }, 'cart');
    announce('Promo code ' + c + ' applied, ' + money(t.discount) + ' off');
    renderAll(); return true;
  }
  function removePromo() {
    state.promo = null; save();
    publish('cart_promo_code_removed', { cartId: state.cartId }, 'cart');
    renderAll();
  }
  function resetCart() {
    state.items = []; state.promo = null; save();
    publish('cart_reset', true, 'cart'); renderAll();
  }

  // ---------------------------------------------------------------- a11y announcer
  let liveRegion;
  function announce(msg) {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('data-lce-live-region', '');
      liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = msg;
  }

  // ---------------------------------------------------------------- product element
  let pendingAdd = null;
  const pstate = { upc: null, fulfillmentType: 'onDemand', retailerId: null, qty: 1, engraving: [], imgIdx: 0 };

  function renderProduct() {
    const host = $('#lce-product'); if (!host) return;
    const upc = host.getAttribute('data-upc');
    if (pstate.upc !== upc) {
      pstate.upc = upc; pstate.qty = 1; pstate.engraving = [];
      pstate.retailerId = RETAILERS[pstate.fulfillmentType].filter(r => r.status !== 'closed')[0].id;
    }
    const p = CATALOG[upc]; if (!p) { host.innerHTML = '<div class="lce-body">Product not found.</div>'; return; }
    const rs = RETAILERS[pstate.fulfillmentType];
    if (!rs.filter(r => r.id === pstate.retailerId)[0]) {
      pstate.retailerId = rs.filter(r => r.status !== 'closed')[0].id;
    }
    const r = retailerById(pstate.retailerId);
    const hasAddr = !!state.address;

    host.innerHTML = [
      '<div class="lce-note">Static stand-in for the LiquidCommerce Elements product element</div>',
      '<div class="lce-product">',
        '<div class="lce-gallery">',
          '<div class="main"><img src="', p.image, '" alt="', p.name, '"></div>',
          '<div class="lce-thumbs">',
            '<button aria-selected="true"><img src="', p.image, '" alt=""></button>',
          '</div>',
        '</div>',
        '<div class="lce-body">',
          '<div class="lce-brandline">Kendall-Jackson · ', p.appellation, ' · ', p.vintage, '</div>',
          '<h1>', p.name, '</h1>',
          '<div class="lce-price">', money(p.price), '<span class="unit">750 ML</span></div>',
          '<p class="lce-desc">', p.desc, '</p>',

          '<div class="lce-field"><span class="lce-label">Size</span>',
            '<div class="lce-chips" role="radiogroup" aria-label="Size">',
              '<button class="lce-chip" role="radio" aria-checked="true">750 ML</button>',
              '<button class="lce-chip" role="radio" aria-checked="false" disabled>1.5 L</button>',
            '</div></div>',

          '<div class="lce-field"><span class="lce-label">How would you like it?</span>',
            '<div class="lce-tabs" role="tablist">',
              '<button role="tab" data-ft="onDemand" aria-selected="', pstate.fulfillmentType === 'onDemand', '">',
                'Same-day<span class="sub">About 1 hour</span></button>',
              '<button role="tab" data-ft="shipping" aria-selected="', pstate.fulfillmentType === 'shipping', '">',
                'Ship it<span class="sub">2–5 business days</span></button>',
            '</div></div>',

          addressBlock(hasAddr),

          '<div class="lce-field"><span class="lce-label">',
            pstate.fulfillmentType === 'onDemand' ? 'Delivering from' : 'Shipping from',
          '</span><div class="lce-retailers" role="radiogroup">',
            rs.map(function (rr) {
              return [
                '<button class="lce-retailer" role="radio" data-rid="', rr.id,
                  '" aria-checked="', rr.id === pstate.retailerId, '"',
                  rr.status === 'closed' ? ' disabled' : '', '>',
                  '<span style="flex:1;min-width:0">',
                    '<span class="nm">', rr.name,
                      '<span class="status ', rr.status, '">',
                        rr.status === 'open' ? 'Open' : rr.status === 'soon' ? 'Closing soon' : 'Closed',
                      '</span>',
                    '</span><br>',
                    '<span class="meta">', rr.meta, ' · ', rr.expectation, '</span>',
                  '</span>',
                  '<span class="fee">', rr.fee === 0 ? 'Free' : money(rr.fee), '</span>',
                '</button>'
              ].join('');
            }).join(''),
          '</div></div>',

          p.engravable ? [
            '<details class="lce-engrave"', pstate.engraving.length ? ' open' : '', '>',
              '<summary>Add engraving · ', money(ENGRAVING.fee), '</summary>',
              '<input id="eng1" maxlength="', ENGRAVING.maxCharsPerLine, '" placeholder="Line 1" value="',
                (pstate.engraving[0] || ''), '">',
              '<input id="eng2" maxlength="', ENGRAVING.maxCharsPerLine, '" placeholder="Line 2" value="',
                (pstate.engraving[1] || ''), '">',
              '<div class="hint">', ENGRAVING.maxLines, ' lines, ', ENGRAVING.maxCharsPerLine,
                ' characters each. Bottle engraving is only available on shipped orders from the winery.</div>',
            '</details>'
          ].join('') : '',

          '<div class="lce-buy">',
            '<div class="qty">',
              '<button id="qminus" aria-label="Decrease quantity">−</button>',
              '<span id="qval">', pstate.qty, '</span>',
              '<button id="qplus" aria-label="Increase quantity">+</button>',
            '</div>',
            '<button class="btn" id="addbtn">',
              hasAddr ? 'Add to cart · ' + money(p.price * pstate.qty) : 'Add to cart',
            '</button>',
          '</div>',
          r && r.min > 0
            ? '<div class="lce-alert" style="color:var(--gray)">' + r.name + ' has a ' + money(r.min) + ' order minimum.</div>'
            : '',
        '</div>',
      '</div>'
    ].join('');

    wireProduct();
  }

  function addressBlock(hasAddr) {
    if (hasAddr) {
      return [
        '<div class="lce-address set"><div class="cur">',
          '<span>Delivering to <strong>', state.address.formattedAddress, '</strong></span>',
          '<button class="chg" id="lce-addr-change">Change</button>',
        '</div></div>'
      ].join('');
    }
    return [
      '<div class="lce-address"><span class="lce-label">Delivery address</span>',
        '<div class="row">',
          '<input id="lce-address-input" placeholder="Street address or ZIP" autocomplete="off">',
          '<button class="btn ghost" id="lce-addr-set" style="padding:.55rem 1.1rem">Check</button>',
        '</div></div>'
    ].join('');
  }

  function wireProduct() {
    const host = $('#lce-product'); if (!host) return;
    const p = CATALOG[pstate.upc];

    $$('.lce-tabs button', host).forEach(b => b.addEventListener('click', function () {
      const prev = pstate.fulfillmentType;
      pstate.fulfillmentType = b.getAttribute('data-ft');
      pstate.retailerId = RETAILERS[pstate.fulfillmentType].filter(r => r.status !== 'closed')[0].id;
      publish('product_fulfillment_type_changed', {
        identifier: pstate.upc, selectedFulfillmentType: pstate.fulfillmentType,
        selectedFulfillmentId: pstate.retailerId, previousFulfillmentType: prev,
        previousFulfillmentId: null, fulfillmentHasAvailability: true
      }, 'product');
      announce((pstate.fulfillmentType === 'onDemand' ? 'Same-day' : 'Shipping') + ' selected. ' +
        RETAILERS[pstate.fulfillmentType].length + ' options available.');
      renderProduct();
    }));

    $$('.lce-retailer', host).forEach(b => b.addEventListener('click', function () {
      if (b.disabled) return;
      const prev = pstate.retailerId;
      pstate.retailerId = b.getAttribute('data-rid');
      publish('product_fulfillment_changed', {
        identifier: pstate.upc, selectedFulfillmentId: pstate.retailerId,
        selectedFulfillmentType: pstate.fulfillmentType,
        previousFulfillmentId: prev, previousFulfillmentType: pstate.fulfillmentType
      }, 'product');
      const r = retailerById(pstate.retailerId);
      announce('Delivery option updated. ' + r.name + ', ' + (r.fee ? money(r.fee) : 'free') + '.');
      renderProduct();
    }));

    const setBtn = $('#lce-addr-set', host), inp = $('#lce-address-input', host);
    if (setBtn && inp) {
      const go = function () {
        if (setAddress(inp.value) && pendingAdd) {
          const pa = pendingAdd; pendingAdd = null;
          addProduct(pa.params, pa.openCart);
        }
      };
      setBtn.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
    const chg = $('#lce-addr-change', host);
    if (chg) chg.addEventListener('click', clearAddress);

    const qm = $('#qminus', host), qp = $('#qplus', host);
    if (qm) qm.addEventListener('click', function () {
      if (pstate.qty > 1) {
        pstate.qty--;
        publish('product_quantity_decrease', { identifier: pstate.upc, quantity: pstate.qty, previousQuantity: pstate.qty + 1 }, 'product');
        announce(p.name + ', quantity ' + pstate.qty);
        renderProduct();
      }
    });
    if (qp) qp.addEventListener('click', function () {
      pstate.qty++;
      publish('product_quantity_increase', { identifier: pstate.upc, quantity: pstate.qty, previousQuantity: pstate.qty - 1 }, 'product');
      announce(p.name + ', quantity ' + pstate.qty);
      renderProduct();
    });

    ['eng1', 'eng2'].forEach(function (id, i) {
      const el = $('#' + id, host);
      if (el) el.addEventListener('input', function () { pstate.engraving[i] = el.value; });
    });

    const add = $('#addbtn', host);
    if (add) add.addEventListener('click', function () {
      addProduct({
        upc: pstate.upc, fulfillmentType: pstate.fulfillmentType,
        retailerId: pstate.retailerId, quantity: pstate.qty,
        engravingLines: pstate.engraving.slice()
      }, true);
    });
  }

  // ---------------------------------------------------------------- drawer
  function openDrawer() {
    const d = $('#drawer'); if (!d) return;
    d.classList.add('on'); $('#scrim').classList.add('on');
    document.body.style.overflow = 'hidden';
    publish('cart_opened', true, 'cart'); announce('Shopping cart opened');
  }
  function closeDrawer() {
    const d = $('#drawer'); if (!d) return;
    d.classList.remove('on'); $('#scrim').classList.remove('on');
    document.body.style.overflow = '';
    publish('cart_closed', true, 'cart'); announce('Shopping cart closed');
  }

  function renderDrawer() {
    const box = $('#drawer-items'); if (!box) return;
    const groups = groupByRetailer();
    if (!groups.length) {
      box.innerHTML = '<div class="empty">Your cart is empty.</div>';
    } else {
      box.innerHTML = groups.map(function (g) {
        const unmet = g.retailer.min > 0 && g.subtotal < g.retailer.min;
        return [
          '<div class="retailer-group">',
            '<div class="rg-head"><strong>', g.retailer.name, '</strong>',
              '<span class="exp">', g.retailer.expectation, '</span></div>',
            g.items.map(function (i) {
              const p = CATALOG[i.upc];
              const lineTotal = p.price * i.qty + (i.engravingLines.length ? ENGRAVING.fee * i.qty : 0);
              return [
                '<div class="line">',
                  '<div class="thumb"><img src="', p.image, '" alt=""></div>',
                  '<div class="info">',
                    '<span class="nm">', p.name, '</span>',
                    '<span class="sz">750 ML · ', i.fulfillmentType === 'onDemand' ? 'Same-day' : 'Shipping', '</span>',
                    i.engravingLines.length
                      ? '<span class="eng">Engraved: ' + i.engravingLines.join(' / ') + '</span>' : '',
                    '<div class="foot">',
                      '<div class="qty"><button data-q="-1" data-k="', i.key, '">−</button>',
                        '<span>', i.qty, '</span>',
                        '<button data-q="1" data-k="', i.key, '">+</button></div>',
                      '<span class="amt">', money(lineTotal), '</span>',
                    '</div>',
                    '<button class="rm" data-rm="', i.key, '">Remove</button>',
                  '</div>',
                '</div>'
              ].join('');
            }).join(''),
            unmet ? '<div class="minimum">Add ' + money(g.retailer.min - g.subtotal) +
                    ' more to meet ' + g.retailer.name + "'s order minimum.</div>" : '',
          '</div>'
        ].join('');
      }).join('');
    }

    const t = cartTotals();
    const unmet = unmetMinimums();
    const foot = $('#drawer-foot');
    if (foot) {
      foot.innerHTML = [
        '<div class="promo">',
          state.promo
            ? '<div style="flex:1;font-size:.85rem;align-self:center">Code <strong>' + state.promo +
              '</strong> applied</div><button id="promo-rm">Remove</button>'
            : '<input id="promo-in" placeholder="Promo code"><button id="promo-go">Apply</button>',
        '</div>',
        '<div class="totals">',
          '<div class="r"><span>Subtotal</span><span class="v">', money(t.subtotal), '</span></div>',
          t.discount ? '<div class="r disc"><span>Discount</span><span class="v">−' + money(t.discount) + '</span></div>' : '',
          '<div class="r"><span>Delivery</span><span class="v">', t.delivery ? money(t.delivery) : 'Free', '</span></div>',
          '<div class="r"><span>Estimated tax</span><span class="v">', money(t.tax), '</span></div>',
          '<div class="r big"><span>Total</span><span class="v">', money(t.total), '</span></div>',
        '</div>',
        unmet.length
          ? '<div class="minimum" style="margin:0">Order minimum not met at ' +
            unmet.map(u => u.name).join(', ') + '.</div>' : '',
        '<a class="btn block', (!state.items.length || unmet.length) ? ' disabled-link' : '',
          '" id="co-btn" href="checkout.html"', (!state.items.length || unmet.length) ? ' aria-disabled="true"' : '', '>',
          'Checkout · ', money(t.total), '</a>'
      ].join('');

      const pg = $('#promo-go'), pi = $('#promo-in'), pr = $('#promo-rm');
      if (pg && pi) {
        pg.addEventListener('click', () => applyPromo(pi.value));
        pi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(pi.value); } });
      }
      if (pr) pr.addEventListener('click', removePromo);

      const co = $('#co-btn');
      if (co && (!state.items.length || unmet.length)) {
        co.style.opacity = '.45'; co.style.pointerEvents = 'none';
      }
    }

    $$('[data-q]', box).forEach(b => b.addEventListener('click',
      () => setQty(b.getAttribute('data-k'), parseInt(b.getAttribute('data-q'), 10))));
    $$('[data-rm]', box).forEach(b => b.addEventListener('click',
      () => removeItem(b.getAttribute('data-rm'))));
  }

  // ---------------------------------------------------------------- header count
  function renderHeader() {
    const t = cartTotals();
    $$('[data-lce-cart-items-count]').forEach(function (el) {
      el.textContent = t.itemCount;
      el.hidden = (t.itemCount === 0 && el.getAttribute('data-lce-cart-items-count') !== 'keep-zero');
    });
    $$('[data-lce-cart-subtotal]').forEach(el => { el.textContent = money(t.subtotal); });
  }

  // ---------------------------------------------------------------- checkout page
  function renderCheckout() {
    const side = $('#co-summary'); if (!side) return;
    const t = cartTotals();
    const groups = groupByRetailer();
    side.innerHTML = [
      '<h3>Order summary</h3>',
      groups.length ? groups.map(function (g) {
        return g.items.map(function (i) {
          const p = CATALOG[i.upc];
          const lt = p.price * i.qty + (i.engravingLines.length ? ENGRAVING.fee * i.qty : 0);
          return [
            '<div class="line" style="padding-left:0;padding-right:0">',
              '<div class="thumb"><img src="', p.image, '" alt=""></div>',
              '<div class="info"><span class="nm">', p.name, '</span>',
                '<span class="sz">750 ML · Qty ', i.qty, ' · ', g.retailer.name, '</span>',
                i.engravingLines.length ? '<span class="eng">Engraved</span>' : '',
                '<div class="foot"><span></span><span class="amt">', money(lt), '</span></div>',
              '</div></div>'
          ].join('');
        }).join('');
      }).join('') : '<div class="empty" style="padding:1.5rem 0">Your cart is empty.</div>',
      '<div class="totals" style="margin-top:1rem">',
        '<div class="r"><span>Subtotal</span><span class="v">', money(t.subtotal), '</span></div>',
        t.discount ? '<div class="r disc"><span>Discount (' + state.promo + ')</span><span class="v">−' + money(t.discount) + '</span></div>' : '',
        '<div class="r"><span>Delivery</span><span class="v">', t.delivery ? money(t.delivery) : 'Free', '</span></div>',
        '<div class="r"><span>Tax</span><span class="v">', money(t.tax), '</span></div>',
        '<div class="r big"><span>Total</span><span class="v">', money(t.total), '</span></div>',
      '</div>'
    ].join('');

    const place = $('#place-order');
    if (place) {
      place.textContent = 'Place order · ' + money(t.total);
      place.disabled = !state.items.length;
    }
  }

  function wireCheckout() {
    const form = $('#co-form'); if (!form) return;
    publish('checkout_loaded', { token: 'demo_token', cartId: state.cartId, isGift: false,
      billingSameAsShipping: true, itemCount: cartTotals().itemCount }, 'checkout');

    ['customer', 'billing', 'gift'].forEach(function (ns) {
      $$('[data-form="' + ns + '"] input').forEach(function (el) {
        el.addEventListener('input', function () {
          window.dispatchEvent(new CustomEvent('lce:forms.' + ns, {
            detail: { data: { fieldName: el.name || el.id, fieldValue: el.value },
                      metadata: { namespace: 'forms', event: ns, timestamp: Date.now() } }
          }));
        });
      });
    });

    const gift = $('#is-gift');
    if (gift) gift.addEventListener('change', function () {
      const box = $('#gift-fields'); if (box) box.hidden = !gift.checked;
      publish('checkout_is_gift_toggled', { cartId: state.cartId, isActive: gift.checked, previousIsActive: !gift.checked }, 'checkout');
    });

    const same = $('#bill-same');
    if (same) same.addEventListener('change', function () {
      const box = $('#billing-fields'); if (box) box.hidden = same.checked;
      publish('checkout_billing_same_as_shipping_toggled', { cartId: state.cartId, isActive: same.checked, previousIsActive: !same.checked }, 'checkout');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const t = cartTotals();
      publish('checkout_submit_started', { started: true }, 'checkout');
      const orderNumber = 'KJ-' + String(Math.floor(100000 + Math.random() * 899999));
      setTimeout(function () {
        publish('checkout_submit_completed', { orderNumber: orderNumber, orderTotal: t.total }, 'checkout');
        try { sessionStorage.setItem('kj-order', JSON.stringify({ orderNumber: orderNumber, total: t.total })); } catch (err) {}
        resetCart();
        location.href = 'checkout.html?confirmed=1';
      }, 900);
    });
  }

  // ---------------------------------------------------------------- boot
  function renderAll() { renderHeader(); renderProduct(); renderDrawer(); renderCheckout(); }

  function boot() {
    // drawer wiring
    $$('[data-lce-cart-toggle-button]').forEach(b => b.addEventListener('click', function () {
      const d = $('#drawer');
      if (d && d.classList.contains('on')) closeDrawer(); else openDrawer();
    }));
    const x = $('#drawer-close'); if (x) x.addEventListener('click', closeDrawer);
    const s = $('#scrim'); if (s) s.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    const burger = $('#burger');
    if (burger) burger.addEventListener('click', () => $('nav.main').classList.toggle('open'));

    // homepage add-to-cart shortcuts
    $$('[data-add-upc]').forEach(b => b.addEventListener('click', function (e) {
      e.preventDefault();
      const upc = b.getAttribute('data-add-upc');
      addProduct({ upc: upc, fulfillmentType: 'onDemand',
                   retailerId: RETAILERS.onDemand[0].id, quantity: 1, engravingLines: [] }, true);
    }));

    wireCheckout();
    renderAll();

    publish('client_ready', { isReady: true, message: 'Static stand-in ready', timestamp: Date.now(), version: 'standin-1.0' }, 'other');
  }

  // Public surface mirroring window.LiquidCommerce.elements, so page code written
  // against the SDK keeps working. Namespaced separately so it never collides
  // with the real SDK if both are ever present.
  window.KJDemo = {
    actions: {
      cart: { openCart: openDrawer, closeCart: closeDrawer, addProduct: addProduct,
              applyPromoCode: applyPromo, removePromoCode: removePromo,
              resetCart: resetCart, getDetails: cartSnapshot },
      address: { getDetails: () => state.address, clear: clearAddress },
      product: { getDetails: upc => CATALOG[upc] }
    },
    catalog: CATALOG
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
