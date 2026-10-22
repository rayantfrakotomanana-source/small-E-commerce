# small-E-commerce

JR Concept staff authentication and role-based access control.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase URL, anon key, and server-only service role key.
3. Apply the SQL files in `supabase/migrations` in order.
4. Start the app with `npm run dev`.

Supabase email/password authentication must be enabled. Configure the application URL and email redirect allowlist in Supabase Auth. `/inscription` creates pending livreur accounts; approve and assign staff roles under `/superadmin/utilisateurs`.

On Netlify, IP throttling reads `x-nf-client-connection-ip`; on another host, set `TRUSTED_CLIENT_IP_HEADER` to a header the trusted ingress overwrites. Never use a client-controlled forwarding header without proxy sanitization. Promote the first trusted account once through the Supabase SQL editor after signing up: `UPDATE public.profiles SET role = 'superadmin', active = true WHERE id = '<auth-user-uuid>';`.

Run the database behavior checks against a fresh Supabase test database with the SQL files in `supabase/tests`.