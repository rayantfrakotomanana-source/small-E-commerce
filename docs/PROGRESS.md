# JR Concept: Progress

## Next step
Task 03: build the catalog.

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
- [ ] 03 Catalog
  - [ ] Home + product page
  - [ ] WhatsApp order button
  - [ ] cart
  - [ ] admin product CRUD + image compression
  - [ ] soft delete + trash
- [ ] 04 Admin orders
  - [ ] order list + detail actions
  - [ ] manual order form
  - [ ] province transport flow
  - [ ] cash attendu list
  - [ ] journal + dashboard
  - [ ] daily cash closing
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

## Decisions
(deviations from the prompts or defaults chosen)
For Task 01, initially used the supplied context attachment after the shorter docs/prompts/00-CONTEXT.md path failed; the source file is docs/prompts/.github/copilot-instructions.md/00-CONTEXT.md. Generated UUID public tokens and required a server-computed app IP hash.
Task 02 uses self-service email/password signup for pending couriers; superadmin staff creation uses email invitations. Browser table mutations are denied and staff changes use guarded server actions.
French is the unprefixed default locale so `/inscription` works directly. Order creation and tracking use server-only service-role handlers; IP throttling uses an HMAC of the trusted ingress IP header. Initial superadmin promotion is documented as a one-time SQL bootstrap.

## Blockers
(anything waiting on Rayan, mum, or an external account)
Full Next.js typecheck/build is blocked because npm registry requests time out; no compiler could be installed in this environment.