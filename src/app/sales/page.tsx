'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Product = { id: string; name: string; selling_price: number; stock_quantity: number };
type Customer = { id: string; name: string };
type Sale = { id: string; sale_number: string; total: number; discount: number; payment_status: string; status: string; sold_at: string };

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lines, setLines] = useState<Array<{ product_id: string; quantity: number }>>([{ product_id: '', quantity: 1 }]);
  const [customer, setCustomer] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<'cash'|'mobile_money'|'bank_transfer'|'other'>('cash');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch('/api/bms/sales', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json() as { sales: Sale[]; products: Product[]; customers: Customer[] };
      setSales(data.sales); setProducts(data.products); setCustomers(data.customers);
    }
  }
  useEffect(() => { void load(); }, []);
  const subtotal = lines.reduce((sum, line) => sum + (products.find((p) => p.id === line.product_id)?.selling_price ?? 0) * line.quantity, 0);
  const total = Math.max(subtotal - discount, 0);

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const payments = paid > 0 ? [{ amount: paid, method }] : [];
    const response = await fetch('/api/bms/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customer || null, discount, items: lines.filter((line) => line.product_id), payments }) });
    setMessage(response.ok ? 'Sale recorded.' : 'Could not record sale.');
    setBusy(false);
    if (response.ok) { setLines([{ product_id: '', quantity: 1 }]); setDiscount(0); setPaid(0); await load(); }
  }

  async function cancelSale(id: string) {
    const reason = window.prompt('Cancellation reason:');
    if (!reason?.trim()) return;
    const response = await fetch('/api/bms/sales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason }) });
    setMessage(response.ok ? 'Sale cancelled and stock restored.' : 'Could not cancel sale.');
    await load();
  }

  async function payment(id: string) {
    const amountInput = window.prompt('Additional payment amount (MGA):');
    if (!amountInput) return;
    const amount = Number(amountInput);
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    const response = await fetch('/api/bms/sales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payment', id, amount, method }) });
    setMessage(response.ok ? 'Payment recorded.' : 'Could not record payment.');
    await load();
  }

  async function returnSale(id: string) {
    const reason = window.prompt('Return reason:');
    if (!reason?.trim()) return;
    const response = await fetch('/api/bms/sales', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'return', id, reason }) });
    setMessage(response.ok ? 'Sale returned and stock restored.' : 'Could not return sale.');
    await load();
  }

  const money = (value: number) => new Intl.NumberFormat('en-US').format(value) + ' MGA';
  return <div className="page"><header className="page-header"><div><p className="eyebrow">JR CONCEPT</p><h1>Sales</h1></div></header>
    <section className="panel"><h2>Register sale</h2><form className="form-grid" onSubmit={submitSale}>
      <label>Customer<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Walk-in customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Discount (MGA)<input type="number" min="0" step="1" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} /></label>
      <label>Amount paid now<input type="number" min="0" step="1" value={paid} onChange={(event) => setPaid(Number(event.target.value) || 0)} /></label>
      <label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label>
      <div className="sale-lines span-2"><h3>Products</h3>{lines.map((line, index) => <div className="sale-line" key={index}><select value={line.product_id} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, product_id: event.target.value } : item))}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id} disabled={product.stock_quantity < 1}>{product.name} — {money(product.selling_price)} ({product.stock_quantity})</option>)}</select><input type="number" min="1" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} /><button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1}>Remove</button></div>)}</div>
      <button className="secondary-button span-2" type="button" onClick={() => setLines((current) => [...current, { product_id: '', quantity: 1 }])}>Add product</button>
      <div className="sale-total span-2"><span>Subtotal {money(subtotal)}</span><strong>Total {money(total)}</strong></div>
      {message && <p className="form-message span-2">{message}</p>}<button className="primary-button span-2" type="submit" disabled={busy || !lines.some((line) => line.product_id)}>Record sale</button>
    </form></section>
    <section className="panel"><h2>Sales history</h2>{sales.length === 0 ? <p className="empty-state">No sales recorded yet.</p> : <div className="table-wrap"><table><thead><tr><th>Sale</th><th>Date</th><th>Status</th><th>Payment</th><th>Total</th><th>Actions</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{sale.sale_number ?? sale.id.slice(0, 8).toUpperCase()}</td><td>{new Date(sale.sold_at).toLocaleString()}</td><td>{sale.status}</td><td>{sale.payment_status}</td><td>{money(sale.total)}</td><td>{sale.status === 'completed' && <div className="table-actions"><button type="button" onClick={() => payment(sale.id)}>Payment</button><button type="button" onClick={() => returnSale(sale.id)}>Return</button><button type="button" onClick={() => cancelSale(sale.id)}>Cancel</button></div>}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
