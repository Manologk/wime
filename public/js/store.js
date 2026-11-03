import { config } from './config.js';
import { supabase, isConfigured } from './supabase.js';
import { h, $, storage } from './lib/dom.js';
import {
  formatMoney, cartLines, cartTotal, cartCount, sanitizeCart,
  buildWhatsAppMessage, whatsappUrl,
} from './lib/order.js';

const money = (n) => formatMoney(n, config);
const cartStore = storage('wime-cart', {});
const detailsStore = storage('wime-details', {});
const CATEGORIES = ['All', 'Herbal bitters', 'Skin care', 'Wellness'];

const state = {
  products: [],
  cart: {},
  category: 'All',
  view: 'cart', // 'cart' | 'checkout' | 'done'
  lastOrder: null,
  submitting: false,
  error: '',
};

// Lucide icon paths (static strings, never data).
const ICONS = {
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
function icon(name, cls = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

// ───────────────────────── data ─────────────────────────

async function loadProducts() {
  const grid = $('#product-grid');
  if (!isConfigured) {
    showNotice('The store is not connected yet. Add your Supabase details in js/config.js.');
    grid.replaceChildren();
    return;
  }
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, category, tagline, description, price, image_url, in_stock')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  grid.removeAttribute('aria-busy');
  if (error) {
    showNotice('We could not load products right now. Please refresh the page in a moment.');
    grid.replaceChildren();
    return;
  }
  state.products = data;
  state.cart = sanitizeCart(cartStore.get(), data);
  renderFilters();
  renderProducts();
  renderCartCount();
  openProductFromHash();
}

// ───────────────────────── cart ─────────────────────────

function setQty(id, qty) {
  if (qty < 1) delete state.cart[id];
  else state.cart[id] = Math.min(qty, 99);
  cartStore.set(state.cart);
  renderCartCount();
  if ($('#cart-dialog').open) renderCart();
}

function addToCart(id) {
  setQty(id, (state.cart[id] || 0) + 1);
  if ($('#product-dialog').open) $('#product-dialog').close();
  openCart();
}

function renderCartCount() {
  const n = cartCount(state.cart);
  const badge = $('#cart-count');
  badge.textContent = n;
  badge.hidden = n === 0;
  $('#cart-open').setAttribute('aria-label', n ? `Open cart, ${n} item${n === 1 ? '' : 's'}` : 'Open cart');

  const bar = $('#cart-bar');
  bar.hidden = n === 0;
  document.body.classList.toggle('has-cart-bar', n > 0);
  if (n) {
    $('#cart-bar-count').textContent = `${n} item${n === 1 ? '' : 's'}`;
    $('#cart-bar-total').textContent = money(cartTotal(cartLines(state.cart, state.products)));
  }
}

function qtyControls(id, qty, label) {
  return h('div', { class: 'qty', role: 'group', 'aria-label': `Quantity of ${label}` },
    h('button', { type: 'button', 'aria-label': qty === 1 ? `Remove ${label}` : 'Less', onclick: () => setQty(id, qty - 1) }, icon('minus')),
    h('span', { 'aria-live': 'polite' }, qty),
    h('button', { type: 'button', 'aria-label': 'More', disabled: qty >= 99, onclick: () => setQty(id, qty + 1) }, icon('plus')),
  );
}

// ───────────────────────── products ─────────────────────────

function productImage(p) {
  return p.image_url
    ? h('img', { class: 'product-img', src: p.image_url, alt: p.name, loading: 'lazy', decoding: 'async' })
    : h('div', { class: 'product-img img-placeholder', 'aria-hidden': 'true' }, p.name.charAt(0));
}

function addButton(p) {
  return p.in_stock
    ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => addToCart(p.id) }, 'Add to cart')
    : h('span', { class: 'badge-out' }, 'Out of stock');
}

function renderFilters() {
  // Only offer categories that have products, so a filter never leads to an empty grid.
  const present = new Set(state.products.map((p) => p.category));
  const cats = CATEGORIES.filter((c) => c === 'All' || present.has(c));
  $('#filters').replaceChildren(...(cats.length > 2 ? cats : []).map((c) =>
    h('button', {
      type: 'button', class: 'filter', 'aria-pressed': String(state.category === c),
      onclick: () => { state.category = c; renderFilters(); renderProducts(); },
    }, c)));
}

