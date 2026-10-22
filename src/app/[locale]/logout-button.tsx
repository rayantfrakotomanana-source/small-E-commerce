'use client';

import { useTranslations } from 'next-intl';
import { logoutAction } from './auth-actions';

export function LogoutButton({ locale }: { locale: 'fr' | 'mg' }) {
  const t = useTranslations('Auth');
  return <form action={logoutAction.bind(null, locale)}><button type="submit">{t('logout')}</button></form>;
}