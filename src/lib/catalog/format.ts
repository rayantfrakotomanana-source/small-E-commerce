export function formatAr(value: number) {
  return `${new Intl.NumberFormat('fr-FR').format(value)} Ar`;
}