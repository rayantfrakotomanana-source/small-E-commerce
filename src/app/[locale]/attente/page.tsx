import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function PendingPage() {
  const t = await getTranslations('Auth');
  return <main><p>{t('pending')}</p><Link href="/connexion">{t('login')}</Link></main>;
}