import { config } from './config.js';
import { supabase, isConfigured } from './supabase.js';
import { h, $ } from './lib/dom.js';
import { formatMoney, slugify, whatsappUrl } from './lib/order.js';

const money = (n) => formatMoney(n, config);
const app = $('#app');
const STATUSES = ['new', 'confirmed', 'delivered', 'cancelled'];
const BUCKET = 'product-images';

const state = { tab: 'orders', statusFilter: 'new', orders: [], products: [] };

// ───────────────────────── auth ─────────────────────────

async function boot() {
  if (!isConfigured) {
    app.replaceChildren(h('p', { class: 'notice' }, 'Add your Supabase URL and anon key to js/config.js first.'));
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return renderLogin();

  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  $('#sign-out').hidden = false;
  if (error || !isAdmin) {
    app.replaceChildren(h('div', { class: 'login-card' },
      h('h1', {}, 'No access'),
      h('p', { class: 'muted' }, `${session.user.email} is not an admin. Add this user to the admins table (see the README).`)));
    return;
  }
  renderShell();
}

function renderLogin(message = '') {
  $('#sign-out').hidden = true;
  const form = h('form', { class: 'login-card', onsubmit: signIn },
    h('h1', {}, 'Sign in'),
    h('div', { class: 'field' }, h('label', { for: 'email' }, 'Email'),
      h('input', { id: 'email', name: 'email', type: 'email', required: true, autocomplete: 'username' })),
    h('div', { class: 'field' }, h('label', { for: 'password' }, 'Password'),
      h('input', { id: 'password', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
    message ? h('p', { class: 'form-error', role: 'alert' }, message) : null,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Sign in'),
  );
  app.replaceChildren(form);
  $('#email').focus();
}

async function signIn(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const btn = e.currentTarget.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const { error } = await supabase.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
  if (error) return renderLogin('Wrong email or password.');
  boot();
}

$('#sign-out').addEventListener('click', () => supabase.auth.signOut()); // onAuthStateChange shows the login

// ───────────────────────── shell ─────────────────────────

function renderShell() {
  const tab = (id, label) => h('button', {
    type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(state.tab === id),
    onclick: () => { state.tab = id; renderShell(); },
  }, label);
  app.replaceChildren(
    h('div', { class: 'tabs', role: 'tablist' }, tab('orders', 'Orders'), tab('products', 'Products')),
    h('section', { id: 'panel' }, h('p', { class: 'muted' }, 'Loading…')),
  );
  if (state.tab === 'orders') loadOrders();
  else loadProducts();
}

function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2500);
}

function fail(error) {
  console.error(error);
  toast(`Something went wrong: ${error.message || error}`);
}

// ───────────────────────── orders ─────────────────────────

async function loadOrders() {
  let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
  if (state.statusFilter !== 'all') q = q.eq('status', state.statusFilter);
  const { data, error } = await q;
  if (error) return fail(error);
  state.orders = data;
  renderOrders();
}

function renderOrders() {
  const filter = h('div', { class: 'field' },
    h('label', { for: 'status-filter' }, 'Show'),
    h('select', {
      id: 'status-filter',
      onchange: (e) => { state.statusFilter = e.target.value; loadOrders(); },
    }, ['all', ...STATUSES].map((s) => h('option', { value: s, selected: s === state.statusFilter }, s === 'all' ? 'All orders' : cap(s)))),
  );
  const list = state.orders.length
    ? h('div', { class: 'list' }, state.orders.map(orderCard))
    : h('p', { class: 'muted' }, 'No orders here yet.');
  $('#panel').replaceChildren(
    h('div', { class: 'toolbar' }, filter, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: loadOrders }, 'Refresh')),
    list,
  );
}

function orderCard(o) {
  const when = new Date(o.created_at).toLocaleString(config.locale, { dateStyle: 'medium', timeStyle: 'short' });
  const phoneDigits = o.phone.replace(/\D/g, '');
  return h('article', { class: 'panel' },
    h('div', { class: 'order-head' },
      h('h3', {}, `#${o.order_number} · ${o.customer_name}`),
      h('span', { class: `status status-${o.status}` }, cap(o.status)),
    ),
    h('p', { class: 'muted small' }, when),
    h('div', { class: 'order-grid' },
      h('div', {},
        h('ul', { class: 'order-items' }, o.order_items.map((i) =>
          h('li', {}, `${i.quantity} × ${i.product_name}: ${money(i.unit_price * i.quantity)}`))),
        h('p', { class: 'price mt-8' }, `Total ${money(o.total)}`),
      ),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Phone'), h('dd', {}, o.phone),
        o.email ? [h('dt', {}, 'Email'), h('dd', {}, o.email)] : null,
        h('dt', {}, 'Address'), h('dd', {}, o.address),
        o.note ? [h('dt', {}, 'Note'), h('dd', {}, o.note)] : null,
      ),
    ),
    h('div', { class: 'toolbar mt-12' },
      h('div', { class: 'field' },
        h('label', { for: `st-${o.id}` }, 'Status'),
        h('select', { id: `st-${o.id}`, onchange: (e) => setStatus(o, e.target.value) },
          STATUSES.map((s) => h('option', { value: s, selected: s === o.status }, cap(s))))),
      phoneDigits.length >= 7
        ? h('a', { class: 'btn btn-whatsapp btn-sm', href: whatsappUrl(phoneDigits, `Hello ${o.customer_name}, this is ${config.storeName} about your order #${o.order_number}.`), target: '_blank', rel: 'noopener' }, 'Message customer')
        : null,
    ),
  );
}

