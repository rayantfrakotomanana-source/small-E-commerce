# Task 06: Checkout and WhatsApp
## Role
Checkout engineer. Reliability and anti-spam matter more than looks.

## Form
Nom complet, Téléphone, 2e téléphone (optional), Adresse / quartier, Repère, Note (optional), *Province toggle* (reveals Ville + note about bus fee paid at arrival), *Mode de paiement* toggle:
- *Mobile money*: choose MVola or Orange Money + required *"Nom du compte qui enverra l'argent"* (+ optional number)
- *Cash à la livraison*: Antananarivo only, hidden when Province is on

## Totals
products + 5 000 Ar (settings.delivery_fee_ar). Province shows "Frais de bus à payer à l'arrivée (non inclus)".

## Submit: button "Valider la commande"
1. Server route handler, zod validation, idempotency key against double submit.
2. Re-fetch prices and stock from the DB (never trust the client). Call create_order. Show friendly errors for: out of stock, 3 orders in 24h, blocked phone.
3. Store ip_hash, rate limit per IP (max 3 orders / 24h).
4. On success: push notification to admin, then open WhatsApp:
   https://wa.me/<whatsapp_number>?text=<encodeURIComponent(message)>
   Message (French): order number, items with quantities, total, name, address + repère, phone, payment mode, payer name.
5. Confirmation page /commande/[order_number]: order number, summary, "Nous vous contacterons sur WhatsApp pour le paiement", a button to reopen WhatsApp (in case the customer did not press Send), link to tracking.
6. The order is saved BEFORE WhatsApp opens, so nothing is lost if the customer never sends the message.

## Out of scope
Payment instructions, copy-number buttons, transaction IDs, any PIN or secret code field.

## Done when
A test order from a phone lands in the DB with stock reserved, admin is notified, WhatsApp opens pre-filled, a 4th order in 24h is rejected, and a bad phone number is rejected.