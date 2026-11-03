# Wime Innovation store

A small online store for **wime.best**. Customers add products to a cart, enter their details, and send the order to Wime on WhatsApp, where payment and delivery are arranged. There's no payment gateway.

- **Frontend:** static HTML, CSS and JS in `public/`, hosted free on Cloudflare Pages. There's no build step.
- **Backend:** Supabase free tier. Postgres holds products and orders, Storage holds product photos, and Auth handles the admin login.
- **Admin:** `https://wime.best/admin` is where you edit products, prices, photos and stock, and view orders and update their status.

## 1. Set up Supabase (in the new Wime account)

1. Create a project at [supabase.com](https://supabase.com) under the Wime account. Pick a region close to your customers.
2. **SQL Editor → New query:** paste in `supabase/schema.sql` and run it. Then run `supabase/seed.sql` the same way.
3. **Authentication → Sign In / Providers:** turn off **Allow new users to sign up**.
4. **Authentication → Users → Add user → Create new user:** enter the admin email and a strong password, and tick *Auto Confirm User*.
5. Make that user an admin. In the SQL Editor, run:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. **Project Settings → API:** copy the **Project URL** and the **anon public** key.

## 2. Configure the site

Edit `public/js/config.js`:

| Setting | Value |
| --- | --- |
| `supabaseUrl`, `supabaseAnonKey` | From step 1.6. The anon key is meant to be public; row-level security protects the data. |
| `whatsappNumber` | The number that receives orders, in international format with digits only, e.g. `260971234567` |
| `currency`, `locale` | Already set to Zambian Kwacha: `ZMW` / `en-ZM` |

## 3. Run it locally

```sh
npm run dev     # serves public/ at http://localhost:8788
npm test        # unit tests (Node 20+)
```

Sign in at `http://localhost:8788/admin.html`. The six starter products are **hidden, with a price of 0**. For each one, set the price, check its category and tagline, upload a photo, then tick **Visible in store**.

Use the photos in `assets/products/`. For soursop and milk thistle, upload the `*_clean.png` versions: their backgrounds are cleaned so they blend into the product cards. Dark Spot Remover Cream and Fat Liver Cleanser still need photos; until then they show a letter placeholder.

## 4. Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, and pick the repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`public`**
3. Every push to the main branch redeploys the site.

## 5. Connect wime.best

1. Cloudflare dashboard → **Add a domain** → `wime.best` (Free plan). Cloudflare gives you two nameservers.
2. At the registrar where you bought `wime.best`, replace its nameservers with Cloudflare's. This can take a few hours to take effect.
3. Pages project → **Custom domains → Set up a domain**: add `wime.best`, then `www.wime.best`.
4. Supabase → **Authentication → URL Configuration:** set the Site URL to `https://wime.best`.

## Good to know

- **Free-tier pause:** Supabase pauses free projects after about a week with no database activity. Normal store traffic keeps it awake. If it ever pauses, restore it from the Supabase dashboard.
- **Orders can't be tampered with:** the browser only sends product IDs and quantities. Prices and totals are worked out inside the `place_order` database function.
- **Product claims:** keep descriptions to what the product is, how to use it and what's in it, and avoid medical claims, especially for the bitters and the liver product.
