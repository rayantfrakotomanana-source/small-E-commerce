'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { madagascarPhoneSchema } from '@/lib/validation/phone';

const inviteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: madagascarPhoneSchema,
  email: z.email(),
  role: z.enum(['superadmin', 'admin', 'livreur']),
  locale: z.enum(['fr', 'mg']),
});

const profileSchema = z.object({
  id: z.uuid(),
  role: z.enum(['superadmin', 'admin', 'livreur']),
  active: z.enum(['true', 'false']).transform((value) => value === 'true'),
  locale: z.enum(['fr', 'mg']),
});

export async function inviteStaffUser(formData: FormData) {
  await requireRole(['superadmin']);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('Invalid staff invitation');
  const { fullName, phone, email, role, locale } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, phone },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${locale}/connexion`,
  });
  if (error || !data.user) throw new Error('Staff invitation failed');
  const { error: profileError } = await admin.from('profiles')
    .update({ role, active: true }).eq('id', data.user.id);
  if (profileError) throw new Error('Staff role assignment failed');
  revalidatePath(`/${locale}/superadmin/utilisateurs`);
}

export async function updateStaffProfile(formData: FormData) {
  await requireRole(['superadmin']);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('Invalid profile update');
  const { id, role, active, locale } = parsed.data;
  const admin = createAdminClient();
  const { data: target } = await admin.from('profiles').select('role, active').eq('id', id).maybeSingle();
  if (!target) throw new Error('Profile not found');
  if (target.role === 'superadmin' && target.active && (role !== 'superadmin' || !active)) {
    const { count, error: countError } = await admin.from('profiles')
      .select('id', { count: 'exact', head: true }).eq('role', 'superadmin').eq('active', true);
    if (countError || (count ?? 0) <= 1) throw new Error('Cannot disable the last active superadmin');
  }
  const { error } = await admin.from('profiles').update({ role, active }).eq('id', id);
  if (error) throw new Error('Profile update failed');
  revalidatePath(`/${locale}/superadmin/utilisateurs`);
}
