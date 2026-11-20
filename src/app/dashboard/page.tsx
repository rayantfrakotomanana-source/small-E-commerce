import { createClient } from '@/lib/supabase/server';

function MGA(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value) + ' MGA';
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: sales }, { data: expenses }] = await Promise.all([
    supabase.from('bms_products').select('id, stock_quantity, minimum_stock, purchase_price, selling_price').is('archived_at', null),
    supabase.from('bms_sales').select('id, total, sold_at, payment_status, status'),
    supabase.from('bms_expenses').select('amount, expense_date'),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date());
  const month = today.slice(0, 7);
  const saleRows = sales ?? [];
  const expenseRows = expenses ?? [];
  const todaySales = saleRows.filter((s) => s.sold_at.startsWith(today) && s.status === 'completed').reduce((n, s) => n + s.total, 0);
  const monthSales = saleRows.filter((s) => s.sold_at.slice(0, 7) === month && s.status === 'completed').reduce((n, s) => n + s.total, 0);
  const monthExpenses = expenseRows.filter((e) => e.expense_date.startsWith(month)).reduce((n, e) => n + e.amount, 0);
  const inventoryValue = (products ?? []).reduce((n, p) => n + p.purchase_price * p.stock_quantity, 0);
  const lowStock = (products ?? []).filter((p) => p.stock_quantity <= p.minimum_stock).length;
  const unpaid = saleRows.filter((s) => s.status === 'completed' && s.payment_status !== 'paid').reduce((n, s) => n + s.total, 0);

  return <div className="page"><header className="page-header"><div><p className="eyebrow">JR CONCEPT</p><h1>Overview</h1></div><a className="primary-button compact" href="/sales">Record sale</a></header>
    <section className="metric-grid">
      <article><span>Sales today</span><strong>{MGA(todaySales)}</strong></article>
      <article><span>Sales this month</span><strong>{MGA(monthSales)}</strong></article>
      <article><span>Expenses this month</span><strong>{MGA(monthExpenses)}</strong></article>
      <article><span>Estimated net profit</span><strong>{MGA(monthSales - monthExpenses)}</strong></article>
      <article><span>Inventory value</span><strong>{MGA(inventoryValue)}</strong></article>
      <article><span>Low-stock products</span><strong>{lowStock}</strong></article>
      <article><span>Outstanding customer balances</span><strong>{MGA(unpaid)}</strong></article>
    </section>
    <section className="panel"><h2>Recent sales</h2>{saleRows.length === 0 ? <p className="empty-state">No sales recorded yet.</p> : <div className="table-wrap"><table><thead><tr><th>Sale</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>{saleRows.slice(0, 8).map((sale) => <tr key={sale.id}><td>{sale.id.slice(0, 8).toUpperCase()}</td><td>{new Date(sale.sold_at).toLocaleString()}</td><td>{sale.payment_status}</td><td>{MGA(sale.total)}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
