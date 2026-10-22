'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatAr } from '@/lib/catalog/format';
import type { Database } from '@/lib/database.types';

type Order = Database['public']['Tables']['orders']['Row'];

export function JournalConsole() {
  const t = useTranslations('Orders');
  const [status, setStatus] = useState<'livree' | 'annulee'>('livree');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ status, search, page: String(page) });
    void fetch(`/api/admin/journal?${params}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { orders: Order[]; total: number };
      setOrders(data.orders);
      setTotal(data.total);
    });
  }, [status, search, page]);

  return <section className="orders-page">
    <div className="orders-heading"><div><p className="eyebrow">JR CONCEPT / {t('dashboard')}</p><h1>{t('journal')}</h1></div></div>
    <div className="order-tabs" role="tablist" aria-label={t('tabs')}>
      <button type="button" role="tab" aria-selected={status === 'livree'} onClick={() => { setPage(1); setStatus('livree'); }}>{t('delivered')}</button>
      <button type="button" role="tab" aria-selected={status === 'annulee'} onClick={() => { setPage(1); setStatus('annulee'); }}>{t('cancelled')}</button>
    </div>
    <label className="orders-search"><span>{t('search')}</span><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t('searchHint')} /></label>
    <div className="order-card-list">{orders.map((order) => <article className="order-card" key={order.id}>
      <div className="order-card-main"><div><span className="order-number">{order.order_number}</span><h2>{order.customer_name}</h2><small>{new Date(order.created_at).toLocaleString()}</small></div><strong className="order-card-total">{formatAr(order.total)}</strong></div>
      <div className="order-badges"><span className={`status-badge ${order.payment_status === 'paye' ? 'badge-paid' : 'badge-unpaid'}`}>{order.payment_status === 'paye' ? t('paid') : t('unpaid')}</span><span className="neutral-badge">{t(order.source)}</span></div>
      {status === 'annulee' && <p className="order-cancel-note">{order.cancel_reason}</p>}
      {status === 'livree' && order.cash_collected_ar !== null && <p>{t('cash')}: {formatAr(order.cash_collected_ar)}</p>}
      <Link className="order-open" href={`/admin/commandes/${order.id}`}>{t('details')} <span aria-hidden="true">→</span></Link>
    </article>)}</div>
    {Math.ceil(total / 20) > 1 && <nav className="catalog-pagination" aria-label={t('pagination')}>
      {page > 1 ? <button type="button" onClick={() => setPage((value) => value - 1)}>{t('previous')}</button> : <span />}
      <span>{t('page', { current: page, total: Math.ceil(total / 20) })}</span>
      {page < Math.ceil(total / 20) ? <button type="button" onClick={() => setPage((value) => value + 1)}>{t('next')}</button> : <span />}
    </nav>}
  </section>;
}