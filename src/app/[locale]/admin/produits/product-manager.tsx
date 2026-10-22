'use client';

import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalog/data';

type ProductForm = {
  id?: string;
  category_id: string;
  name_fr: string;
  name_mg: string;
  desc_fr: string;
  desc_mg: string;
  price_ar: string;
  stock: string;
  warranty_months: string;
  images: string[];
};

const emptyForm: ProductForm = {
  category_id: '', name_fr: '', name_mg: '', desc_fr: '', desc_mg: '',
  price_ar: '', stock: '', warranty_months: '0', images: [],
};

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image compression unavailable');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46, 0.36]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= 153600) return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  }
  throw new Error('imageTooLarge');
}

export function ProductManager({ locale, isSuperadmin }: { locale: 'fr' | 'mg'; isSuperadmin: boolean }) {
  const t = useTranslations('CatalogAdmin');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trash, setTrash] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const deferredSearch = useDeferredValue(search);

  async function refresh() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (trash) params.set('trash', '1');
    if (deferredSearch.trim()) params.set('search', deferredSearch.trim());
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    const response = await fetch(`/api/admin/products?${params}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json() as { products: CatalogProduct[]; categories: CatalogCategory[]; total: number };
      setProducts(data.products);
      setCategories(data.categories);
      setTotal(data.total);
      setForm((current) => current.category_id || !data.categories[0] ? current : { ...current, category_id: data.categories[0].id });
    } else setMessage(t('loadFailed'));
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, [trash, page, deferredSearch, categoryFilter]);

  function editProduct(product: CatalogProduct) {
    setForm({
      id: product.id, category_id: product.category_id, name_fr: product.name_fr,
      name_mg: product.name_mg, desc_fr: product.desc_fr, desc_mg: product.desc_mg,
      price_ar: String(product.price_ar), stock: String(product.stock),
      warranty_months: String(product.warranty_months), images: product.images,
    });
    setFiles([]);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const compressed = await Promise.all(files.map(compressImage));
      const body = new FormData();
      body.set('product', JSON.stringify({
        ...form, price_ar: Number(form.price_ar), stock: Number(form.stock), warranty_months: Number(form.warranty_months),
      }));
      compressed.forEach((file) => body.append('images', file));
      const response = await fetch('/api/admin/products', { method: 'POST', body });
      if (!response.ok) throw new Error(response.status === 413 ? 'imageTooLarge' : 'saveFailed');
      setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' });
      setFiles([]);
      setMessage(t('saved'));
      await refresh();
    } catch (error) {
      setMessage(t(error instanceof Error && error.message === 'imageTooLarge' ? 'imageTooLarge' : 'saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string, id: string, extra: Record<string, number> = {}) {
    setBusy(true);
    const response = await fetch('/api/admin/products', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }),
    });
    setMessage(response.ok ? '' : t('actionFailed'));
    await refresh();
    setBusy(false);
  }

  async function updateInventory(event: FormEvent<HTMLFormElement>, product: CatalogProduct) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction('inventory', product.id, { price_ar: Number(data.get('price_ar')), stock: Number(data.get('stock')) });
  }

  return <div className="admin-products">
    <div className="admin-product-heading"><div><p className="eyebrow">JR CONCEPT / {t('eyebrow')}</p><h1>{t('title')}</h1></div>
      <button type="button" className={trash ? 'button button-secondary' : 'button button-quiet'} onClick={() => { setPage(1); setTrash((value) => !value); }}>{trash ? t('backToProducts') : t('trash')}</button>
    </div>
    {!trash && <form className="product-editor" onSubmit={saveProduct}>
      <div className="editor-head"><h2>{form.id ? t('editProduct') : t('newProduct')}</h2>{form.id && <button className="text-button" type="button" onClick={() => { setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' }); setFiles([]); }}>{t('cancel')}</button>}</div>
      <label>{t('category')}<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
        <option value="">{t('selectCategory')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{locale === 'fr' ? category.name_fr : category.name_mg}</option>)}
      </select></label>
      <div className="editor-grid">
        <label>{t('nameFr')}<input required maxLength={160} value={form.name_fr} onChange={(event) => setForm({ ...form, name_fr: event.target.value })} /></label>
        <label>{t('nameMg')}<input required maxLength={160} value={form.name_mg} onChange={(event) => setForm({ ...form, name_mg: event.target.value })} /></label>
        <label>{t('descriptionFr')}<textarea rows={3} value={form.desc_fr} onChange={(event) => setForm({ ...form, desc_fr: event.target.value })} /></label>
        <label>{t('descriptionMg')}<textarea rows={3} value={form.desc_mg} onChange={(event) => setForm({ ...form, desc_mg: event.target.value })} /></label>
        <label>{t('price')}<input type="number" min="0" step="1" required value={form.price_ar} onChange={(event) => setForm({ ...form, price_ar: event.target.value })} /></label>
        <label>{t('stock')}<input type="number" min="0" step="1" required value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
        <label>{t('warranty')}<input type="number" min="0" max="120" step="1" required value={form.warranty_months} onChange={(event) => setForm({ ...form, warranty_months: event.target.value })} /></label>
        <label className="file-control">{t('photos')}<input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><small>{t('photoHint')}</small></label>
      </div>
      {(form.images.length > 0 || files.length > 0) && <div className="editor-images">
        {form.images.map((image, index) => <div className="editor-image" key={`${image}-${index}`}>
          <Image src={image} alt="" width={72} height={72} sizes="72px" />
          <button type="button" aria-label={t('removePhoto')} onClick={() => setForm({ ...form, images: form.images.filter((_, imageIndex) => imageIndex !== index) })}>×</button>
        </div>)}
        {files.map((file, index) => <div className="editor-file" key={`${file.name}-${index}`}>{file.name}</div>)}
        <p className="image-count">{t('photoCount', { count: form.images.length + files.length })}</p>
      </div>}
      {message && <p role="status" className="form-message">{message}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{form.id ? t('save') : t('create')}</button>
    </form>}

    <section className="product-list-section">
      <div className="product-list-tools"><label>{t('search')}<input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} /></label>
        <label>{t('category')}<select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }}>
          <option value="all">{t('allCategories')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{locale === 'fr' ? category.name_fr : category.name_mg}</option>)}
        </select></label>
      </div>
      {loading ? <p>{t('loading')}</p> : <div className="admin-product-list">{products.map((product) => {
        const available = product.stock - product.reserved;
        const category = categories.find((item) => item.id === product.category_id);
        return <article className="admin-product-row" key={product.id}>
          {product.images[0] ? <Image src={product.images[0]} alt="" width={80} height={80} sizes="80px" /> : <span className="admin-photo-placeholder">JR</span>}
          <div className="admin-product-name"><strong>{locale === 'fr' ? product.name_fr : product.name_mg}</strong><small>{locale === 'fr' ? category?.name_fr : category?.name_mg} · {t('availableStock', { count: available })}</small></div>
          {!trash && <form className="inline-inventory" onSubmit={(event) => updateInventory(event, product)}>
            <label>{t('price')}<input name="price_ar" type="number" min="0" defaultValue={product.price_ar} /></label>
            <label>{t('stock')}<input name="stock" type="number" min="0" defaultValue={product.stock} /></label>
            <button type="submit" className="text-button" disabled={busy}>{t('save')}</button>
          </form>}
          <div className="admin-row-actions">
            {trash ? <><button type="button" className="text-button" disabled={busy} onClick={() => void runAction('restore', product.id)}>{t('restore')}</button>
              {isSuperadmin && <button type="button" className="danger-button" disabled={busy} onClick={() => window.confirm(t('confirmDelete')) && void runAction('hardDelete', product.id)}>{t('deletePermanently')}</button>}</>
              : <><button type="button" className="text-button" disabled={busy} onClick={() => void runAction('soldOut', product.id)}>{product.is_sold_out ? t('markAvailable') : t('markSoldOut')}</button>
                <button type="button" className="text-button" onClick={() => editProduct(product)}>{t('edit')}</button>
                <button type="button" className="danger-button" disabled={busy} onClick={() => void runAction('delete', product.id)}>{t('moveToTrash')}</button></>}
          </div>
        </article>;
      })}{!products.length && <p>{t('noProducts')}</p>}</div>}
      {Math.ceil(total / 20) > 1 && <nav className="catalog-pagination" aria-label={t('pagination')}>
        {page > 1 ? <button type="button" onClick={() => setPage((value) => value - 1)}>{t('previous')}</button> : <span />}
        <span>{t('page', { current: page, total: Math.ceil(total / 20) })}</span>
        {page < Math.ceil(total / 20) ? <button type="button" onClick={() => setPage((value) => value + 1)}>{t('next')}</button> : <span />}
      </nav>}
    </section>
  </div>;
}