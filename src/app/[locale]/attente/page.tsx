import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function PendingPage() {
  const t = await getTranslations('Auth');
  return <main className="auth-page"><section className="auth-panel"><p>{t('pending')}</p><Link href="/connexion">{t('login')}</Link></section></main>;
}