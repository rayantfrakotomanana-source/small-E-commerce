# Task 05: Livreur View
## Role
Mobile UX engineer. One-handed use, big tap targets, works on slow 3G.

## Page /livreur
1. List of his assigned orders with status en_cours. Card: number, customer name, phone, address + landmark, *amount to collect* (0 if already paid), payment badge.
2. Buttons: *Appeler* (tel:), *Itinéraire* (Google Maps search link from address), *Livré*, *Non livré*.
3. *Livré*: modal with amount collected (prefilled with the amount due, locked to 0 if already paid) → calls livreur_set_outcome(livree).
4. *Non livré*: required reason:
   - Injoignable or Reporté → stays en_cours, reason logged, admin notified
   - Refusé → order cancelled, stock released
5. Header: "Cash à remettre aujourd'hui: X Ar".
6. Optimistic UI with a retry queue when the connection drops. Realtime: newly assigned orders appear without refresh.
7. He can only call livreur_set_outcome; he cannot edit anything else.

## Done when
He completes a delivery in 2 taps and the admin dashboard and Cash attendu list update live.