function renderProducts() {
  const grid = $('#product-grid');
  if (!state.products.length) {
    grid.replaceChildren(h('p', { class: 'empty' }, 'New products are coming soon. Check back shortly.'));
    return;
  }
  const shown = state.category === 'All' ? state.products : state.products.filter((p) => p.category === state.category);
  grid.replaceChildren(...shown.map((p) =>
    h('article', { class: `card${p.in_stock ? '' : ' is-out'}` },
      h('button', { type: 'button', class: 'card-media', 'aria-label': `View ${p.name}`, onclick: () => openProduct(p) }, productImage(p)),
      h('div', { class: 'card-body' },
        h('span', { class: 'eyebrow' }, p.category),
        h('h3', {}, h('button', { type: 'button', onclick: () => openProduct(p) }, p.name)),
        h('p', { class: 'tagline' }, p.tagline || ''),
        h('div', { class: 'card-foot' }, h('span', { class: 'price' }, money(p.price)), addButton(p)),
      ),
    )));
}

function openProduct(p) {
  const dialog = $('#product-dialog');
  $('#product-dialog-body').replaceChildren(
    h('div', { class: 'pd' },
      h('div', { class: 'pd-media' }, productImage(p)),
      h('div', { class: 'pd-info' },
        h('span', { class: 'eyebrow' }, p.category),
        h('h2', { id: 'pd-name' }, p.name),
        p.tagline ? h('p', { class: 'muted' }, p.tagline) : null,
        h('p', { class: 'price' }, money(p.price)),
        p.description ? h('div', { class: 'pd-desc' }, p.description) : null,
        h('div', { class: 'pd-actions' }, addButton(p)),
      ),
    ),
  );
  history.replaceState(null, '', `#${p.slug}`);
  if (!dialog.open) dialog.showModal();
}

function openProductFromHash() {
  const slug = decodeURIComponent(location.hash.slice(1));
  const p = slug && state.products.find((x) => x.slug === slug);
  if (p) openProduct(p);
}

// ───────────────────────── cart drawer ─────────────────────────

function openCart() {
  // Keep the "send on WhatsApp" screen until the customer starts a new cart.
  if (state.view !== 'done' || cartCount(state.cart) > 0) state.view = 'cart';
  state.error = '';
  renderCart();
  const d = $('#cart-dialog');
  if (!d.open) d.showModal();
}

function renderCart() {
  const body = $('#cart-body');
  const title = $('#cart-title');
  if (state.view === 'done') {
    title.textContent = 'Order saved';
    body.replaceChildren(renderDone());
    return;
  }
  const lines = cartLines(state.cart, state.products);
  if (!lines.length) {
    state.view = 'cart';
    title.textContent = 'Your cart';
    body.replaceChildren(
      h('div', { class: 'empty-cart' }, h('div', {},
        h('p', {}, 'Your cart is empty.'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => $('#cart-dialog').close() }, 'Browse products'))),
    );
    return;
  }
  if (state.view === 'checkout') {
    title.textContent = 'Delivery details';
    body.replaceChildren(renderCheckout(lines));
    return;
  }
  title.textContent = 'Your cart';
  body.replaceChildren(
    h('ul', { class: 'cart-lines' }, lines.map(({ product: p, quantity }) =>
      h('li', { class: 'cart-line' },
        h('div', { class: 'cart-thumb' }, productImage(p)),
        h('div', { class: 'cart-line-info' },
          h('span', { class: 'cart-line-name' }, p.name),
          h('span', { class: 'muted small' }, money(p.price)),
          p.in_stock ? qtyControls(p.id, quantity, p.name) : h('span', { class: 'badge-out' }, 'Out of stock, please remove'),
        ),
      ))),
    h('div', { class: 'drawer-foot' },
      h('div', { class: 'total-row' }, h('span', {}, 'Total'), h('span', {}, money(cartTotal(lines)))),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-block',
        disabled: lines.some((l) => !l.product.in_stock),
        onclick: () => { state.view = 'checkout'; renderCart(); },
      }, 'Checkout'),
    ),
  );
}

function field(label, name, attrs = {}, hint) {
  const id = `f-${name}`;
  const saved = detailsStore.get()[name] || '';
  const control = attrs.multiline
    ? h('textarea', { id, name, rows: attrs.rows || 3, ...attrs, multiline: null, value: saved })
    : h('input', { id, name, ...attrs, value: saved });
  return h('div', { class: 'field' },
    h('label', { for: id }, label, attrs.required ? null : h('span', { class: 'optional' }, ' (optional)')),
    control,
    hint ? h('p', { class: 'hint' }, hint) : null,
  );
}

