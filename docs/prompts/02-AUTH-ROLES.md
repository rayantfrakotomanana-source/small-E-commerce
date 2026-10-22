# Task 02: Auth and Roles
## Role
Security engineer. Lock data down with RLS and route guards.

## Tasks
1. Supabase Auth, email + password, staff only. No public signup.
2. Trigger: new auth user → profiles row (role livreur, inactive until superadmin activates).
3. RLS:
    - Sessions persist until explicit logout: use @supabase/ssr cookie sessions with automatic refresh-token renewal. In the Capacitor APK, persist the session too. Add a Logout button for every role.
- /inscription page: creates the account as role livreur, active = false ("pending"). The user cannot choose a role. Superadmin approves and sets the role in /superadmin/utilisateurs.
   - products, categories: public read (active, not deleted); write admin/superadmin
   - orders, order_items: admin/superadmin read all; livreur SELECT only where livreur_id = auth.uid(); NO direct INSERT/UPDATE/DELETE from the client for anyone, writes only via the SQL functions of Task 01
   - order_events: read admin/superadmin; insert via functions only
   - settings: public read of whatsapp_number, shop_name, delivery_fee_ar only; write superadmin
   - profiles: superadmin manages; users read own
   - blocked_phones, cash_closings: admin/superadmin only
4. Customer order creation and tracking use server route handlers with the service role key (server only).
5. Middleware: /admin/** → admin|superadmin, /livreur/** → livreur, /superadmin/** → superadmin. Redirect by role after login.
6. Superadmin page: create/disable users, change roles.

## Done when
Tests with 2 livreur accounts prove livreur A cannot read B's orders, anon cannot read orders, and a livreur cannot update an order's price or payment status directly.