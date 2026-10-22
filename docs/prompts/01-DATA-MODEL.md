# Task 01: Data Model
## Role
Database architect. Output: Supabase SQL migration(s) + generated TypeScript types.

## Enums
user_role (superadmin, admin, livreur), order_status (a_confirmer, en_cours, livree, annulee), payment_status (non_paye, paye), payment_mode (cash, mvola, orange), order_source (app, facebook, whatsapp, appel).

## Tables
- profiles (id → auth.users, full_name, phone, role, active)
- categories (id, slug, name_fr, name_mg, kind: tech|divers, sort)
- products (id, category_id, name_fr, name_mg, desc_fr, desc_mg, price_ar int, stock int, reserved int default 0, images text[], warranty_months int, is_sold_out, is_active, deleted_at, created_at)
- orders (id, order_number unique, public_token, source, customer_name, phone, phone2, address, landmark, note, is_province bool, city, transport_info, transport_url, items_total int, delivery_fee int, total int, status, payment_status, payment_mode, payer_name, payer_phone, payment_ref, livreur_id, cash_collected_ar, cash_handed_over bool, cancel_reason, is_spam bool, ip_hash, created_by, created_at, confirmed_at, paid_at, delivered_at)
  - total = items_total + delivery_fee (bus fee is never included)
- order_items (order_id, product_id, name_snapshot, unit_price, qty, image_snapshot text)
- order_events (id, order_id, actor_id, event, from_value, to_value, note, created_at)
- blocked_phones (phone pk, reason, created_at)
- cash_closings (id, day date, livreur_id, expected_ar, received_ar, difference_ar, note, created_by)
- settings (key pk, value jsonb): whatsapp_number, shop_name, nif, stat, delivery_fee_ar (5000), reservation_hours (24)

## SQL functions (SECURITY DEFINER, each checks the caller's role and writes order_events)
1. next_order_number() → JR-2026-0001, yearly sequence.
2. create_order(payload jsonb): validates, rejects blocked phones, rejects if the phone already has 3 orders in 24h, checks stock - reserved >= qty per item, increments reserved, inserts order + items with price snapshots, status a_confirmer / non_paye. Atomic.
3. mark_paid(order_id, ref text): payment_status → paye, sets paid_at. Admin only.
4. confirm_order(order_id): allowed only if payment_status = paye OR (payment_mode = cash AND is_province = false). Converts reservation: stock -= qty, reserved -= qty. status → en_cours.
5. assign_livreur(order_id, livreur_id): only when status = en_cours.
6. cancel_order(order_id, reason): before confirm: reserved -= qty; after confirm (not delivered): stock += qty. status → annulee.
7. reject_spam(order_id): cancel + is_spam + insert into blocked_phones.
8. livreur_set_outcome(order_id, outcome, reason, cash_collected): only for the livreur's own orders. livree → payment_status paye + delivered_at. injoignable/reporté → stays en_cours, event logged. refusé → cancel_order.
9. expire_unconfirmed_orders(): cancels orders a_confirmer older than reservation_hours, reason "expiré". Scheduled hourly (pg_cron).

## Seed
2 categories, settings with placeholder values (never real numbers in code).

## Indexes
orders(status, created_at), orders(livreur_id), orders(phone, created_at).

## Done when
Migration runs on a fresh Supabase project, types compile, and a SQL test proves: overselling is rejected, 4th order from one phone in 24h is rejected, confirm_order fails on an unpaid mobile-money order.