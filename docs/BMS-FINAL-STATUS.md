# JR Concept BMS — Transformation Status

Updated: 2026-11-19

## Completed

- Replaced the public JR Concept storefront with an English-only owner portal.
- Removed public checkout, cart, product-detail, WhatsApp ordering, courier, public registration, staff approval, and locale storefront routes.
- Added owner-only middleware and login page.
- Added BMS database tables for products, categories, customers, sales, sale items, payments, expenses, expense categories, stock movements, cash transactions, and cash snapshots.
- Added transactional PostgreSQL RPC functions for sale creation, cancellation/stock restoration, stock adjustment, and expense recording.
- Added owner-only RLS policies for all BMS tables.
- Added dashboard, inventory, sales, expenses, customers, finances, cash journal, and CSV/JSON reports pages.
- Added integer MGA money calculations, partial/unpaid sale support, low-stock indicators, purchase-cost valuation, and outstanding-customer calculations.
- Added a disposable-PostgreSQL BMS test that verifies sale stock deduction, cancellation restoration, and expense recording.
- Strict TypeScript check passes.
- Production build passes and generates all English BMS routes.

## Still Required Before Live Use

1. Create `.env.local` from `.env.example` and set the real Supabase URL and anon key.
2. Set `SUPABASE_SERVICE_ROLE_KEY` only on trusted server environments.
3. Apply all migrations to the Supabase project in timestamp order.
4. Create the first owner authentication user in Supabase.
5. Set that profile to `role = 'superadmin'` and `active = true`.
6. Seed real categories/products/customers as needed.
7. Run live login and create/edit product/sale/expense/cancellation tests.
8. Review and implement category CRUD management if the owner needs category names changed through the UI.
9. Review the Next 15 security advisories and plan a reviewed Next major upgrade before public deployment.

## Known Dependency State

- `npm run typecheck` passes.
- `npm run build` passes.
- npm reports Next/PostCSS advisories; the safe fix requires a reviewed Next major upgrade, not blind force installation.
- The old partial `node_modules` was preserved at `../Mum-project-node_modules-backup-20261022`.
- `package-lock.json` is present and should be committed after final review.

## Launch

1. Configure environment variables.
2. Run `npm install`.
3. Apply Supabase migrations.
4. Run `npm run dev`.
5. Open `http://localhost:3000/login`.
