# Luma Petshop — PRD

## Original problem statement
Supabase kullanan bir petshop e-ticaret web app'i oluştur. Mobil öncelikli tasarım, ürün listeleme, kategori sayfaları, sepet sistemi, kullanıcı girişi. Supabase'te ürünler, sepet, siparişler tablolarını oluştur. Yönetici panelinde ürün ekleme ve siparişleri görme olsun.

v2 (final production readiness): stok gizleme, değerlendirmeler, çoklu fotoğraf (Supabase Storage), WhatsApp sipariş, favoriler + indirim bildirimi, sipariş e-postaları, iyzico altyapısı (pasif), gelişmiş sipariş yönetimi, gelişmiş yönetici paneli, güvenlik, mobil, yasal sayfalar, gerçek testler.

## Architecture
- FastAPI + SQLAlchemy async → Supabase Postgres (Alembic migrations: initial, enable_rls, v2_features). RLS enabled on all tables.
- Clerk (Emergent managed) email/password auth; roles admin/member; ADMIN_EMAIL=info@lumapetshop.com.tr
- Emails: Emergent managed (emails.py). Storage: Supabase Storage REST via httpx (storage.py), bucket product-images, Pillow → WEBP 1600px.
- iyzico Checkout Form (iyzico_pay.py) gated by IYZICO_API_KEY/IYZICO_SECRET_KEY (missing → disabled).
- Tables: users, products(images JSON, review_count), cart_items, orders(+payment_status, tracking, idempotency_key, stock_restored, iyzico fields), order_items, order_events, reviews, favorites, notifications, settings.

## Implemented
- 2026-06 MVP: catalog, categories, cart, checkout (cash/card on delivery), orders, admin CRUD + orders + roles.
- 2026-10 v2: everything in v2 list above. Backup: /app/backups/supabase_backup_20261030_160752.json
- Tests: iteration_1 (MVP), iteration_2 (v2, 14/15 → fixed), iteration_3 (18/18 + UI fixes).

- 2026-10 v3: online-only iyzico (orders blocked with 503 until IYZICO keys set), delivery adres (>=1000 free, else 200) / magaza (free), guest cart (localStorage + /api/cart/quote, merge on login) and guest checkout (access_token protected payment start), payment retry, admin 'Misafir' badge, texts/legal updated, floating WhatsApp button (905389493567, WHATSAPP_NUMBER env default), README + .env.example + vercel.json, .gitignore for .env/backups. Tests iteration_4 (17/17 + UI), iteration_5 (100%).
- Not possible: Clerk password policy (min 8 + uppercase) — managed Clerk instance stays min 15 until own Clerk account.

## Backlog
- P0 before launch: real business info in legal pages + legal review; iyzico keys; custom email domain; remove test orders/accounts
- P1: invoice/e-Arşiv integration, cargo API tracking links, guest checkout
- P2: coupons, stock-back-in alerts, SEO meta per product
