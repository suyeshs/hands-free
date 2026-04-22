-- Migration 062: Coorg Food Company tenant seed
-- Pre-seeds the POS with the coorg-food-company-1413 tenant.
-- All statements use INSERT OR IGNORE / guarded UPDATEs so this is safe
-- to include even if the operator later overwrites settings via the UI.

-- ── Tenant config ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO tenant_config (
  id, tenant_id, company_name, subdomain,
  api_base_url, orders_endpoint, menu_endpoint,
  primary_color, logo_url, currency, timezone, activated_at
) VALUES (
  1, 'coorg-food-company-1413', 'The Coorg Food Company', 'coorg-food-company-1413',
  'https://handsfree-restaurant-client.suyesh.workers.dev/api',
  'https://handsfree-tenant-router.suyesh.workers.dev',
  'https://handsfree-tenant-router.suyesh.workers.dev',
  '#78350f',
  'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public',
  'INR', 'Asia/Kolkata', datetime('now')
);

-- ── Restaurant settings (only if still at factory default) ───────────────────

UPDATE restaurant_settings SET
  name                = 'The Coorg Food Company',
  company_name        = 'The Coorg Food Company',
  address_line1       = 'St Marks Road',
  city                = 'Bengaluru',
  state               = 'Karnataka',
  pincode             = '560001',
  phone               = '+91 99001 00000',
  invoice_prefix      = 'TCFC',
  invoice_start_number = 1,
  current_invoice_number = 1,
  tax_enabled         = 1,
  cgst_rate           = 2.5,
  sgst_rate           = 2.5,
  print_logo          = 1,
  logo_url            = 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8d313e79-77a9-4c93-4c21-41015e4e1700/public'
WHERE id = 1 AND name = 'Restaurant Name';

-- ── Staff (Manager PIN 1234 · Server PIN 5678) ───────────────────────────────

INSERT OR IGNORE INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, permissions, created_at) VALUES
('staff-mgr-001', 'coorg-food-company-1413', 'Manager', 'manager',
 '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
 1, '["all"]', strftime('%s','now')),
('staff-wtr-001', 'coorg-food-company-1413', 'Server', 'waiter',
 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f',
 1, '["pos","tables"]', strftime('%s','now'));

-- ── Menu categories ──────────────────────────────────────────────────────────

INSERT OR IGNORE INTO menu_categories (id, name, sort_order, active) VALUES
('cat-appetizers',             'APPETIZERS',             1,  1),
('cat-combo-meals',            'COMBO MEALS',            2,  1),
('cat-coolers',                'COOLERS',                3,  1),
('cat-curries',                'CURRIES',                4,  1),
('cat-desserts',               'DESSERTS',               5,  1),
('cat-ottis,-puttus-and-rice', 'OTTIS, PUTTUS AND RICE', 6,  1),
('cat-pickles',                'PICKLES',                7,  1),
('cat-platters',               'PLATTERS',               8,  1),
('cat-pulavs',                 'PULAVS',                 9,  1),
('cat-soups',                  'SOUPS',                  10, 1);

-- ── Menu items ───────────────────────────────────────────────────────────────
-- image_url = single CDN URL (NULL when no image)
-- dietary_tags = JSON array, e.g. '["vegetarian"]' or '[]'

