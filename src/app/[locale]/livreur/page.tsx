import { getTranslations } from 'next-intl/server';

export default async function LivreurPage() {
  const t = await getTranslations('Auth');
  return <h1>{t('courierHome')}</h1>;
}