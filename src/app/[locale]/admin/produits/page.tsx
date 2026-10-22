import { requireRole } from '@/lib/auth/guards';
import { ProductManager } from './product-manager';

export default async function ProductsAdminPage({ params }: { params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  const { profile } = await requireRole(['admin', 'superadmin']);
  return <ProductManager locale={locale} isSuperadmin={profile.role === 'superadmin'} />;
}