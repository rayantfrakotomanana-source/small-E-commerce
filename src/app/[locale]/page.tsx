import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { getCatalog } from '@/lib/catalog/data';
import { CatalogGrid } from './catalog-grid';
import { CartTrigger } from './cart-context';

export const revalidate = 60;

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: 'fr' | 'mg' }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { locale } = await params;
  const parsed = z.object({ page: z.string().regex(/^\d{1,6}$/).optional(), q: z.string().max(80).optional() }).safeParse(await searchParams);
  const page = parsed.success ? Math.max(1, Number.parseInt(parsed.data.page ?? '1', 10)) : 1;
  const search = parsed.success ? (parsed.data.q ?? '') : '';
  const [{ categories, products, whatsappNumber, total }, t] = await Promise.all([getCatalog(page, search), getTranslations('Catalog')]);
  return <main className="storefront">
    <header className="store-header">
      <Link href="/" className="brand-lockup" aria-label="JR Concept"><span className="brand-monogram">JR</span><span><strong>JR CONCEPT</strong><small>{t('tagline')}</small></span></Link>
      <nav className="store-nav" aria-label={t('navigation')}>
        {categories.map((category) => <a href={`#${category.slug}`} key={category.id}>{locale === 'fr' ? category.name_fr : category.name_mg}</a>)}
      </nav>
      <div className="locale-switch" aria-label={t('language')}>
        <Link href="/" locale="fr" aria-current={locale === 'fr' ? 'page' : undefined}>FR</Link>
        <Link href="/" locale="mg" aria-current={locale === 'mg' ? 'page' : undefined}>MG</Link>
      </div>
    </header>
    <section className="store-intro">
      <p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('intro')}</p>
    </section>
    <div className="catalog-content"><CatalogGrid categories={categories} products={products} whatsappNumber={whatsappNumber} locale={locale} page={page} totalPages={Math.max(1, Math.ceil(total / 20))} search={search} /></div>
    <footer className="store-footer"><span>JR CONCEPT</span><span>{t('footer')}</span><Link href="/connexion">{t('staff')}</Link></footer>
    <CartTrigger />
  </main>;
}