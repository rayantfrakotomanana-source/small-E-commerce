import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function AdminPage() {
  const t = await getTranslations('Auth');
  return <section className="admin-products"><h1>{t('adminHome')}</h1><Link className="button button-primary" href="/admin/produits">{t('products')}</Link></section>;
}