# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Shoppers buying niche wellness and skin-care products, most likely on a phone and already used to ordering through WhatsApp. **Market: Zambia** (owner confirmed 2026-11-01). Prices are in Zambian Kwacha (`ZMW` / `en-ZM`), and the WhatsApp number uses +260.

The second user is the store owner (Wime Innovation staff). They use `/admin` to set prices and photos, toggle stock and visibility, and work through incoming orders.

## Product Purpose

The online storefront for **Wime Innovation** at **wime.best**. Customers browse a small catalogue, build a cart, enter their contact and delivery details, and send the finished order to Wime on WhatsApp, where payment and delivery are arranged in person. Every order is also saved to the database with an order number, so the owner can track it from `/admin`.

Success means a visitor goes from landing to a sent WhatsApp order in about a minute, with no account and no payment form, and the owner never has to retype an order.

## Positioning

Wime Innovation is a **reseller**, not the manufacturer of what it sells. Its edge is **access**: a short, curated range of wellness and skin-care products that are hard to find locally, many of them imported brands (La Roche-Posay, Oxyenergy, US-made bitters). The owner named "hard to find here" as the main reason a first-time visitor should order. A personal, conversational way to order supports it: a real person confirms every order on WhatsApp.

## Operating Context

- Checkout ends in a pre-filled `wa.me` message to the store's WhatsApp number. There's no card payment, gateway or customer account.
- The owner manages the catalogue and order statuses (new → confirmed → delivered / cancelled) from `/admin`, and replies to customers on WhatsApp.
- Product links are likely to be shared on WhatsApp, so how a link previews matters.

## Capabilities and Constraints

- **Starter catalogue** (six products, all resold). Names include the brand wherever the brand is known (owner decision, 2026-11-01):
  - La Roche-Posay Anthelios UVMune 400 Oil Control Fluid SPF50+ (sunscreen, 50 ml)
  - Organic Black Seed Bitters
  - Exotic Soursop Bitters
  - Oxyenergy Milk Thistle (90 vegetarian capsules)
  - Fat Liver Cleanser (a separate product from Milk Thistle)
  - Dark Spot Remover Cream

  All start hidden with a price of 0 until the owner sets the real price.
- **Zero running cost:** Cloudflare Pages (static, no build step) plus the Supabase free tier. No paid services.
- Guest checkout only, and no payment integration for now.
- Products carry a **category** (Herbal bitters / Skin care / Wellness) used by the storefront filters, and an optional short **tagline** shown on cards.
- **Delivery (owner confirmed 2026-11-03):** same-day delivery within Lusaka, and delivery to other towns across Zambia. Fees are still undecided, so don't state them.
- **WhatsApp number:** +260 975 800 939. Prices are set by the owner in `/admin`.

## Brand Commitments

- The name is **Wime Innovation**, and the domain is **wime.best**.
- **Visual design is open (owner decision 2026-11-03).** The owner rejected the Lovable-prototype look (cream, forest green, Fraunces/DM Sans) as template-like, not premium, dull, and not making the products pop. A redesign replaces it; the prototype remains only as an anti-reference.
- The prototype's AI-generated images (the hero with a fictional "AMALTA" brand, and the liver and dark-spot stand-ins) aren't used. Real product photos only.
- **Trust promises the owner confirmed as true:** genuine imported brands, natural ingredients, fast local delivery, pay on delivery.

## Tone to Avoid

The owner rejected three registers (2026-11-01): **clinical** (pharmacy or hospital), **herbal / rustic** (kraft paper, leaves everywhere, folk remedy), and **flashy / hype** (sale banners, countdowns, "miracle" energy).

## Evidence on Hand

- **Products in hand:** the owner already stocks the starter catalogue listed above.
- **Real product photos** in `assets/products/`: black seed bitters (clean studio shot on white), soursop bitters (marketing image on light grey, with stray UI edges along the right side), milk thistle (packshot on white), La Roche-Posay fluid (hand-held phone photo of the box). There's no photo yet for Dark Spot Remover Cream or Fat Liver Cleanser. These go into Supabase Storage through `/admin`. Design must make mixed photo backgrounds look consistent and must not replace real product photos with generated ones.
- **None yet:** logo, customer reviews, sales figures, regulatory registrations (e.g. NAFDAC numbers).

These must **never be fabricated**, even though the owner allowed invented identity assets: testimonials, ratings, review counts, customer numbers, certifications or registration numbers, "doctor-approved"-type endorsements, and health or medical claims. They would mislead real buyers and, for products like bitters and a liver cleanser, create regulatory risk. Leave space for real reviews and approvals once they exist.

## Product Principles

1. **WhatsApp is the checkout.** Every flow should end in a clear, confident hand-off to WhatsApp. Don't build parallel payment or account systems.
2. **Mobile-first and light.** Assume a phone on mobile data. Every extra kilobyte and tap costs orders.
3. **Honest trust.** Build credibility from clarity: real prices, plain descriptions, how ordering works, and a reachable person. Never use invented proof.
4. **Owner-maintainable.** The owner must be able to change products, prices and stock from `/admin` without touching code.
5. **Free to run.** Every feature has to fit the free tiers.
