import type { ReactNode } from 'react';
import { StaffLayout } from '../staff-layout';

export default async function LivreurLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  return <StaffLayout locale={locale} roles={['livreur']}>{children}</StaffLayout>;
}