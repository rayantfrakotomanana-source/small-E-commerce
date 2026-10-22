# Task 08: Notifications, APK and Free-Tier Safety
## Role
Mobile packaging + ops engineer.

## Push
1. Firebase Cloud Messaging + Capacitor push plugin. Table device_tokens (user_id, token, platform).
2. Triggers: new order → admin; order assigned → livreur; livreur outcome (livrée / annulée / injoignable) → admin.

## APK
1. Capacitor Android: app id mg.jrconcept.app, name "JR Concept", icon + splash from the logo, role-based landing (admin → /admin, livreur → /livreur).
2. Customers use the web store, not the APK.
3. Build a signed release APK and document the steps in README.

## Ops (Supabase free tier)
1. Scheduled ping every 3 days so the project never pauses.
2. Weekly automated database export (GitHub Action → private repo or Drive). Document how to restore.
3. Keep images under 150 KB. Document the 5 GB egress limit and the upgrade path.
4. Uptime check on the store URL (free monitor), alert to Rayan's email.

## Not now
Automatic SMS payment matching, official MVola/Orange API, WhatsApp Business API.

## Done when
Mum's phone buzzes on a test order, the APK installs and logs in with her account, and a restored backup works on a fresh project.