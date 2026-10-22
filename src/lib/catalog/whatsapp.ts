export function whatsappHref(number: string, name: string, price: number, id: string, locale: 'fr' | 'mg') {
  const normalized = number.replace(/[\s+()-]/g, '').replace(/^0/, '261');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const link = `${appUrl}/${locale === 'fr' ? '' : 'mg/'}produit/${id}`;
  const amount = `${new Intl.NumberFormat('fr-FR').format(price)} Ar`;
  const message = locale === 'fr'
    ? `Bonjour JR Concept, je suis intéressé(e) par ${name} (${amount}). ${link}`
    : `Manao ahoana JR Concept, liana amin'ny ${name} (${amount}) aho. ${link}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}