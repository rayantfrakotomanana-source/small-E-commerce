'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { madagascarPhoneSchema } from '@/lib/validation/phone';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  locale: z.enum(['fr', 'mg']),
});

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: madagascarPhoneSchema,
  email: z.email(),
  password: z.string().min(8).max(128),
  locale: z.enum(['fr', 'mg']),
});

export type AuthActionState = { message: string | null };

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'invalid' };
  const { email, password, locale } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { message: 'invalid' };
  const { data: profile } = await supabase.from('profiles')
    .select('role, active').eq('id', data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect(`/${locale}/attente`);
  }
  const destination = profile.role === 'superadmin' ? 'superadmin/utilisateurs'
    : profile.role === 'admin' ? 'admin' : 'livreur';
  redirect(`/${locale}/${destination}`);
}

export async function registerCourierAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'failed' };
  const { fullName, phone, email, password, locale } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone }, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${locale}/connexion` },
  });
  if (error) return { message: 'failed' };
  redirect(`/${locale}/attente?inscription=envoyee`);
}

export async function logoutAction(locale: 'fr' | 'mg') {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/connexion`);
}