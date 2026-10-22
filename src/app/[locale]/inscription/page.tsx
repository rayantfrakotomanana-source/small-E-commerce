import { getTranslations } from 'next-intl/server';
import { RegisterCourierForm } from '../auth-forms';

export default async function RegisterPage({ params }: { params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  const t = await getTranslations('Auth');
  return <main><h1>{t('register')}</h1><RegisterCourierForm locale={locale} /></main>;
}