async function setStatus(order, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
  if (error) return fail(error);
  toast(`Order #${order.order_number} marked ${status}`);
  loadOrders();
}

// ───────────────────────── products ─────────────────────────

async function loadProducts() {
  const { data, error } = await supabase.from('products').select('*').order('sort_order').order('name');
  if (error) return fail(error);
  state.products = data;
  renderProducts();
}

function renderProducts() {
  const rows = state.products.map((p) =>
    h('article', { class: 'panel product-row' },
      p.image_url
        ? h('img', { class: 'cart-thumb', src: p.image_url, alt: '' })
        : h('div', { class: 'cart-thumb img-placeholder', 'aria-hidden': 'true' }, p.name.charAt(0)),
      h('div', {},
        h('strong', {}, p.name),
        p.is_active ? null : h('span', { class: 'tag' }, 'Hidden'),
        p.in_stock ? null : h('span', { class: 'tag' }, 'Out of stock'),
        p.in_hero ? h('span', { class: 'tag tag-hero' }, 'In hero') : null,
        h('p', { class: 'muted small' }, `${p.category} · ${money(p.price)}`),
      ),
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => quickUpdate(p, { in_stock: !p.in_stock }) },
          p.in_stock ? 'Mark out of stock' : 'Mark in stock'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => quickUpdate(p, { is_active: !p.is_active }) },
          p.is_active ? 'Hide' : 'Show'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => quickUpdate(p, { in_hero: !p.in_hero }) },
          p.in_hero ? 'Remove from hero' : 'Add to hero'),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => openProductForm(p) }, 'Edit'),
      ),
    ));
  $('#panel').replaceChildren(
    h('div', { class: 'toolbar' },
      h('p', { class: 'muted' }, `${state.products.length} product(s)`),
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => openProductForm(null) }, 'Add product')),
    h('div', { class: 'list' }, rows),
  );
}

async function quickUpdate(p, patch) {
  if (patch.is_active && Number(p.price) <= 0 && !confirm(`${p.name} has no price yet. Show it anyway?`)) return;
  const { error } = await supabase.from('products').update(patch).eq('id', p.id);
  if (error) return fail(error);
  loadProducts();
}

