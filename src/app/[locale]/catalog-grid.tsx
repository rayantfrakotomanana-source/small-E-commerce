'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog/data';
import { formatAr } from '@/lib/catalog/format';
import { whatsappHref } from '@/lib/catalog/whatsapp';
import { AddToCartButton, type CartProduct } from './cart-context';

export function CatalogGrid({
  categories,
  products,
  whatsappNumber,
  locale,
  page,
  totalPages,
  search: initialSearch,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  whatsappNumber: string;
  locale: 'fr' | 'mg';
  page: number;
  totalPages: number;
  search: string;
}) {
  const t = useTranslations('Catalog');
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    if (deferredSearch === initialSearch) return;
    const query = new URLSearchParams();
    if (deferredSearch) query.set('q', deferredSearch);
    router.replace(`${pathname}${query.size ? `?${query}` : ''}`, { scroll: false });
  }, [deferredSearch, initialSearch, pathname, router]);

  return <>
    <label className="catalog-search"><span>{t('search')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} /></label>
    {categories.map((category) => {
      const categoryProducts = products.filter((product) => product.category_id === category.id);
      const categoryName = locale === 'fr' ? category.name_fr : category.name_mg;
      return <section className="catalog-section" key={category.id} id={category.slug}>
        <div className="section-heading"><span>{category.kind === 'tech' ? '01' : '02'}</span><h2>{categoryName}</h2><i /></div>
        <div className="product-grid">{categoryProducts.map((product, index) => {
          const available = Math.max(product.stock - product.reserved, 0);
          const soldOut = product.is_sold_out || available < 1;
          const name = locale === 'fr' ? product.name_fr : product.name_mg;
          const image = product.images[0] ?? null;
          const cartProduct: CartProduct = { id: product.id, name, price: product.price_ar, image, available: soldOut ? 0 : available };
          return <article className={`product-card${soldOut ? ' is-sold-out' : ''}`} key={product.id} style={{ animationDelay: `${index * 45}ms` }}>
            <Link className="product-photo" href={`/produit/${product.id}`} aria-label={name}>
              {image ? <Image src={image} alt={name} fill sizes="(max-width: 650px) 46vw, (max-width: 1100px) 30vw, 22vw" loading="lazy" /> : <span className="photo-placeholder">JR</span>}
              {soldOut && <span className="sold-out-tag">{t('soldOut')}</span>}
            </Link>
            <div className="product-card-info">
              <p>{categoryName}</p><Link href={`/produit/${product.id}`}><h3>{name}</h3></Link>
              <strong>{formatAr(product.price_ar)}</strong>
              <div className="product-card-actions">
                <AddToCartButton product={cartProduct} label={t('add')} />
                {whatsappNumber && <a className="whatsapp-link" href={whatsappHref(whatsappNumber, name, product.price_ar, product.id, locale)} target="_blank" rel="noreferrer">{t('whatsapp')}</a>}
              </div>
            </div>
          </article>;
        })}</div>
      </section>;
    })}
    {products.length === 0 && <p className="no-results">{t('noResults')}</p>}
    {totalPages > 1 && <nav className="catalog-pagination" aria-label={t('pagination')}>
      {page > 1 ? <a href={`${locale === 'fr' ? '' : '/mg'}?${new URLSearchParams({ page: String(page - 1), ...(search ? { q: search } : {}) })}`}>{t('previous')}</a> : <span />}
      <span>{t('page', { current: page, total: totalPages })}</span>
      {page < totalPages ? <a href={`${locale === 'fr' ? '' : '/mg'}?${new URLSearchParams({ page: String(page + 1), ...(search ? { q: search } : {}) })}`}>{t('next')}</a> : <span />}
    </nav>}
  </>;
}