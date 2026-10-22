'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, registerCourierAction, type AuthActionState } from './auth-actions';

const initialState: AuthActionState = { message: null };

export function LoginForm({ locale }: { locale: 'fr' | 'mg' }) {
  const t = useTranslations('Auth');
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <label>{t('email')}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t('password')}<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      {state.message && <p role="alert">{t(state.message)}</p>}
      <button type="submit" disabled={pending}>{pending ? '…' : t('login')}</button>
    </form>
  );
}

export function RegisterCourierForm({ locale }: { locale: 'fr' | 'mg' }) {
  const t = useTranslations('Auth');
  const [state, action, pending] = useActionState(registerCourierAction, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <label>{t('fullName')}<input name="fullName" autoComplete="name" maxLength={120} required /></label>
      <label>{t('phone')}<input name="phone" type="tel" autoComplete="tel" pattern="03[23478][0-9]{7}" required /></label>
      <label>{t('email')}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t('password')}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      {state.message && <p role="alert">{t(state.message)}</p>}
      <button type="submit" disabled={pending}>{pending ? '…' : t('register')}</button>
    </form>
  );
}