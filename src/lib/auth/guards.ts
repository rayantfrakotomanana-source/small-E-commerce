import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type Role = Database['public']['Enums']['user_role'];

export async function getActiveStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.active) return null;
  return { user, profile };
}

export async function requireRole(allowed: Role[]) {
  const staff = await getActiveStaff();
  if (!staff) redirect('/connexion');
  if (!allowed.includes(staff.profile.role)) redirect('/non-autorise');
  return staff;
}