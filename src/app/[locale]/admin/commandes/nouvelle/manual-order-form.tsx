'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { formatAr } from '@/lib/catalog/format';

type Product = { id: string; name_fr: string; price_ar: number; available: number; is_sold_out: boolean };
type Courier = { id: string; full_name: string; phone: string | null };
type Line = { product_id: string; qty: number };

export function ManualOrderForm({ locale }: { locale: 'fr' | 'mg' }) {
  const t = useTranslations('Orders');
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [fee, setFee] = useState(5000);
  const [lines, setLines] = useState<Line[]>([{ product_id: '', qty: 1 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isProvince, setIsProvince] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'mvola' | 'orange'>('cash');

  useEffect(() => {
    void fetch('/api/admin/orders/options', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('options');
      const data = await response.json() as { products: Product[]; couriers: Courier[]; deliveryFee: number };
      setProducts(data.products);
      setCouriers(data.couriers);
      setFee(data.deliveryFee);
    }).catch(() => setError(t('loadFailed')));
  }, [t]);

  const itemsTotal = useMemo(() => lines.reduce((sum, line) => {
    const product = products.find((entry) => entry.id === line.product_id);
    return sum + (product?.price_ar ?? 0) * line.qty;
  }, 0), [lines, products]);

  function setLine(index: number, values: Partial<Line>) {
    setLines((current) => current.map((line, itemIndex) => itemIndex === index ? { ...line, ...values } : line));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      customer_name: form.get('customer_name'), phone: form.get('phone'), phone2: form.get('phone2') || undefined,
      address: form.get('address'), landmark: form.get('landmark') || undefined, note: form.get('note') || undefined,
      source: form.get('source'), is_province: isProvince, city: form.get('city') || undefined,
      payment_mode: paymentMode, payment_status: form.get('payment_status'), payer_name: form.get('payer_name') || undefined,
      payer_phone: form.get('payer_phone') || undefined, payment_ref: form.get('payment_ref') || undefined,
      livreur_id: form.get('livreur_id') || null,
      items: lines.filter((line) => line.product_id).map((line) => ({ ...line, qty: Number(line.qty) })),
    };
    const response = await fetch('/api/admin/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) setError(t('invalidForm'));
    else { setSuccess(true); router.push('/admin/commandes'); router.refresh(); }
    setBusy(false);
  }

  return <section className="orders-page">
    <div className="orders-heading"><div><p className="eyebrow">JR CONCEPT / {t('title')}</p><h1>{t('manualTitle')}</h1></div></div>
    <form className="manual-order-form" onSubmit={submit}>
      <section className="order-panel"><h2>{t('customer')}</h2><div className="order-form-grid">
        <label>{t('customerName')}<input name="customer_name" minLength={2} maxLength={120} required /></label>
        <label>{t('phone')}<input name="phone" type="tel" pattern="(?:\+?261)?[\s-]*03[23478][0-9]{7}" required /></label>
        <label>{t('payerPhone')}<input name="phone2" type="tel" pattern="(?:\+?261)?[\s-]*03[23478][0-9]{7}" /></label>
        <label>{t('address')}<input name="address" minLength={2} maxLength={300} required /></label>
        <label>{t('landmark')}<input name="landmark" maxLength={200} /></label>
        <label>{t('city')}<input name="city" maxLength={120} /></label>
        <label className="form-span-two">{t('note')}<textarea name="note" maxLength={1000} rows={2} /></label>
        <label>{t('source')}<select name="source" defaultValue="facebook"><option value="facebook">{t('facebook')}</option><option value="whatsapp">{t('whatsapp')}</option><option value="appel">{t('appel')}</option></select></label>
        <label>{t('paymentMode')}<select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as typeof paymentMode)}><option value="cash">{t('cash')}</option><option value="mvola">{t('mvola')}</option><option value="orange">{t('orange')}</option></select></label>
        <label>{t('paymentStatus')}<select name="payment_status" defaultValue="non_paye"><option value="non_paye">{t('unpaid')}</option><option value="paye">{t('paid')}</option></select></label>
        {paymentMode !== 'cash' && <><label>{t('payerName')}<input name="payer_name" maxLength={120} required /></label><label>{t('payerPhone')}<input name="payer_phone" type="tel" pattern="(?:\+?261)?[\s-]*03[23478][0-9]{7}" /></label><label>{t('paymentRef')}<input name="payment_ref" maxLength={120} /></label></>}
        <label className="checkbox-line"><input type="checkbox" checked={isProvince} onChange={(event) => { setIsProvince(event.target.checked); if (event.target.checked && paymentMode === 'cash') setPaymentMode('mvola'); }} />{t('province')}</label>
        {isProvince && <p className="form-span-two order-hint">{t('cashCodOnly')}</p>}
        <label>{t('assign')}<select name="livreur_id" defaultValue=""><option value="">{t('chooseCourier')}</option>{couriers.map((courier) => <option value={courier.id} key={courier.id}>{courier.full_name}</option>)}</select></label>
      </div></section>
      <section className="order-panel"><div className="line-items-heading"><h2>{t('items')}</h2><button className="button button-secondary" type="button" onClick={() => setLines((current) => [...current, { product_id: '', qty: 1 }])}>{t('addLine')}</button></div>
        <div className="manual-lines">{lines.map((line, index) => <div className="manual-line" key={index}>
          <label>{t('items')}<select required value={line.product_id} onChange={(event) => setLine(index, { product_id: event.target.value })}><option value="">{t('chooseProduct')}</option>{products.map((product) => <option key={product.id} value={product.id} disabled={product.available < 1 || product.is_sold_out}>{product.name_fr} · {formatAr(product.price_ar)} · {product.available}</option>)}</select></label>
          <label>{t('quantity')}<input type="number" min="1" step="1" value={line.qty} onChange={(event) => setLine(index, { qty: Math.max(1, Number(event.target.value) || 1) })} /></label>
          {lines.length > 1 && <button type="button" className="danger-button" aria-label={t('removeLine')} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
        </div>)}</div>
        <div className="manual-totals"><div><span>{t('totalItems')}</span><strong>{formatAr(itemsTotal)}</strong></div><div><span>{t('deliveryFee')}</span><strong>{formatAr(fee)}</strong></div><div><span>{t('totalLabel')}</span><strong>{formatAr(itemsTotal + fee)}</strong></div></div>
      </section>
      {error && <p className="order-message" role="alert">{error}</p>}
      {success && <p role="status">{t('orderCreated')}</p>}
      <button className="button button-primary large-order-button" type="submit" disabled={busy || products.length === 0}>{t('createManual')}</button>
    </form>
  </section>;
}