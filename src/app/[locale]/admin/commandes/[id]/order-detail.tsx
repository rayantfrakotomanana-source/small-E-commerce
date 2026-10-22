'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { formatAr } from '@/lib/catalog/format';
import type { Database } from '@/lib/database.types';

type Order = Database['public']['Tables']['orders']['Row'];
type Item = Database['public']['Tables']['order_items']['Row'];
type Event = Database['public']['Tables']['order_events']['Row'];
type Courier = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'phone'>;

export function OrderDetail({ id }: { id: string }) {
  const t = useTranslations('Orders');
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState('');
  const [transportInfo, setTransportInfo] = useState('');
  const [transportUrl, setTransportUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const response = await fetch(`/api/admin/orders/${id}`, { cache: 'no-store' });
    if (!response.ok) { setMessage(t('loadFailed')); return; }
    const data = await response.json() as { order: Order; items: Item[]; events: Event[]; couriers: Courier[] };
    setOrder(data.order);
    setItems(data.items);
    setEvents(data.events);
    setCouriers(data.couriers);
    setTransportInfo(data.order.transport_info ?? '');
    setTransportUrl(data.order.transport_url ?? '');
  }

  useEffect(() => { void refresh(); }, [id]);

  async function runAction(action: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...action }),
    });
    if (!response.ok) setMessage(t('actionFailed'));
    else { setReason(''); setReference(''); await refresh(); router.refresh(); }
    setBusy(false);
    return response.ok;
  }

  async function saveTransport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = order?.phone.replace(/[\s+()-]/g, '').replace(/^0/, '261');
    const text = `Bonjour ${order?.customer_name}, votre commande ${order?.order_number} est en route. ${transportInfo} ${transportUrl}`;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    const saved = await runAction({ action: 'transport', info: transportInfo, url: transportUrl });
    if (saved && phone) popup?.location.replace(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
    else popup?.close();
  }

  if (!order) return <section className="orders-page"><p>{message || t('loading')}</p></section>;
  const canConfirm = order.status === 'a_confirmer'
    && (order.payment_status === 'paye' || (order.payment_mode === 'cash' && !order.is_province));
  const whatsapp = order.phone.replace(/[\s+()-]/g, '').replace(/^0/, '261');

  return <section className="orders-page order-detail-page">
    <Link className="back-link" href="/admin/commandes">← {t('back')}</Link>
    <div className="orders-heading"><div><p className="eyebrow">{order.order_number}</p><h1>{order.customer_name}</h1></div><strong className="detail-grand-total">{formatAr(order.total)}</strong></div>
    <div className="detail-columns">
      <div className="detail-main-column">
        <section className="order-panel"><h2>{t('items')}</h2><ul className="detail-items">{items.map((item) => <li key={item.id}><span>{item.name_snapshot} × {item.qty}</span><strong>{formatAr(item.unit_price * item.qty)}</strong></li>)}</ul>
          <div className="detail-total-row"><span>{t('totalItems')}</span><span>{formatAr(order.items_total)}</span></div>
          <div className="detail-total-row"><span>{t('deliveryFee')}</span><span>{formatAr(order.delivery_fee)}</span></div>
          <div className="detail-total-row detail-total-final"><strong>{t('totalLabel')}</strong><strong>{formatAr(order.total)}</strong></div>
        </section>
        <section className="order-panel"><h2>{t('customer')}</h2><dl className="order-facts">
          <div><dt>{t('phone')}</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a>{order.phone2 && <> · <a href={`tel:${order.phone2}`}>{order.phone2}</a></>}</dd></div>
          <div><dt>{t('address')}</dt><dd>{order.address}{order.landmark ? ` · ${order.landmark}` : ''}{order.city ? ` · ${order.city}` : ''}</dd></div>
          <div><dt>{t('source')}</dt><dd>{t(order.source)}</dd></div>
          <div><dt>{t('paymentMode')}</dt><dd>{t(order.payment_mode)}</dd></div>
          {order.payment_mode !== 'cash' && <div><dt>{t('payer')}</dt><dd>{order.payer_name} {order.payer_phone && `· ${order.payer_phone}`}</dd></div>}
          <div><dt>{t('paymentStatus')}</dt><dd>{order.payment_status === 'paye' ? t('paid') : t('unpaid')}</dd></div>
        </dl></section>
        <section className="order-panel"><h2>{t('timeline')}</h2><ol className="event-timeline">{events.map((event) => <li key={event.id}><time>{new Date(event.created_at).toLocaleString()}</time><strong>{event.event}</strong><span>{event.from_value && `${event.from_value} → `}{event.to_value}</span>{event.note && <p>{event.note}</p>}</li>)}</ol></section>
      </div>
      <aside className="order-actions-column">
        {order.payment_status !== 'paye' && <section className="order-panel action-panel"><h2>{t('markPaid')}</h2><label>{t('paymentRef')}<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} /></label><button className="button button-primary action-button" type="button" disabled={busy} onClick={() => void runAction({ action: 'mark_paid', ref: reference })}>{t('markPaid')}</button></section>}
        {order.status === 'a_confirmer' && <button className="button button-primary action-button" type="button" disabled={!canConfirm || busy} onClick={() => void runAction({ action: 'confirm' })}>{t('confirm')}</button>}
        {order.status === 'en_cours' && <section className="order-panel action-panel"><h2>{t('assign')}</h2><label>{t('chooseCourier')}<select value={courier} onChange={(event) => setCourier(event.target.value)}><option value="">{t('chooseCourier')}</option>{couriers.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.phone}</option>)}</select></label><button className="button button-primary action-button" type="button" disabled={!courier || busy} onClick={() => void runAction({ action: 'assign', livreur_id: courier })}>{t('saveAssignment')}</button></section>}
        {order.is_province && order.status === 'en_cours' && <section className="order-panel action-panel"><h2>{t('provinceTransport')}</h2><form onSubmit={saveTransport}><label>{t('transportInfo')}<textarea value={transportInfo} onChange={(event) => setTransportInfo(event.target.value)} maxLength={1000} required /></label><label>{t('transportUrl')}<input type="url" value={transportUrl} onChange={(event) => setTransportUrl(event.target.value)} placeholder="https://" /></label><button className="button button-primary action-button" type="submit" disabled={busy}>{t('sendTransport')}</button></form>
          {!order.livreur_id && <button className="button button-secondary action-button" type="button" disabled={busy} onClick={() => void runAction({ action: 'delivered', note: 'Client receipt confirmed' })}>{t('markDelivered')}</button>}
        </section>}
        {order.status !== 'livree' && order.status !== 'annulee' && <section className="order-panel action-panel"><a className="customer-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp · {order.phone}</a><label>{t('cancelReason')}<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={2} maxLength={500} /></label><button className="button button-secondary action-button" type="button" disabled={busy || reason.trim().length < 2} onClick={() => void runAction({ action: 'cancel', reason })}>{t('cancel')}</button><button className="danger-action" type="button" disabled={busy} onClick={() => window.confirm(t('spam')) && void runAction({ action: 'spam' })}>{t('spam')}</button></section>}
        {message && <p className="order-message" role="status">{message}</p>}
      </aside>
    </div>
  </section>;
}