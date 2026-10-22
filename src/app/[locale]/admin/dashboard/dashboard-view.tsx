'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatAr } from '@/lib/catalog/format';

type DashboardData = {
  todaySales: number;
  currentOrders: number;
  unpaidTotal: number;
  cashExpected: number;
  topProducts: Array<{ name: string; quantity: number }>;
  salesByDay: Array<{ day: string; total: number }>;
};

export function DashboardView() {
  const t = useTranslations('Orders');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void fetch('/api/admin/dashboard', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('dashboard');
      setData(await response.json() as DashboardData);
    }).catch(() => setError(true));
  }, []);
  if (error) return <p role="alert">{t('loadFailed')}</p>;
  if (!data) return <p>{t('loading')}</p>;

  const maxSales = Math.max(1, ...data.salesByDay.map((entry) => entry.total));
  return <section className="orders-page dashboard-page">
    <div className="orders-heading"><div><p className="eyebrow">JR CONCEPT / {t('dashboard')}</p><h1>{t('dashboard')}</h1></div></div>
    <div className="dashboard-metrics">
      <article><span>{t('todaySales')}</span><strong>{formatAr(data.todaySales)}</strong></article>
      <article><span>{t('currentOrders')}</span><strong>{data.currentOrders}</strong></article>
      <article><span>{t('unpaidTotal')}</span><strong>{formatAr(data.unpaidTotal)}</strong></article>
      <article><span>{t('cashExpectedToday')}</span><strong>{formatAr(data.cashExpected)}</strong></article>
    </div>
    <div className="dashboard-lower">
      <section className="order-panel sales-chart"><h2>{t('lastSevenDays')}</h2>
        <div className="bar-chart" role="img" aria-label={`${t('lastSevenDays')}: ${data.salesByDay.map((entry) => `${entry.day} ${formatAr(entry.total)}`).join(', ')}`}>
          {data.salesByDay.map((entry) => <div className="bar-chart-column" key={entry.day}>
            <span>{entry.total > 0 ? formatAr(entry.total) : ''}</span>
            <div className="bar-track"><i style={{ height: `${Math.max(3, Math.round(entry.total / maxSales * 100))}%` }} /></div>
            <time>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${entry.day}T12:00:00`))}</time>
          </div>)}
        </div>
      </section>
      <section className="order-panel top-products"><h2>{t('topProducts')}</h2>
        {data.topProducts.length ? <ol>{data.topProducts.map((product, index) => <li key={`${product.name}-${index}`}><span>{product.name}</span><strong>{product.quantity}</strong></li>)}</ol> : <p>{t('empty')}</p>}
      </section>
    </div>
  </section>;
}