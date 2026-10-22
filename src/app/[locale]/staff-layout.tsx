import type { ReactNode } from 'react';
import type { Database } from '@/lib/database.types';
import { requireRole } from '@/lib/auth/guards';
import { LogoutButton } from './logout-button';

type Role = Database['public']['Enums']['user_role'];

export async function StaffLayout({
  children,
  locale,
  roles,
}: {
  children: ReactNode;
  locale: 'fr' | 'mg';
  roles: Role[];
}) {
  await requireRole(roles);
  return <><header className="staff-topbar"><LogoutButton locale={locale} /></header><main>{children}</main></>;
}