import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { StaffLayout } from '../staff-layout';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  const t = await getTranslations('Orders');
  const products = await getTranslations('Auth');
  return <StaffLayout locale={locale} roles={['admin', 'superadmin']}><nav className="admin-nav" aria-label={t('dashboard')}>
    <Link href="/admin/commandes">{t('title')}</Link><Link href="/admin/commandes/nouvelle">{t('manualTitle')}</Link>
    <Link href="/admin/dashboard">{t('dashboard')}</Link><Link href="/admin/cash-attendu">{t('cashExpected')}</Link>
    <Link href="/admin/journal">{t('journal')}</Link><Link href="/admin/produits">{products('products')}</Link>
  </nav>{children}</StaffLayout>;
}