-- APPETIZERS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-6',       'Bale Kai Fry',                         'cat-appetizers', 210,  'Tangy Raw Banana Fritters',                                                                                              'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/02292ce4-8e96-49a7-d047-9e7115144a00/public', 1, '["vegetarian"]'),
('cfc-tcfc-14',      'Chicken Cutlets',                      'cat-appetizers', 315,  'Mildly spiced soft chicken cutlets ( 4 pcs )',                                                                           'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/fc64684e-2368-4b81-fbad-d3c9ff825600/public', 1, '[]'),
('cfc-tcfc-26',      'Chilli Chicken',                       'cat-appetizers', 295,  'Boneless small chicken, lightly sauteed in green capsicum & onions',                                                    NULL, 1, '[]'),
('cfc-tcfc-29',      'Chilli Prawn',                         'cat-appetizers', 390,  'Succulent crunchy prawns tossed in onions & capsicum',                                                                   'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7faf253b-231e-4f21-b7ae-276411d0fe00/public', 1, '[]'),
('cfc-tcfc-23',      'Chilly Pork',                          'cat-appetizers', 390,  'Our take on Coorgs popular Chilly pork, which is tossed with crunchy onions n capsicum',                               'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/4c75a9fa-0284-4dce-5d37-0059364ace00/public', 1, '[]'),
('cfc-tcfc-27',      'Chudals/Chidkan Pork',                 'cat-appetizers', 360,  'Tender pork belly rendered in its own fat until crisp and tossed in green chilies and lime',                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c87facb8-7c08-4b5f-df95-a41265ec7d00/public', 1, '[]'),
('cfc-tcfc-8',       'Crispy Bhendi Fry',                    'cat-appetizers', 235,  'Ladies finger batter fried to a crisp with spices',                                                                     'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/6dcca318-e73b-4d24-e8be-3b43f5f48c00/public', 1, '["vegetarian"]'),
('cfc-tcfc-30',      'Fat Lovers',                           'cat-appetizers', 260,  'Juicey 2 inch rib fat fried on all four sides',                                                                         'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b2b74e6d-6141-454c-d82a-6c9d6cd1e400/public', 1, '[]'),
('cfc-tcfc-25',      'Fish Cutlets',                         'cat-appetizers', 350,  'Fresh Mackerel fish flakes breaded & shallow fried',                                                                    NULL, 1, '[]'),
('cfc-tcfc-32',      'Jackfruit Cultlet',                    'cat-appetizers', 235,  'Crispy spiced raw jackfruit cutlets - vegan, gluten-free, and unbelievably ''meaty'' - with fresh mint chutney.',      NULL, 1, '["vegetarian"]'),
('cfc-tcfc-9',       'Kadle Palya',                          'cat-appetizers', 230,  'Steamed Black Channa seasoned in spices',                                                                               'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c7eaf039-5c89-4df3-216d-3d6d5e4ce500/public', 1, '["vegetarian"]'),
('cfc-tcfc-12',      'Kaima Unde Bharthad',                  'cat-appetizers', 347,  'Mutton meat ball fry tossed in curry leaves and chilly',                                                                'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/4ce32953-82c2-4937-7469-1cdee28ea400/public', 1, '[]'),
('cfc-tcfc-7',       'Kaipake Fry',                          'cat-appetizers', 210,  'Tangy Bitter Gourd fried seasoned with lime and chilly',                                                                'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/bac225d4-dea4-4ce5-c387-2c9cb4ba9b00/public', 1, '["vegetarian"]'),
('cfc-tcfc-1',       'Kodava Koli Bharthad',                 'cat-appetizers', 330,  'Succulent chicken fry slow cooked in traditional masala',                                                              'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/106c873a-4e58-45bd-09bc-f044d6cf9800/public', 1, '[]'),
('cfc-tcfc-33',      'Koli Bharthad Boneless',               'cat-appetizers', 345,  'Tender boneless chicken made with shade grown malabar pepper',                                                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/4ab4d192-0d21-429c-c998-8351d7bc0500/public', 1, '[]'),
('cfc-tcfc-4',       'Mix Veg Cutlets',                      'cat-appetizers', 235,  'Small patties made with a combination of Seasonal vegetables',                                                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/82a65be1-c7a7-468f-b4a4-b6927cd4fe00/public', 1, '["vegetarian"]'),
('cfc-tcfc-3-full',  'Mutton Chops (Full Portion)',           'cat-appetizers', 500,  'Succulent chops infused with the coorg masalas and kachumpuli',                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7283f651-8d37-441f-b328-0f258d23f000/public', 1, '[]'),
('cfc-tcfc-3-half',  'Mutton Chops (Half Portion)',           'cat-appetizers', 330,  'Succulent chops infused with the coorg masalas and kachumpuli',                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7283f651-8d37-441f-b328-0f258d23f000/public', 1, '[]'),
('cfc-tcfc-24',      'Mutton Cutlets',                       'cat-appetizers', 350,  'Tender lamb mince marinated overnight in mild spices & shallow fried',                                                 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7b42c10f-abc5-49ad-2e34-5a354915f800/public', 1, '[]'),
('cfc-tcfc-15',      'Mutton Pepper fry',                    'cat-appetizers', 438,  'Mutton roasted in fresh pepper sourced from our estates in coorg',                                                     'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/9f3d0530-4454-411f-bf5f-6b2231226900/public', 1, '[]'),
('cfc-tcfc-11',      'Onake Erachi (Spicy Smoked Pork)',      'cat-appetizers', 450,  'Traditional smoke dried pork',                                                                                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/59b86db1-f6a8-4f63-5af5-9f9fbc694d00/public', 1, '[]'),
('cfc-tcfc-5-half',  'Pandhi Bharthad',                      'cat-appetizers', 345,  'Slow cooked boneless pork fry in traditional black masala',                                                            'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b5801fad-d78a-4c5b-619c-4f7b43ebf100/public', 1, '[]'),
('cfc-tcfc-5-full',  'Pandhi Bharthad 1kg',                  'cat-appetizers', 1300, 'Slow cooked boneless pork fry in traditional black masala',                                                            'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b5801fad-d78a-4c5b-619c-4f7b43ebf100/public', 1, '[]'),
('cfc-tcfc-13-full', 'Pandhi Chops (Pork Chops) Full',       'cat-appetizers', 900,  'Traditionally inspired pork chops in a subtle blend of spices',                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/ac50d630-59f9-4e59-3830-230b9222fe00/public', 1, '[]'),
('cfc-tcfc-13-half', 'Pandhi Chops (Pork Chops) Half',       'cat-appetizers', 500,  'Traditionally inspired pork chops in a subtle blend of spices',                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/ac50d630-59f9-4e59-3830-230b9222fe00/public', 1, '[]'),
('cfc-tcfc-28',      'Pork Chilli Sausages',                 'cat-appetizers', 390,  'Classic pork pepper sausages made with shoulder meat and tossed in capsicum & onions',                               'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/50211fc1-8ca4-4cb9-049a-616b8b5d9d00/public', 1, '[]'),
('cfc-tcfc-16',      'Pork Wrap',                            'cat-appetizers', 350,  'Our signature black masala pork wrapped in mini Akki Ottis',                                                           'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/91df0ec1-bf55-4767-3183-3ef22abbc000/public', 1, '[]'),
('cfc-tcfc-22',      'Pork pepper fry',                      'cat-appetizers', 395,  'Juicy succulent bites tossed with robust pepper from our estates',                                                     'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/4b02f3be-fcae-4b1f-2cb6-389b7df82a00/public', 1, '[]'),
('cfc-tcfc-18',      'Pork pepper sausages',                 'cat-appetizers', 395,  'Our take on Bangalores favourite Pork Sausages',                                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/6797229c-3b90-49f1-0a93-8741dc1b0800/public', 1, '[]'),
('cfc-tcfc-31',      'Raw Banana Cutlet',                    'cat-appetizers', 235,  'A vegan gluten free cutlet made from tender raw banana mixed with mild spices & fried to a crisp',                    NULL, 1, '["vegetarian"]'),
('cfc-tcfc-10',      'Spicy Smoked Chicken',                 'cat-appetizers', 317,  'Smokey flavoured chicken in traditional spices',                                                                        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/a60c635f-b259-4d77-ffda-456b9c25ba00/public', 1, '[]'),
('cfc-tcfc-2',       'Thith Pandi (Fire pork)',              'cat-appetizers', 360,  'Extra spicy fire pork fry with birds eye chilly',                                                                      'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7786c858-1d00-4836-409c-e913e9627300/public', 1, '[]');

-- COMBO MEALS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-72', 'Baimbale Curry Combo',        'cat-combo-meals', 235, 'Puttus, Otti or Rice of your choice - serves One', NULL, 1, '["vegetarian"]'),
('cfc-tcfc-76', 'Erachi Curry Combo (Mutton)', 'cat-combo-meals', 330, 'Choose anyone Puttu / Rice of your choice',        NULL, 1, '[]'),
('cfc-tcfc-78', 'Kadle Curry Combo',           'cat-combo-meals', 260, 'Puttus, Otti or Rice of your choice - serves One', NULL, 1, '["vegetarian"]'),
('cfc-tcfc-77', 'Kaima Curry Combo',           'cat-combo-meals', 330, 'Choose any one puttu / Rice',                      NULL, 1, '[]'),
('cfc-tcfc-75', 'Koli Curry Combo (Chicken)',  'cat-combo-meals', 295, 'Choose anyone Puttu / Rice of your choice',        'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/db56f226-3fe7-4fc5-7eb5-017505302c00/public', 1, '[]'),
('cfc-tcfc-71', 'Kutu Curry Combo',            'cat-combo-meals', 260, 'Puttus, Otti or Rice of your choice - serves One', NULL, 1, '["vegetarian"]'),
('cfc-tcfc-73', 'Mutte Curry Combo',           'cat-combo-meals', 250, NULL,                                               NULL, 1, '[]'),
('cfc-tcfc-74', 'Pandi Curry Combo',           'cat-combo-meals', 335, 'Choose anyone Puttu / Rice of your choice',        NULL, 1, '[]');

-- COOLERS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-item-bottled-water', 'Bottled Water',      'cat-coolers', 90,  NULL,                                                            NULL, 1, '[]'),
('cfc-tcfc-59',            'Buttermilk',          'cat-coolers', 150, 'Traditional summer cooler with fresh herbs and spices',         NULL, 1, '["vegetarian"]'),
('cfc-tcfc-60',            'Kokum Juice',         'cat-coolers', 150, 'Refreshing and Healthy juice with antioxidant properties',      NULL, 1, '["vegetarian"]'),
('cfc-tcfc-57',            'Lemon Shock',         'cat-coolers', 150, 'A refresing bolt of lime and bird''s eye chilly',               NULL, 1, '["vegetarian"]'),
('cfc-tcfc-61',            'Masala Coke',         'cat-coolers', 90,  'Coca cola or Sprite spiced with a secret spice mix',            NULL, 1, '["vegetarian"]'),
('cfc-tcfc-56',            'Passion Fruit Fizz',  'cat-coolers', 150, 'A complex flavour of sweetness and zing',                       NULL, 1, '["vegetarian"]'),
('cfc-tcfc-58',            'Strawberry Lemonade', 'cat-coolers', 150, 'Strawberry and lemonade medley',                                NULL, 1, '["vegetarian"]');

-- CURRIES
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-49',      'Baimbale Curry (Bambooshoot)', 'cat-curries', 330, 'Seasonal dish - kindly check with us for availability',   'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/bf806173-ebe0-4b18-c779-5686df194800/public', 1, '["vegetarian"]'),
('cfc-tcfc-43',      'Erachi Curry',                 'cat-curries', 510, 'Flavourful Kodava mutton curry',                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/bf5c3c30-7523-4cc2-07ae-324b732ef200/public', 1, '[]'),
('cfc-tcfc-47',      'Kadle Curry (V)',               'cat-curries', 215, 'Black channa in coconut based gravy',                    'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b4d1a8b0-b2e6-4e31-3660-7652652a7000/public', 1, '["vegetarian"]'),
('cfc-tcfc-50-full', 'Kaima Curry (Full Portion)',    'cat-curries', 510, NULL,                                                     'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/36d2bff8-4df8-43a4-c1d0-7b6750142500/public', 1, '[]'),
('cfc-tcfc-50-half', 'Kaima Curry (Half Portion)',    'cat-curries', 395, NULL,                                                     'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/36d2bff8-4df8-43a4-c1d0-7b6750142500/public', 1, '[]'),
('cfc-tcfc-44',      'Kodava Koli Curry',             'cat-curries', 340, 'Chicken curry with a coconut gravy',                    'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b6a74efa-0de9-4855-c666-49a73f507500/public', 1, '[]'),
('cfc-tcfc-46',      'Kutu Curry (V)',                'cat-curries', 235, 'Mixed veg curry in mildly spiced coconut gravy',         'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/3e061897-95e5-40e1-7990-3a8719204200/public', 1, '["vegetarian"]'),
('cfc-tcfc-48',      'Mutte Curry',                   'cat-curries', 235, 'Egg curry in a light coconut gravy',                    'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/1acd198a-2d29-4368-c6de-2ee475982f00/public', 1, '[]'),
('cfc-tcfc-45',      'Pandhi Curry',                  'cat-curries', 328, 'Pork curry with the traditional black masala',          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/b2896eb3-2b7d-4987-ccc4-546e5f101400/public', 1, '[]');

-- DESSERTS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-55', 'Chocolate Browne',          'cat-desserts', 175, NULL,                                                                                                                              NULL, 1, '["vegetarian"]'),
('cfc-tcfc-51', 'Khus Khus Paysa',           'cat-desserts', 175, 'Kodava paysa made with poppy seeds and coconut',                                                                                 NULL, 1, '["vegetarian"]'),
('cfc-tcfc-54', 'Lazy Daisy Cake',           'cat-desserts', 175, NULL,                                                                                                                              NULL, 1, '["vegetarian"]'),
('cfc-tcfc-53', 'Seasonal Fruit Mascarpone', 'cat-desserts', 175, 'A layered dessert made with stewed fruit of the season - strawberries, mango, grape etc - mascarpone and a biscuit base',       NULL, 1, '["vegetarian"]'),
('cfc-tcfc-52', 'Tender Coconut Pudding',    'cat-desserts', 175, 'A unique pudding made with fresh tender coconut',                                                                                 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/a3405d10-7d63-43e4-1491-e869a9335300/public', 1, '["vegetarian"]');

-- OTTIS, PUTTUS AND RICE
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-37',        'Akki Otti',        'cat-ottis,-puttus-and-rice', 40,  'Traditional Rice Roti',                               'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/e0a0a699-08cb-4c66-1d5b-3b6e04a27e00/public', 1, '["vegetarian"]'),
('cfc-item-ghee-rice', 'Ghee Rice',        'cat-ottis,-puttus-and-rice', 225, NULL,                                                  'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/453e7f26-eb12-4c84-feec-33da58d36200/public', 1, '[]'),
('cfc-tcfc-35',        'Kadambuttu (8pcs)','cat-ottis,-puttus-and-rice', 120, 'Soft steamed rice dumplings',                         'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/58014e3e-6b86-4cba-aaa0-40b9fb51eb00/public', 1, '["vegetarian"]'),
('cfc-tcfc-42',        'Neer Dosa (4pcs)', 'cat-ottis,-puttus-and-rice', 120, NULL,                                                  'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/a3985906-d964-4ee6-cad7-396deefbf200/public', 1, '["vegetarian"]'),
('cfc-tcfc-36',        'Noolputtu (4pcs)', 'cat-ottis,-puttus-and-rice', 120, 'Rice string hoppers',                                 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/aa407851-1534-47b5-e57f-667b9d0d1000/public', 1, '["vegetarian"]'),
('cfc-tcfc-34',        'Paputtu (4pcs)',   'cat-ottis,-puttus-and-rice', 120, 'Steamed rice cakes flavoured with coconut and cardamom','https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/14242484-172b-4fbc-b734-f97da32ab200/public', 1, '["vegetarian"]'),
('cfc-tcfc-41',        'Sannas (4pcs)',    'cat-ottis,-puttus-and-rice', 120, 'Soft and spongy rice idilis',                          'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/8943e443-0f87-42e5-b160-03e4cb011100/public', 1, '["vegetarian"]'),
('cfc-tcfc-40',        'Steamed Rice',     'cat-ottis,-puttus-and-rice', 120, NULL,                                                   NULL, 1, '["vegetarian"]');

-- PICKLES
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-70', 'Bamboo Shoot Pickle', 'cat-pickles', 350, 'Seasonal bamboo shoot pickle with foraged bird''s eye chillies & zero preservatives',                                             NULL, 1, '["vegetarian"]'),
('cfc-tcfc-69', 'Pork Pickle',         'cat-pickles', 360, 'Traditional slow-cooked pork pickle from a 100-year-old recipe, made fresh daily with whole spices and zero preservatives',       NULL, 1, '[]'),
('cfc-tcfc-68', 'Prawn Pickle',        'cat-pickles', 380, 'Home-style spicy prawn pickle made fresh daily with whole roasted spices and cold-pressed oil - 100% preservative-free.',        NULL, 1, '[]');

-- PLATTERS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-19', 'Chicken Platter',     'cat-platters', 570, 'An assortment of all our Chicken starters',              'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/44bcdfa6-b291-4db2-e1db-9b72c76cc000/public', 1, '[]'),
('cfc-tcfc-21', 'Classic Meat Platter','cat-platters', 775, 'A variety of Chicken, Mutton, Pork starters',            NULL, 1, '[]'),
('cfc-tcfc-20', 'Cutlet Platter',      'cat-platters', 575, 'A variety of veg/Chicken/Mutton/Pork/Fish cutlets',      NULL, 1, '["vegetarian"]'),
('cfc-tcfc-17', 'Pork Lovers Platter', 'cat-platters', 770, 'An assortment of all our best pork starters',            'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/28499d4b-ffe9-469c-b834-a8b8e5e89500/public', 1, '[]'),
('cfc-tcfc-39', 'Puttu Platter',       'cat-platters', 215, 'A combination of puttus - noolputtu, paaputtu and kadambuttu', NULL, 1, '["vegetarian"]');

-- PULAVS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-64', 'Chicken Pulav', 'cat-pulavs', 290, 'An old recipe made with aromatic spices & served with pachadi',                      NULL, 1, '[]'),
('cfc-tcfc-66', 'Egg Pulav',     'cat-pulavs', 249, 'A classic egg pulav served with pachadi',                                             NULL, 1, '["vegetarian"]'),
('cfc-tcfc-67', 'Mutton Pulav',  'cat-pulavs', 389, 'Tender lamb slow cooked with mild spices in jeera samba rice & served with pachadi',  'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/5502aa33-bf2c-471f-cef1-30f49d467000/public', 1, '[]'),
('cfc-tcfc-65', 'Veg Pulav',     'cat-pulavs', 249, 'Crunchy veggies in an aromatic pulav & served with pachadi',                          NULL, 1, '["vegetarian"]');

-- SOUPS
INSERT OR IGNORE INTO menu_items (id, name, category_id, price, description, image_url, active, dietary_tags) VALUES
('cfc-tcfc-62', 'Malu Kanni',       'cat-soups', 105, 'A traditional drink made from shade grown pepper and 5 other robust spices and a tinge of Afghani hing', 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/4aac14f8-5daa-4fd4-2045-c22c562e6e00/public', 1, '["vegetarian"]'),
('cfc-tcfc-63', 'Mutton Paya soup', 'cat-soups', 213, 'Tender Mutton Trotters with a light spice seasoning',                                                      'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2dde4bbb-1ae9-4099-ceb6-8e64daedcd00/public', 1, '[]');
