// Pure helpers shared by the storefront, admin and tests. No DOM, no network.

export function formatMoney(amount, { currency, locale }) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** cart: { [productId]: quantity }, products: array from DB → priced lines */
export function cartLines(cart, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  for (const [id, qty] of Object.entries(cart)) {
    const product = byId.get(id);
    if (!product || qty < 1) continue;
    lines.push({ product, quantity: qty, subtotal: Number(product.price) * qty });
  }
  return lines;
}

export function cartTotal(lines) {
  return lines.reduce((sum, l) => sum + l.subtotal, 0);
}

export function cartCount(cart) {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

/** Drops unknown/hidden products and clamps quantities to 1..99. */
export function sanitizeCart(raw, products) {
  const known = new Set(products.map((p) => p.id));
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [id, qty] of Object.entries(raw)) {
    const n = Math.floor(Number(qty));
    if (known.has(id) && n >= 1) clean[id] = Math.min(n, 99);
  }
  return clean;
}

/**
 * order: { order_number?, total, items: [{ name, unit_price, quantity }] }
 * customer: { name, phone, address, email?, note? }
 */
export function buildWhatsAppMessage({ storeName, order, customer, money }) {
  const lines = [`Hello ${storeName}, I would like to place an order.`, ''];
  if (order.order_number) lines.push(`Order #${order.order_number}`);
  for (const item of order.items) {
    lines.push(`- ${item.quantity} x ${item.name} (${money(Number(item.unit_price) * item.quantity)})`);
  }
  lines.push(`Total: ${money(order.total)}`, '');
  lines.push(`Name: ${customer.name}`);
  lines.push(`Phone: ${customer.phone}`);
  if (customer.email) lines.push(`Email: ${customer.email}`);
  lines.push(`Address: ${customer.address}`);
  if (customer.note) lines.push(`Note: ${customer.note}`);
  return lines.join('\n');
}

export function whatsappUrl(number, message) {
  const digits = String(number).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
