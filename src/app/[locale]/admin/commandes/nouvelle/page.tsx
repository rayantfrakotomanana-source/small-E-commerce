import { ManualOrderForm } from './manual-order-form';

export default async function NewOrderPage({ params }: { params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  return <ManualOrderForm locale={locale} />;
}