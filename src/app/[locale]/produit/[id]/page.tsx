import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { getCatalogProduct } from '@/lib/catalog/data';
import { formatAr } from '@/lib/catalog/format';
import { whatsappHref } from '@/lib/catalog/whatsapp';
import { CartTrigger, ProductQuantityAdd, type CartProduct } from '../../cart-context';
import { ProductGallery } from './product-gallery';

export const revalidate = 60;

export default async function ProductPage({ params }: { params: Promise<{ id: string; locale: 'fr' | 'mg' }> }) {
  const { id, locale } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ product, category, whatsappNumber }, t] = await Promise.all([
    getCatalogProduct(id), getTranslations('Catalog'),
  ]);
  if (!product) notFound();
  const name = locale === 'fr' ? product.name_fr : product.name_mg;
  const description = locale === 'fr' ? product.desc_fr : product.desc_mg;
  const available = Math.max(0, product.stock - product.reserved);
  const soldOut = product.is_sold_out || available < 1;
  const cartProduct: CartProduct = { id: product.id, name, price: product.price_ar, image: product.images[0] ?? null, available: soldOut ? 0 : available };
  return <main className="storefront product-page">
    <header className="store-header"><Link href="/" className="brand-lockup"><span className="brand-monogram">JR</span><span><strong>JR CONCEPT</strong><small>{t('tagline')}</small></span></Link><Link className="back-link" href="/">{t('backToCatalog')}</Link><CartTrigger /></header>
    <div className="product-detail">
      <ProductGallery images={product.images} name={name} />
      <section className="product-description">
        <p className="eyebrow">{locale === 'fr' ? category?.name_fr : category?.name_mg}</p>
        <h1>{name}</h1><p className="detail-price">{formatAr(product.price_ar)}</p>
        <p className="detail-copy">{description || t('noDescription')}</p>
        <dl className="product-facts"><div><dt>{t('availability')}</dt><dd>{soldOut ? t('soldOut') : t('available')}</dd></div>
          <div><dt>{t('warranty')}</dt><dd>{product.warranty_months ? t('warrantyMonths', { count: product.warranty_months }) : t('noWarranty')}</dd></div></dl>
        <div className="detail-actions"><ProductQuantityAdd product={cartProduct} label={t('add')} quantityLabel={t('quantity')} />
          {whatsappNumber && <a className="button button-secondary" href={whatsappHref(whatsappNumber, name, product.price_ar, product.id, locale)} target="_blank" rel="noreferrer">{t('whatsapp')}</a>}
        </div>
      </section>
    </div>
  </main>;
}