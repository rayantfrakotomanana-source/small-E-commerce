import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function AdminPage() {
  const t = await getTranslations('Auth');
  const orders = await getTranslations('Orders');
  return <section className="admin-products"><h1>{t('adminHome')}</h1><nav className="admin-home-links">
    <Link className="button button-primary" href="/admin/commandes">{orders('title')}</Link>
    <Link className="button button-secondary" href="/admin/dashboard">{orders('dashboard')}</Link>
    <Link className="button button-secondary" href="/admin/produits">{t('products')}</Link>
    <Link className="button button-quiet" href="/admin/cash-attendu">{orders('cashExpected')}</Link>
    <Link className="button button-quiet" href="/admin/journal">{orders('journal')}</Link>
  </nav></section>;
}