function renderCheckout(lines) {
  return h('form', { class: 'checkout', novalidate: true, onsubmit: (e) => placeOrder(e, lines) },
    field('Full name', 'name', { required: true, autocomplete: 'name', maxlength: 100 }),
    field('Phone number', 'phone', { required: true, type: 'tel', autocomplete: 'tel', inputmode: 'tel', maxlength: 20, pattern: '\\+?[0-9 \\(\\)\\-]{7,20}' }, 'Preferably your WhatsApp number.'),
    field('Delivery address', 'address', { required: true, multiline: true, rows: 2, autocomplete: 'street-address', maxlength: 500 }),
    field('Note for us', 'note', { multiline: true, rows: 2, maxlength: 1000 }),
    h('p', { class: 'muted small' }, 'Your order is sent to us on WhatsApp. Pay on delivery.'),
    state.error ? h('p', { class: 'form-error', role: 'alert' }, state.error) : null,
    h('div', { class: 'total-row' }, h('span', {}, 'Total'), h('span', {}, money(cartTotal(lines)))),
    h('button', { type: 'submit', class: 'btn btn-primary btn-block', disabled: state.submitting },
      state.submitting ? 'Saving your order…' : 'Place order'),
    h('button', { type: 'button', class: 'link-button', onclick: () => { state.view = 'cart'; state.error = ''; renderCart(); } }, 'Back to cart'),
  );
}

async function placeOrder(event, lines) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const fd = new FormData(form);
  const customer = Object.fromEntries(['name', 'phone', 'address', 'note'].map((k) => [k, String(fd.get(k) || '').trim()]));
  detailsStore.set(customer); // also keeps the form filled if we re-render it
  if (!config.whatsappNumber) {
    state.error = 'Ordering is not set up yet: the store WhatsApp number is missing.';
    renderCart();
    return;
  }

  state.submitting = true;
  state.error = '';
  renderCart();

  const { data, error } = await supabase.rpc('place_order', {
    p_name: customer.name,
    p_phone: customer.phone,
    p_address: customer.address,
    p_note: customer.note || null,
    p_items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
  });
  state.submitting = false;

  if (error) {
    // Validation errors raised in place_order are written for customers; anything else isn't.
    state.error = error.code === 'P0001'
      ? error.message
      : 'We could not save your order. Check your connection and try again.';
    renderCart();
    return;
  }

  const message = buildWhatsAppMessage({ storeName: config.storeName, order: data, customer, money });
  state.lastOrder = { number: data.order_number, url: whatsappUrl(config.whatsappNumber, message) };
  state.cart = {};
  cartStore.set({});
  detailsStore.set({ ...customer, note: '' });
  state.view = 'done';
  renderCartCount();
  renderCart();
}

function renderDone() {
  const { number, url } = state.lastOrder;
  return h('div', { class: 'done' },
    h('div', { class: 'done-icon' }, icon('check')),
    h('h3', {}, `Order #${number} saved`),
    h('p', {}, 'One last step: send your order to us on WhatsApp so we can confirm delivery.'),
    h('a', { class: 'btn btn-primary btn-block', href: url, target: '_blank', rel: 'noopener' }, 'Send order on WhatsApp'),
    h('button', { type: 'button', class: 'link-button', onclick: () => { state.view = 'cart'; $('#cart-dialog').close(); } }, 'Continue shopping'),
  );
}

// ───────────────────────── misc ─────────────────────────

function showNotice(text) {
  const n = $('#notice');
  n.textContent = text;
  n.hidden = false;
}

function setupDialogs() {
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  }
  $('#product-dialog').addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
  });
  $('#cart-open').addEventListener('click', openCart);
  $('#cart-bar').addEventListener('click', openCart);
  window.addEventListener('hashchange', openProductFromHash);
}

function setupFooter() {
  $('#year').textContent = new Date().getFullYear();
  if (config.whatsappNumber) {
    const a = $('#footer-whatsapp');
    a.href = whatsappUrl(config.whatsappNumber, `Hello ${config.storeName}, I have a question.`);
    a.target = '_blank';
    a.rel = 'noopener';
  }
}

setupDialogs();
setupFooter();
loadProducts();
