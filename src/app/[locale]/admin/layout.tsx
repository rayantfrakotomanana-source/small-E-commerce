import type { ReactNode } from 'react';
import { StaffLayout } from '../staff-layout';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  return <StaffLayout locale={locale} roles={['admin', 'superadmin']}>{children}</StaffLayout>;
}