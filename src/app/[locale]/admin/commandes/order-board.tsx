'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/browser';
import { formatAr } from '@/lib/catalog/format';
import type { Database } from '@/lib/database.types';

type Order = Database['public']['Tables']['orders']['Row'];
type Status = Database['public']['Enums']['order_status'];
const tabs: Array<{ value: Status; key: 'awaiting' | 'inProgress' | 'delivered' | 'cancelled' }> = [
  { value: 'a_confirmer', key: 'awaiting' },
  { value: 'en_cours', key: 'inProgress' },
  { value: 'livree', key: 'delivered' },
  { value: 'annulee', key: 'cancelled' },
];

export function OrderBoard() {
  const t = useTranslations('Orders');
  const [status, setStatus] = useState<Status>('a_confirmer');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status, page: String(page), search });
    const response = await fetch(`/api/admin/orders?${params}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json() as { orders: Order[]; total: number };
      setOrders(data.orders);
      setTotal(data.total);
    }
    setLoading(false);
  }, [status, page, search]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('admin-orders-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void refresh(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events' }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  return <section className="orders-page">
    <div className="orders-heading"><div><p className="eyebrow">JR CONCEPT / {t('dashboard')}</p><h1>{t('title')}</h1></div>
      <Link className="button button-primary" href="/admin/commandes/nouvelle">{t('manualTitle')}</Link>
    </div>
    <div className="order-tabs" role="tablist" aria-label={t('tabs')}>
      {tabs.map((tab) => <button type="button" role="tab" aria-selected={status === tab.value} key={tab.value}
        onClick={() => { setPage(1); setStatus(tab.value); }}>{t(tab.key)}</button>)}
    </div>
    <label className="orders-search"><span>{t('search')}</span><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t('searchHint')} /></label>
    {loading ? <p className="orders-empty">{t('loading')}</p> : orders.length === 0 ? <p className="orders-empty">{t('empty')}</p> :
      <div className="order-card-list">{orders.map((order) => <article className="order-card" key={order.id}>
        <div className="order-card-main"><div><span className="order-number">{order.order_number}</span><h2>{order.customer_name}</h2><a href={`tel:${order.phone}`} className="order-phone">{order.phone}</a></div>
          <strong className="order-card-total">{formatAr(order.total)}</strong></div>
        <div className="order-badges">
          <span className={`status-badge ${order.payment_status === 'paye' ? 'badge-paid' : 'badge-unpaid'}`}>{order.payment_status === 'paye' ? t('paid') : t('unpaid')}</span>
          <span className="neutral-badge">{t(order.payment_mode)}</span>
          <span className="neutral-badge">{t(order.source)}</span>
          {order.is_province && <span className="province-badge">{t('province')}</span>}
        </div>
        <Link className="order-open" href={`/admin/commandes/${order.id}`}>{t('details')} <span aria-hidden="true">→</span></Link>
      </article>)}</div>}
    {Math.ceil(total / 20) > 1 && <nav className="catalog-pagination" aria-label={t('pagination')}>
      {page > 1 ? <button type="button" onClick={() => setPage((value) => value - 1)}>{t('previous')}</button> : <span />}
      <span>{t('page', { current: page, total: Math.ceil(total / 20) })}</span>
      {page < Math.ceil(total / 20) ? <button type="button" onClick={() => setPage((value) => value + 1)}>{t('next')}</button> : <span />}
    </nav>}
  </section>;
}