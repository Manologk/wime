# AGENTS.md

This file provides guidance to Codex and other coding agents when working with code in this repository.

Online store for Wime Innovation (wime.best), selling in Zambia (Kwacha, +260 WhatsApp). Checkout ends in a pre-filled WhatsApp message (pay on delivery); there is no payment gateway. Static frontend on Cloudflare Pages, Supabase backend, zero running cost. Setup and deploy steps are in README.md; product truth is in PRODUCT.md.

The visual design is a port of the owner's Lovable prototype (github.com/Manologk/wime-wellness-market). Its tokens are the oklch custom properties at the top of `public/css/styles.css`. Match that look in any UI change, and don't use the prototype's AI-generated images or copy its product descriptions (they contain wrong facts and health claims).

## Commands

```sh
npm run dev      # serve public/ at http://localhost:8788 (ES modules need http://, not file://)
npm test         # node:test unit tests in tests/
npm run check    # syntax-check the browser JS
node --test --test-name-pattern="slugify" "tests/**/*.test.mjs"   # run a single test
```

There's no build step and there are no npm dependencies. `public/` is deployed as-is (Pages build output dir = `public`, build command empty).

## Architecture

- **`public/`**: everything served. `index.html` + `js/store.js` is the storefront, `admin.html` + `js/admin.js` is the admin. Both use `css/styles.css`. Supabase JS is imported from jsdelivr as a pinned ESM URL in `js/supabase.js`.
- **`public/img/`**: static hero images (real product photos). Product images shown in the catalogue come from Supabase Storage, uploaded through `/admin`; `assets/products/` holds the owner's source photos (`*_clean.png` are background-cleaned versions to upload).
- **`public/js/config.js`**: the only per-deployment settings (Supabase URL and anon key, WhatsApp number, currency and locale). The anon key is public by design.
- **`public/js/lib/order.js`**: pure logic (cart math, money formatting, WhatsApp message and URL, slugify) with no DOM. It's shared by store, admin and tests, so put testable logic here.
- **`public/js/lib/dom.js`**: the `h()` element builder. Render database content only through `h()` (children become text nodes) and never via `innerHTML`, because product and order fields are user- or admin-supplied.
- **`supabase/schema.sql`**: the whole backend, re-runnable. Security lives in RLS:
  - `products`: anyone can read rows where `is_active`; writes need `is_admin()`. `category` must be one of 'Herbal bitters' / 'Skin care' / 'Wellness' (check constraint, also hard-coded in `store.js` filters and the `admin.js` select).
  - `orders` / `order_items`: admin only. The storefront **never inserts directly**. It calls the `place_order(...)` RPC (security definer), which takes product IDs and quantities, prices them from the DB, snapshots name and price into `order_items`, and returns `{order_number, total, items}` that the client uses to build the WhatsApp text.
  - `place_order` raises customer-facing messages with `errcode = 'P0001'`; `store.js` shows those verbatim and replaces any other error with a generic message. Keep that convention when adding validation.
  - Admin = a row in `public.admins` for an `auth.users` id. Public sign-up is disabled in the Supabase dashboard, not in code.
  - Product photos go in the public Storage bucket `product-images` (admin-only writes, 5 MB, jpeg/png/webp).
- **`public/_headers`**: Cloudflare Pages headers including the CSP. Adding a new external origin (script CDN, image host, font) requires updating the CSP, and inline `style=""` attributes and inline scripts are blocked. Use classes in `styles.css`.
- Schema changes: edit `schema.sql` so it stays idempotent (`if not exists`, `create or replace`, `drop policy if exists`). The user runs it manually in the Supabase SQL Editor; there's no migration tooling.

## Constraints

- Must stay at zero cost: Cloudflare Pages free plan and Supabase free tier. Don't add paid services or anything that needs a server.
- This project uses its **own** Supabase account. The Supabase MCP connector available in AI agent sessions is linked to a different account that hosts another app. Don't use it for this project.
