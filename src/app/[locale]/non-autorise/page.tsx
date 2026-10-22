import { getTranslations } from 'next-intl/server';

export default async function ForbiddenPage() {
  const t = await getTranslations('Auth');
  return <main className="auth-page"><section className="auth-panel"><p role="alert">{t('forbidden')}</p></section></main>;
}