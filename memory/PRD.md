# Luma Petshop — PRD

## Original problem statement
Supabase kullanan bir petshop e-ticaret web app'i oluştur. Mobil öncelikli tasarım, ürün listeleme, kategori sayfaları, sepet sistemi, kullanıcı girişi. Supabase'te ürünler, sepet, siparişler tablolarını oluştur. Yönetici panelinde ürün ekleme ve siparişleri görme olsun.

## User choices
- Login: email + password (Emergent-managed Clerk, Turkish localization)
- Admin email: info@lumapetshop.com.tr (ADMIN_EMAIL; becomes admin on first sign-in with verified email)
- Supabase tables auto-created via Alembic migrations (DATABASE_URL = transaction pooler)
- Payment: skipped → cash / card on delivery only (no online payment)

## Architecture
- Backend: FastAPI + SQLAlchemy async (asyncpg) → Supabase Postgres. Alembic migrations in backend/alembic (initial schema + RLS enabled on all tables so Supabase public API can't read them).
- Tables: users (role/env), products, cart_items, orders, order_items. 12 seed products on empty DB.
- Frontend: React, mobile-first (bottom tab nav), Outfit + Plus Jakarta Sans, orange/green palette.

## Implemented (2026-06)
- Home (hero, categories, featured), category pages (Köpek/Kedi/Kuş/Balık/Kemirgen/Tümü) with search & sort, product detail
- Server-side cart (login required), shipping 49.90₺ (<500₺ free), checkout with address + kapıda nakit/kart, stock decrement with row lock
- My orders with status badges
- Admin panel: stats, product add/edit/delete, orders list with status filter + status update, users/roles page
- Tested: backend 23/23, frontend flows pass (iteration_1)

## Backlog
- P1: Online payment (iyzico/PayTR) — needs merchant keys
- P1: Product image upload (object storage) instead of URL
- P2: Guest cart merge on login, order email notifications, favorites, reviews
