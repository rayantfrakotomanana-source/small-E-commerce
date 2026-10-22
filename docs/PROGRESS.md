# JR Concept: Progress

## Next step
Task 05: build livreur workflows.

## Status
- [x] 01 Data model
  - [x] enums and tables
  - [x] SQL functions (create_order, mark_paid, confirm_order, assign_livreur, cancel_order, reject_spam, livreur_set_outcome, expire_unconfirmed_orders)
  - [x] seed + indexes
  - [x] SQL tests (overselling, 3 orders/24h, confirm on unpaid)
- [x] 02 Auth and roles
  - [x] Auth + profiles trigger
  - [x] RLS policies
  - [x] route middleware
  - [x] superadmin user page
  - [x] role isolation tests
- [x] 03 Catalog
  - [x] Home + product page
  - [x] WhatsApp order button
  - [x] cart
  - [x] admin product CRUD + image compression
  - [x] soft delete + trash
- [x] 04 Admin orders
  - [x] order list + detail actions
  - [x] manual order form
  - [x] province transport flow
  - [x] cash attendu list
  - [x] journal + dashboard
  - [x] daily cash closing
- [ ] 05 Livreur
  - [ ] assigned list
  - [ ] Livré / Non livré flow
  - [ ] cash à remettre
  - [ ] offline retry
- [ ] 06 Checkout
  - [ ] form + payment mode toggle
  - [ ] create_order integration + limits
  - [ ] WhatsApp pre-filled message
  - [ ] confirmation page
- [ ] 07 tracking
  - [ ] tracking page + warranty dates
- [ ] 08 Notifications, APK, ops
  - [ ] push notifications
  - [ ] Capacitor APK
  - [ ] keep-alive ping + weekly backup + uptime check

## Log
(YYYY-MM-DD HH:MM | task | what was done | files touched)
2026-10-22 08:53 | Task 01 | Added data model migration, typed database API, and passing SQL behavior tests | supabase/migrations/20261022000100_data_model.sql, supabase/tests/01_data_model.sql, src/lib/database.types.ts, docs/PROGRESS.md
2026-10-22 09:30 | Task 02 | Added pending courier profile trigger, role-scoped RLS, and passing isolation tests | supabase/migrations/20261022000200_auth_roles.sql, supabase/tests/02_auth_roles.sql
2026-10-22 09:35 | Task 02 | Added cookie-based staff auth, courier signup/approval, guarded routes, and service-only order APIs; combined SQL tests pass | src/app, src/lib, src/i18n, src/middleware.ts, messages, package.json, tsconfig.json, next.config.ts, supabase/migrations/20261022000200_auth_roles.sql, supabase/tests/02_auth_roles.sql, README.md, .env.example, .gitignore, docs/PROGRESS.md
2026-10-22 23:02 | Task 03 | Added public catalog, localized product details and WhatsApp links, local cart, secured product management, compressed Storage uploads, trash/restore, and pagination | src/app, src/lib/catalog, src/app/api/admin/products/route.ts, messages, next.config.ts, supabase/migrations/20261022000300_catalog_storage.sql, docs/PROGRESS.md
2026-10-22 23:40 | Task 04 | Added order board/detail actions, manual orders, province transport, cash expected/closing, journal, dashboard, RPC migration, and passing SQL workflow tests | src/app, src/lib, messages, supabase/migrations/20261022000400_admin_orders.sql, supabase/tests/04_admin_orders.sql, docs/PROGRESS.md

## Decisions
(deviations from the prompts or defaults chosen)
For Task 01, initially used the supplied context attachment after the shorter docs/prompts/00-CONTEXT.md path failed; the source file is docs/prompts/.github/copilot-instructions.md/00-CONTEXT.md. Generated UUID public tokens and required a server-computed app IP hash.
Task 02 uses self-service email/password signup for pending couriers; superadmin staff creation uses email invitations. Browser table mutations are denied and staff changes use guarded server actions.
French is the unprefixed default locale so `/inscription` works directly. Order creation and tracking use server-only service-role handlers; IP throttling uses an HMAC of the trusted ingress IP header. Initial superadmin promotion is documented as a one-time SQL bootstrap.
Task 03 uses a public `products` Storage bucket restricted to WebP files under 150 KB; the existing logo asset is absent, so the storefront uses a text monogram until one is supplied.
Task 04 adds small SECURITY DEFINER wrappers for manual order creation, transport details, manual province delivery, and cash closing; existing Task 01 transition functions remain unchanged. Realtime is enabled for `orders` only when the Supabase publication exists.

## Blockers
(anything waiting on Rayan, mum, or an external account)
Full Next.js typecheck/build is blocked because npm registry requests time out; no compiler could be installed in this environment.
Task 03 browser/runtime validation is also blocked because Next.js dependencies and Supabase environment credentials are unavailable; SQL migration and prior SQL behavior suites passed on a disposable Postgres cluster.
Fix later: retry `npm install` on a stable network from the project root; then run `npm run typecheck` and `npm run build`. Copy `.env.example` to `.env.local`, set the Supabase project URL, anon key, server-only service-role key, trusted proxy IP header, and app URL; apply migrations in order to the Supabase project and run the SQL tests. Configure the app URL/email redirect allowlist in Supabase Auth before testing signup and orders. Do not commit `.env.local` or expose the service-role key. Task 04's full frontend type diagnostics and browser workflow need that install/config; its SQL migrations and workflow assertions passed locally.