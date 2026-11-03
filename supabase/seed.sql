-- Starter catalogue. Run after schema.sql.
-- Products start HIDDEN (is_active = false) with price 0 so customers never see
-- placeholder prices. In /admin: set the real price, upload a photo, check the
-- description, then tick "Visible in store".

insert into public.products (slug, name, category, tagline, price, is_active, sort_order) values
  ('la-roche-posay-anthelios-oil-control-spf50', 'La Roche-Posay Anthelios UVMune 400 Oil Control Fluid SPF50+', 'Skin care',      'Sun protection fluid for oily skin · 50 ml', 0, false, 10),
  ('organic-black-seed-bitters',                 'Organic Black Seed Bitters',                                  'Herbal bitters', 'Black seed herbal bitters',                  0, false, 20),
  ('exotic-soursop-bitters',                     'Exotic Soursop Bitters',                                      'Herbal bitters', 'Soursop herbal bitters',                     0, false, 30),
  ('oxyenergy-milk-thistle',                     'Oxyenergy Milk Thistle',                                      'Wellness',       'Milk thistle extract · 90 vegetarian capsules', 0, false, 40),
  ('fat-liver-cleanser',                         'Fat Liver Cleanser',                                          'Wellness',       '',                                           0, false, 50),
  ('dark-spot-remover-cream',                    'Dark Spot Remover Cream',                                     'Skin care',      '',                                           0, false, 60)
on conflict (slug) do nothing;
