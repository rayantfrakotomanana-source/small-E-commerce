'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { formatAr } from '@/lib/catalog/format';
import { z } from 'zod';
import type { Database } from '@/lib/database.types';

type Order = Database['public']['Tables']['orders']['Row'];
type Outcome = 'livree' | 'injoignable' | 'reporté' | 'refusé';
type QueuedOutcome = { id: string; orderId: string; outcome: Outcome; reason: string | null; cashCollected: number | null; queuedAt: string };

const queueSchema = z.array(z.object({
  id: z.uuid(), orderId: z.uuid(), outcome: z.enum(['livree', 'injoignable', 'reporté', 'refusé']),
  reason: z.string().nullable(), cashCollected: z.number().int().nonnegative().nullable(), queuedAt: z.iso.datetime(),
})).max(100);
const queueKey = 'jr-courier-outcomes-v1';

function localDayStart() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date());
  return new Date(`${today}T00:00:00+03:00`).toISOString();
}

function mapsHref(order: Order) {
  const address = [order.address, order.landmark, order.city, 'Madagascar'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function CourierConsole() {
  const t = useTranslations('Courier');
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [queue, setQueue] = useState<QueuedOutcome[]>([]);
  const queueRef = useRef<QueuedOutcome[]>([]);
  const [cashCollectedToday, setCashCollectedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [nonDeliveryOrder, setNonDeliveryOrder] = useState<Order | null>(null);
  const [outcome, setOutcome] = useState<'injoignable' | 'reporté' | 'refusé'>('injoignable');
  const [reason, setReason] = useState('');
  const [cashAmount, setCashAmount] = useState('0');
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const flushingQueue = useRef(false);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError(t('loadFailed')); setLoading(false); return; }
    const [{ data: activeOrders, error: ordersError }, { data: delivered, error: cashError }] = await Promise.all([
      supabase.from('orders').select('*').eq('livreur_id', user.id).eq('status', 'en_cours').order('created_at'),
      supabase.from('orders').select('cash_collected_ar, total').eq('livreur_id', user.id).eq('status', 'livree')
        .eq('payment_mode', 'cash').eq('cash_handed_over', false).gte('delivered_at', localDayStart()),
    ]);
    if (ordersError || cashError) setError(t('loadFailed'));
    else {
      setOrders(activeOrders ?? []);
      setCashCollectedToday((delivered ?? []).reduce((sum, order) => sum + (order.cash_collected_ar ?? order.total), 0));
      setError('');
    }
    setLoading(false);
  }, [supabase, t]);

  const writeQueue = useCallback((next: QueuedOutcome[]) => {
    queueRef.current = next;
    setQueue(next);
    localStorage.setItem(queueKey, JSON.stringify(next));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(queueKey);
      if (saved) {
        const parsed = queueSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          queueRef.current = parsed.data;
          setQueue(parsed.data);
        }
        else localStorage.removeItem(queueKey);
      }
    } catch {
      localStorage.removeItem(queueKey);
    }
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let active = true;
    let removeChannel: (() => void) | null = null;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      const channel = supabase.channel(`courier-orders-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `livreur_id=eq.${user.id}` }, () => { void refresh(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events' }, () => { void refresh(); })
        .subscribe();
      removeChannel = () => { void supabase.removeChannel(channel); };
    });
    return () => { active = false; removeChannel?.(); };
  }, [refresh, supabase]);

  useEffect(() => {
    if (!online || queue.length === 0 || busy || flushingQueue.current) return;
    void (async () => {
      flushingQueue.current = true;
      try {
        while (navigator.onLine && queueRef.current.length > 0) {
          const item = queueRef.current[0];
          const { data: currentOrder, error: lookupError } = await supabase.from('orders')
            .select('id').eq('id', item.orderId).eq('status', 'en_cours').maybeSingle();
          if (lookupError) return;
          if (!currentOrder) {
            writeQueue(queueRef.current.filter((queued) => queued.id !== item.id));
            continue;
          }
          const { error: rpcError } = await supabase.rpc('livreur_set_outcome', {
            target_order_id: item.orderId, outcome: item.outcome,
            reason: item.reason, cash_collected: item.cashCollected,
          });
          if (rpcError) {
            if (/fetch|network|offline|connection/i.test(rpcError.message)) return;
            writeQueue(queueRef.current.filter((queued) => queued.id !== item.id));
            setError(t('retryRejected'));
            continue;
          }
          writeQueue(queueRef.current.filter((queued) => queued.id !== item.id));
          if (item.outcome === 'livree' || item.outcome === 'refusé') {
            setOrders((current) => current.filter((order) => order.id !== item.orderId));
            if (item.outcome === 'livree' && item.cashCollected !== null && item.cashCollected > 0) {
              setCashCollectedToday((current) => current + item.cashCollected!);
            }
          }
          await refresh();
        }
      } finally {
        flushingQueue.current = false;
      }
    })();
  }, [online, queue, busy, supabase, writeQueue, refresh, t]);

  async function submitOutcome(entry: QueuedOutcome) {
    if (submittingOrderId === entry.orderId || queue.some((queued) => queued.orderId === entry.orderId)) return;
    setSubmittingOrderId(entry.orderId);
    setBusy(true);
    setError('');
    setOrders((current) => entry.outcome === 'injoignable' || entry.outcome === 'reporté'
      ? current
      : current.filter((order) => order.id !== entry.orderId));
    if (entry.outcome === 'livree' && entry.cashCollected !== null && entry.cashCollected > 0) setCashCollectedToday((current) => current + entry.cashCollected!);

    if (!navigator.onLine) {
      writeQueue([...queueRef.current, entry]);
      setError(t('queued'));
      setBusy(false);
      setSubmittingOrderId(null);
      return;
    }
    const { error: rpcError } = await supabase.rpc('livreur_set_outcome', {
      target_order_id: entry.orderId, outcome: entry.outcome,
      reason: entry.reason, cash_collected: entry.cashCollected,
    });
    if (rpcError) {
      if (/fetch|network|offline|connection/i.test(rpcError.message)) {
        writeQueue([...queueRef.current, entry]);
        setError(t('queued'));
      } else {
        setError(t('actionFailed'));
        await refresh();
      }
    } else {
      await refresh();
    }
    setBusy(false);
    setSubmittingOrderId(null);
  }

  function openDelivered(order: Order) {
    setDeliveryOrder(order);
    setCashAmount(String(order.payment_status === 'paye' ? 0 : order.total));
  }

  function confirmDelivered(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deliveryOrder) return;
    const collected = deliveryOrder.payment_status === 'paye' ? 0 : Number(cashAmount);
    void submitOutcome({ id: crypto.randomUUID(), orderId: deliveryOrder.id, outcome: 'livree', reason: null, cashCollected: collected, queuedAt: new Date().toISOString() });
    setDeliveryOrder(null);
  }

  function confirmNotDelivered(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nonDeliveryOrder || reason.trim().length < 2) return;
    void submitOutcome({ id: crypto.randomUUID(), orderId: nonDeliveryOrder.id, outcome, reason: reason.trim(), cashCollected: null, queuedAt: new Date().toISOString() });
    setNonDeliveryOrder(null);
    setReason('');
  }

  return <section className="courier-page">
    <header className="courier-heading"><div><p className="eyebrow">JR CONCEPT / {t('title')}</p><h1>{t('title')}</h1></div>
      <div className="courier-cash"><span>{t('cashToReturn')}</span><strong>{formatAr(cashCollectedToday)}</strong></div>
    </header>
    {!online && <p className="courier-offline" role="status">{t('offline')} {queue.length ? t('queuedCount', { count: queue.length }) : ''}</p>}
    {online && queue.length > 0 && <p className="courier-queue-status" role="status">{t('queuedCount', { count: queue.length })}</p>}
    {error && <p className="courier-error" role="alert">{error}</p>}
    {loading ? <p>{t('loading')}</p> : orders.length === 0 ? <p className="courier-empty">{t('empty')}</p> :
      <div className="courier-order-list">{orders.map((order) => {
        const collected = order.payment_status === 'paye' ? 0 : order.total;
        return <article className="courier-order" key={order.id}>
          <div className="courier-order-heading"><div><span className="order-number">{order.order_number}</span><h2>{order.customer_name}</h2></div>
            <span className={`status-badge ${order.payment_status === 'paye' ? 'badge-paid' : 'badge-unpaid'}`}>{order.payment_status === 'paye' ? t('paid') : t('unpaid')}</span></div>
          <a className="courier-phone" href={`tel:${order.phone}`}>{t('call')} · {order.phone}</a>
          <p className="courier-address">{order.address}{order.landmark ? ` · ${order.landmark}` : ''}{order.city ? ` · ${order.city}` : ''}</p>
          <a className="courier-route" href={mapsHref(order)} target="_blank" rel="noreferrer">{t('route')}</a>
          <div className="courier-amount"><span>{t('collect')}</span><strong>{formatAr(collected)}</strong></div>
          <div className="courier-actions"><button className="button button-primary courier-delivered" type="button" disabled={busy || queue.some((item) => item.orderId === order.id)} onClick={() => openDelivered(order)}>{t('delivered')}</button>
            <button className="button button-secondary" type="button" disabled={busy || queue.some((item) => item.orderId === order.id)} onClick={() => { setNonDeliveryOrder(order); setOutcome('injoignable'); }}>{t('notDelivered')}</button></div>
        </article>;
      })}</div>}

    {deliveryOrder && <div className="courier-modal-backdrop" onClick={() => setDeliveryOrder(null)}>
      <section className="courier-modal" role="dialog" aria-modal="true" aria-labelledby="delivered-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="delivered-title">{t('confirmDelivery')}</h2><p>{deliveryOrder.order_number} · {deliveryOrder.customer_name}</p>
        <form onSubmit={confirmDelivered}><label>{t('cashCollected')}<input type="number" min="0" step="1" value={deliveryOrder.payment_status === 'paye' ? '0' : cashAmount}
          readOnly={deliveryOrder.payment_status === 'paye'} required onChange={(event) => setCashAmount(event.target.value)} /></label>
          <button className="button button-primary courier-modal-submit" type="submit" disabled={busy}>{t('delivered')}</button>
          <button className="text-button" type="button" onClick={() => setDeliveryOrder(null)}>{t('back')}</button>
        </form>
      </section>
    </div>}

    {nonDeliveryOrder && <div className="courier-modal-backdrop" onClick={() => setNonDeliveryOrder(null)}>
      <section className="courier-modal" role="dialog" aria-modal="true" aria-labelledby="not-delivered-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="not-delivered-title">{t('notDelivered')}</h2><p>{nonDeliveryOrder.order_number} · {nonDeliveryOrder.customer_name}</p>
        <form onSubmit={confirmNotDelivered}><label>{t('outcome')}<select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
          <option value="injoignable">{t('unreachable')}</option><option value="reporté">{t('postponed')}</option><option value="refusé">{t('refused')}</option>
        </select></label>
          <label>{t('reason')}<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={2} maxLength={500} required /></label>
          <button className="button button-primary courier-modal-submit" type="submit" disabled={busy || reason.trim().length < 2}>{t('saveOutcome')}</button>
          <button className="text-button" type="button" onClick={() => setNonDeliveryOrder(null)}>{t('back')}</button>
        </form>
      </section>
    </div>}
  </section>;
}