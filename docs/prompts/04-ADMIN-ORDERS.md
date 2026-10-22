# Task 04: Admin Orders (mum's console)
## Role
Dashboard builder. Mum is not technical: big buttons, French labels, few clicks.

## Pages
1. /admin/commandes: tabs A confirmer / En cours / Livrées / Annulées. Cards: order number, customer, total, payment badge (payé / non payé), mode icon, source icon, province badge. Realtime updates.
2. Order detail, with these buttons (each calls the SQL function from Task 01):
   - *Marquer payé* (optional reference note). Shows the customer's declared payer_name and mode next to it so mum can match her MVola/Orange SMS.
   - *Confirmer commande*: disabled unless the order is paid, or is Antananarivo cash.
   - *Assigner livreur* (dropdown): available once en_cours.
   - *Annuler* (required reason) and *Rejeter (spam)* (blocks the phone).
   - Event timeline from order_events.
3. Province orders (no livreur): after confirming, admin fills transport_info (bus/station/departure) and transport_url (location link), then taps *"Envoyer infos transport"*, which opens a pre-filled WhatsApp to the customer. Admin later marks the order *Livrée* manually when the customer confirms receipt.
4. /admin/commandes/nouvelle: manual order form for Facebook/WhatsApp/phone orders. Pick products, customer info, source, payment mode, paid/unpaid, optional livreur. It goes through create_order so stock is reserved, and it appears instantly in the livreur list when assigned.
5. *Cash attendu* list: all Antananarivo cash orders not yet paid, with amounts and total expected.
6. /admin/journal: livrées (with cash collected) and annulées (with reason), searchable.
7. /admin/dashboard: today's sales, orders en cours, unpaid total, cash expected, top 5 products, last 7 days chart.
8. *Clôture du jour*: per livreur, shows expected cash; mum types the cash actually received; the app stores and shows the difference (cash_closings).

## Done when
Mum takes a Facebook order, adds it as unpaid, marks it paid, confirms it, assigns the livreur, and sees it in the dashboard after delivery. Confirm on an unpaid mobile-money order is refused by the database, not only the UI.