function openProductForm(p) {
  const dialog = $('#product-form-dialog');
  const isNew = !p;
  p = p || { name: '', slug: '', category: 'Wellness', tagline: '', description: '', price: '', in_stock: true, is_active: true, in_hero: false, sort_order: (state.products.length + 1) * 10, image_url: null, hero_image_url: null };

  const preview = p.image_url ? h('img', { class: 'preview-img', src: p.image_url, alt: '' }) : null;
  const fileInput = h('input', {
    id: 'pf-image', name: 'image', type: 'file', accept: 'image/jpeg,image/png,image/webp',
    onchange: (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = $('#pf-preview') || h('img', { id: 'pf-preview', class: 'preview-img', alt: '' });
      img.src = URL.createObjectURL(file);
      fileInput.before(img);
    },
  });
  if (preview) preview.id = 'pf-preview';

  const input = (label, name, attrs = {}, cls = '') => h('div', { class: `field ${cls}` },
    h('label', { for: `pf-${name}` }, label),
    attrs.multiline
      ? h('textarea', { id: `pf-${name}`, name, rows: 5, value: p[name] ?? '' })
      : h('input', { id: `pf-${name}`, name, value: p[name] ?? '', ...attrs }));

  const form = h('form', { class: 'form-grid', onsubmit: (e) => saveProduct(e, p, isNew) },
    input('Name', 'name', { required: true, maxlength: 120, oninput: (e) => { if (isNew) form.elements.slug.value = slugify(e.target.value); } }, 'span-2'),
    h('div', { class: 'field' }, h('label', { for: 'pf-category' }, 'Category'),
      h('select', { id: 'pf-category', name: 'category' },
        ['Herbal bitters', 'Skin care', 'Wellness'].map((c) => h('option', { value: c, selected: c === p.category }, c)))),
    input('Short tagline (shown on the card)', 'tagline', { maxlength: 80, placeholder: 'e.g. Milk thistle extract · 90 capsules' }),
    input(`Price (${config.currency})`, 'price', { required: true, type: 'number', min: 0, step: '0.01', inputmode: 'decimal' }),
    input('Display order', 'sort_order', { type: 'number', step: 1 }),
    input('Link name (URL slug)', 'slug', { required: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', title: 'Lowercase letters, numbers and dashes' }, 'span-2'),
    input('Description', 'description', { multiline: true }, 'span-2'),
    h('div', { class: 'field span-2' }, h('label', { for: 'pf-image' }, 'Photo (JPG, PNG or WebP, up to 5 MB)'), preview, fileInput),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'is_active', checked: p.is_active }), 'Visible in store'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'in_stock', checked: p.in_stock }), 'In stock'),
    h('fieldset', { class: 'hero-fieldset span-2' },
      h('legend', {}, 'Homepage slideshow'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'in_hero', checked: p.in_hero }), 'Show this product in the homepage slideshow'),
      h('p', { class: 'hint' }, 'The slideshow uses the product photo. To show a different picture there (for example a lifestyle shot), add a hero photo below. Slides follow the Display order.'),
      h('div', { class: 'field' },
        h('label', { for: 'pf-hero-image' }, 'Hero photo (optional, JPG, PNG or WebP, up to 5 MB)'),
        p.hero_image_url ? h('img', { class: 'preview-img preview-wide', src: p.hero_image_url, alt: '' }) : null,
        h('input', { id: 'pf-hero-image', name: 'hero_image', type: 'file', accept: 'image/jpeg,image/png,image/webp' }),
        p.hero_image_url ? h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'remove_hero_image' }), 'Remove hero photo (use the product photo)') : null,
      ),
    ),
    h('div', { class: 'span-2 toolbar mt-8' },
      isNew ? h('span') : h('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: () => deleteProduct(p) }, 'Delete product'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, isNew ? 'Add product' : 'Save changes')),
  );

  $('#product-form-body').replaceChildren(h('h2', { id: 'pf-title' }, isNew ? 'Add product' : `Edit ${p.name}`), form);
  dialog.showModal();
}

async function saveProduct(e, p, isNew) {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const row = {
    name: String(fd.get('name')).trim(),
    slug: String(fd.get('slug')).trim(),
    category: String(fd.get('category')),
    tagline: String(fd.get('tagline') || '').trim(),
    description: String(fd.get('description') || '').trim(),
    price: Number(fd.get('price')),
    sort_order: Number(fd.get('sort_order')) || 0,
    is_active: fd.get('is_active') === 'on',
    in_stock: fd.get('in_stock') === 'on',
    in_hero: fd.get('in_hero') === 'on',
  };
  const label = submit.textContent;
  const reset = () => { submit.disabled = false; submit.textContent = label; };
  submit.disabled = true;
  submit.textContent = 'Saving…';

  try {
    const photo = await uploadImage(form.elements.image.files[0], row.slug);
    if (photo) row.image_url = photo;
    const heroPhoto = await uploadImage(form.elements.hero_image.files[0], `${row.slug}-hero`);
    if (heroPhoto) row.hero_image_url = heroPhoto;
    else if (form.elements.remove_hero_image?.checked) row.hero_image_url = null;
  } catch (err) {
    reset();
    return err.tooBig ? toast('That photo is larger than 5 MB.') : fail(err);
  }

  const { error } = isNew
    ? await supabase.from('products').insert(row)
    : await supabase.from('products').update(row).eq('id', p.id);
  if (error) {
    reset();
    return fail(error.code === '23505' ? new Error('Another product already uses that link name.') : error);
  }
  $('#product-form-dialog').close();
  toast(isNew ? 'Product added' : 'Product saved');
  loadProducts();
}

// Uploads a photo to Storage and returns its public URL (or null when no file was chosen).
async function uploadImage(file, name) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw Object.assign(new Error('too big'), { tooBig: true });
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${name}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function deleteProduct(p) {
  if (!confirm(`Delete "${p.name}"? Past orders keep their record of it. To just take it off the store, use Hide instead.`)) return;
  const { error } = await supabase.from('products').delete().eq('id', p.id);
  if (error) return fail(error);
  $('#product-form-dialog').close();
  toast('Product deleted');
  loadProducts();
}

// ───────────────────────── misc ─────────────────────────

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') renderLogin();
});

boot();
