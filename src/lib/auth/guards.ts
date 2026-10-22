import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type Role = Database['public']['Enums']['user_role'];
type ActiveStaff = {
  user: User;
  profile: { id: string; role: Role; active: true };
};

export async function getActiveStaff(): Promise<ActiveStaff | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !profile.active) return null;
  return { user, profile: { id: profile.id, role: profile.role as Role, active: true } };
}

export async function requireRole(allowed: Role[]) {
  const staff = await getActiveStaff();
  if (!staff) redirect('/connexion');
  if (!allowed.includes(staff.profile.role)) redirect('/non-autorise');
  return staff;
}