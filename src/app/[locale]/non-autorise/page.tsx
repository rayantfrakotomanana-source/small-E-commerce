import { getTranslations } from 'next-intl/server';

export default async function ForbiddenPage() {
  const t = await getTranslations('Auth');
  return <main><p role="alert">{t('forbidden')}</p></main>;
}