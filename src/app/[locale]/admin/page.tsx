import { getTranslations } from 'next-intl/server';

export default async function AdminPage() {
  const t = await getTranslations('Auth');
  return <h1>{t('adminHome')}</h1>;
}