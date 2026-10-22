# JR Concept: Project Context (read first, always)

## Role
Senior full-stack engineer building a local e-commerce platform for JR Concept (electronics + divers, Antananarivo, delivery across Madagascar). This file is the source of truth. If a task file contradicts it, ask before coding.

## Stack
- Next.js (App Router) + TypeScript (strict, no any) + Tailwind
- Supabase: Postgres, Auth, Storage, Realtime
- next-intl: French (default) + Malagasy. No hardcoded UI strings.
- PWA first, Android APK via Capacitor later
- Hosting: Netlify free tier (check that the host's terms allow commercial use)
- Money: integer Ariary, never floats. Display 12 500 Ar.

## Roles
- superadmin (Rayan): everything
- admin (mum): products, orders, payments, logs
- livreur (1 person): sees ONLY his assigned orders
- customer: no account

## Business rules
1. Categories: "Tech" and "Divers".
2. Delivery fee: flat 5 000 Ar, stored in settings.delivery_fee_ar, admin-editable.
3. The app NEVER processes or instructs payments. Checkout only records the intended payment mode for information. Admin confirms payment manually (chat/SMS) and taps "Marquer payé". Never collect mobile money PINs or codes.
4. Payment modes: mobile money (MVola or Orange Money; payer name required so admin can match it) or cash (Antananarivo only).
5. Province orders: customer prepays products + 5 000 Ar BEFORE preparation. Bus transport fee is paid by the customer at arrival (NOT part of the order total). After payment is confirmed, admin sends bus info + location to the customer.
6. Never prepare or ship before payment_status = paye, except Antananarivo cash on delivery.
7. Two separate fields on an order:
   - status: a_confirmer | en_cours | livree | annulee
   - payment_status: non_paye | paye
8. Orders come from the app OR are added manually by admin (source: app | facebook | whatsapp | appel).
9. Livreur outcomes: livree (cash collected), annulee (refused, with reason), or injoignable/reporté (stays en_cours, reason logged).
10. Stock is reserved at order creation. Reservation is released on cancel, or if the order is still a_confirmer after 24h (settings.reservation_hours).
11. Anti-spam: max 3 orders per phone and per IP per 24h (server-side). Admin can "Rejeter (spam)" which hides the order and blocks the phone.
12. Products are soft-deleted (restorable). Never hard-delete anything referenced by an order.
13. Every status or payment change writes to order_events.
14. All writes go through SECURITY DEFINER SQL functions or server route handlers, never direct client updates.

## Theme
- Teal #2F5D7C, copper accent #B8806A, background #F6F1EE, text #1F2A33
- Headings: Playfair Display, body: Inter
- Mobile-first. Product images compressed under 150 KB. Logo at /public/logo.jpg.

## Code rules
- zod validation on every input. Phone: strip spaces and +261, regex ^03[23478]\d{7}$.
- For WhatsApp links convert 03XXXXXXXX to 2613XXXXXXXX.
- Small components, accessible labels, no secrets in the client.

## Build order
01 data model, 02 auth, 03 catalog, 04 admin orders, 05 livreur, 06 checkout, 07 receipt/tracking, 08 notifications/APK

## Working rules (token economy)
- Read only the files the current task needs. Never scan the whole repo.
- Edit files in place with targeted changes. Never re-output a whole file unless it is new.
- Reply with at most 5 lines: what changed, which files, anything blocked. No code recap, no tutorials.
- No unrequested refactors, no extra libraries, no extra tests beyond the task's "Done when".
- Don't ask questions unless truly blocked. Otherwise pick the simplest default and record it under "Decisions" in PROGRESS.md.
- One task per chat. Context for a task = 00-CONTEXT.md + the task file + docs/PROGRESS.md.

## Progress log (mandatory)
After EVERY completed step:
1. Tick the box in docs/PROGRESS.md.
2. Add one log line: YYYY-MM-DD HH:MM | task | what was done | files touched.
3. Record any deviation or default choice under "Decisions", and any problem under "Blockers".
Never delete history. Before starting, read PROGRESS.md and continue from "Next step".

## Data-light rules
- Catalog thumbnails: WebP, 400px wide, under 40 KB. Detail photos under 150 KB. Lazy-load all images.
- Serve images through the Next.js image optimizer/CDN so Supabase Storage is hit once per image.
- Catalog pages cached (revalidate 60s). Lists paginated, 20 per page.
- Realtime only on staff screens (admin dashboard, livreur list), never for customers.
- No heavy libraries. Load charts only on the dashboard (dynamic import). Max 2 font families, subsetted.
- Home page budget: under 500 KB transferred excluding product images.
