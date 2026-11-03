import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoney, cartLines, cartTotal, cartCount, sanitizeCart,
  buildWhatsAppMessage, whatsappUrl, slugify,
} from '../public/js/lib/order.js';

const products = [
  { id: 'a', name: 'Organic Black Seed Bitters', price: '5000.00' },
  { id: 'b', name: 'Dark Spot Remover Cream', price: 7500 },
];

test('cartLines prices from products and skips unknown ids', () => {
  const lines = cartLines({ a: 2, b: 1, gone: 3 }, products);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].subtotal, 10000);
  assert.equal(cartTotal(lines), 17500);
});

test('cartCount sums quantities', () => {
  assert.equal(cartCount({ a: 2, b: 3 }), 5);
  assert.equal(cartCount({}), 0);
});

test('sanitizeCart drops unknown products and clamps quantities', () => {
  assert.deepEqual(sanitizeCart({ a: 500, b: 0, x: 1, c: 'nope' }, products), { a: 99 });
  assert.deepEqual(sanitizeCart(null, products), {});
  assert.deepEqual(sanitizeCart({ a: '2.7' }, products), { a: 2 });
});

test('formatMoney uses the configured currency', () => {
  const s = formatMoney(5000, { currency: 'NGN', locale: 'en-NG' });
  assert.match(s, /5,000/);
  assert.match(formatMoney(12.5, { currency: 'USD', locale: 'en-US' }), /\$12\.50/);
  assert.equal(formatMoney(3, { currency: 'NOPE!', locale: 'en' }), 'NOPE! 3.00');
});

test('buildWhatsAppMessage includes order, totals and customer details', () => {
  const msg = buildWhatsAppMessage({
    storeName: 'Wime Innovation',
    order: { order_number: 1001, total: 17500, items: [
      { name: 'Organic Black Seed Bitters', unit_price: '5000.00', quantity: 2 },
      { name: 'Dark Spot Remover Cream', unit_price: 7500, quantity: 1 },
    ] },
    customer: { name: 'Ada', phone: '0803 000 0000', address: '1 Main St', email: '', note: 'Call first' },
    money: (n) => `N${n}`,
  });
  assert.match(msg, /Order #1001/);
  assert.match(msg, /- 2 x Organic Black Seed Bitters \(N10000\)/);
  assert.match(msg, /Total: N17500/);
  assert.match(msg, /Note: Call first/);
  assert.doesNotMatch(msg, /Email:/);
});

test('whatsappUrl strips non-digits and encodes the text', () => {
  assert.equal(whatsappUrl('+234 803-123', 'a b&c\n'), 'https://wa.me/234803123?text=a%20b%26c%0A');
});

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('  Exotic Soursop Bitters! '), 'exotic-soursop-bitters');
  assert.equal(slugify('Crème Brûlée'), 'creme-brulee');
});
