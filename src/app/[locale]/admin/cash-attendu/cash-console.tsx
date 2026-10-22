'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatAr } from '@/lib/catalog/format';

type CashRow = {
  id: string;
  full_name: string;
  phone: string | null;
  expected: number;
  orders: Array<{ id: string; order_number: string; customer_name: string; total: number; cash_collected_ar: number | null }>;
  closing: { received_ar: number; difference_ar: number; note: string | null } | null;
};
type UnpaidCashOrder = { id: string; order_number: string; customer_name: string; phone: string; total: number; status: string };

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CashConsole() {
  const t = useTranslations('Orders');
  const [day, setDay] = useState(todayLocal());
  const [rows, setRows] = useState<CashRow[]>([]);
  const [totalExpected, setTotalExpected] = useState(0);
  const [unpaidCash, setUnpaidCash] = useState<UnpaidCashOrder[]>([]);
  const [unpaidCashTotal, setUnpaidCashTotal] = useState(0);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  async function refresh() {
    const response = await fetch(`/api/admin/cash?day=${day}`, { cache: 'no-store' });
    if (!response.ok) { setMessage(t('loadFailed')); return; }
    const data = await response.json() as { rows: CashRow[]; totalExpected: number; unpaidCash: UnpaidCashOrder[]; unpaidCashTotal: number };
    setRows(data.rows);
    setTotalExpected(data.totalExpected);
    setUnpaidCash(data.unpaidCash);
    setUnpaidCashTotal(data.unpaidCashTotal);
    setReceived(Object.fromEntries(data.rows.map((row) => [row.id, String(row.closing?.received_ar ?? '')])));
    setNotes(Object.fromEntries(data.rows.map((row) => [row.id, row.closing?.note ?? ''])));
  }

  useEffect(() => { void refresh(); }, [day]);

  async function save(row: CashRow) {
    const amount = Number(received[row.id]);
    if (!Number.isSafeInteger(amount) || amount < 0) return;
    setBusy(row.id);
    const response = await fetch('/api/admin/cash', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, livreur_id: row.id, received: amount, note: notes[row.id] }),
    });
    setMessage(response.ok ? t('closingSaved') : t('actionFailed'));
    await refresh();
    setBusy('');
  }

  return <section className="orders-page">
    <div className="orders-heading"><div><p className="eyebrow">JR CONCEPT / {t('cashExpected')}</p><h1>{t('dailyClosing')}</h1></div><label className="day-picker">{t('closingDay')}<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label></div>
    <div className="cash-total-band"><span>{t('cashTotal')}</span><strong>{formatAr(totalExpected)}</strong></div>
    <section className="order-panel unpaid-cash-panel"><div className="cash-courier-heading"><h2>{t('cashExpected')}</h2><strong>{formatAr(unpaidCashTotal)}</strong></div>
      {unpaidCash.length ? <ul className="cash-order-list">{unpaidCash.map((order) => <li key={order.id}><Link href={`/admin/commandes/${order.id}`}>{order.order_number} · {order.customer_name}</Link><strong>{formatAr(order.total)}</strong></li>)}</ul> : <p>{t('empty')}</p>}
    </section>
    {rows.map((row) => <article className="cash-courier-row" key={row.id}>
      <div className="cash-courier-heading"><div><h2>{row.full_name}</h2>{row.phone && <a href={`tel:${row.phone}`}>{row.phone}</a>}</div><strong>{formatAr(row.expected)}</strong></div>
      {row.orders.length > 0 ? <ul className="cash-order-list">{row.orders.map((order) => <li key={order.id}><span>{order.order_number} · {order.customer_name}</span><strong>{formatAr(order.cash_collected_ar ?? 0)}</strong></li>)}</ul> : <p>{t('noCourierCash')}</p>}
      {row.expected > 0 || row.closing ? <form className="cash-closing-form" onSubmit={(event) => { event.preventDefault(); void save(row); }}>
        <label>{t('receivedCash')}<input type="number" min="0" step="1" value={received[row.id] ?? ''} onChange={(event) => setReceived((current) => ({ ...current, [row.id]: event.target.value }))} required /></label>
        <label>{t('note')}<input value={notes[row.id] ?? ''} maxLength={500} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label>
        {row.closing && <p className="cash-difference">{t('difference')}: <strong>{formatAr(row.closing.difference_ar)}</strong></p>}
        <button className="button button-primary" type="submit" disabled={busy === row.id}>{t('saveClosing')}</button>
      </form> : null}
    </article>)}
    {message && <p role="status" className="order-message">{message}</p>}
  </section>;
}