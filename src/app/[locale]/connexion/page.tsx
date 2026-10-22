import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LoginForm } from '../auth-forms';

export default async function LoginPage({ params }: { params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  const t = await getTranslations('Auth');
  return <main className="auth-page"><section className="auth-panel"><h1>{t('login')}</h1><LoginForm locale={locale} /><Link href="/inscription">{t('register')}</Link></section></main>;
}