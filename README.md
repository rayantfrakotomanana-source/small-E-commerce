# JR Concept — Business Management System

JR Concept is an internal owner-only business management application built with Next.js, Supabase, and TypeScript. It replaces the previous e-commerce storefront and courier workflow.

## Modules

- Dashboard
- Inventory and stock movements
- Sales, partial payments, returns, and cancellations
- Expenses and categories
- Customer records and balances
- Financial summary and actual cash distinction
- Daily cash journal and discrepancy tracking
- Sales, expense, inventory CSV/JSON reports

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Set `SUPABASE_SERVICE_ROLE_KEY` only on trusted server infrastructure.
4. Apply Supabase migrations in filename order.
5. Create the owner account in Supabase Auth.
6. Add or activate its matching `profiles` row with `role = 'superadmin'` and `active = true`.
7. Run `npm install`.
8. Run `npm run typecheck`.
9. Run `npm run build`.
10. Run `npm run dev`.

Open `http://localhost:3000/login`.

## Security

Public registration, public storefront routes, courier accounts, and employee role management are not part of this application. The owner profile is the only authorized application role.
