'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Product = { id: string; name: string; sku: string | null; description: string; purchase_price: number; selling_price: number; stock_quantity: number; minimum_stock: number; category_id: string | null };
type Category = { id: string; name: string };

const blank = { name: '', sku: '', description: '', purchase_price: '0', selling_price: '0', stock_quantity: '0', minimum_stock: '0', category_id: '' };

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/bms/inventory', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json() as { products: Product[]; categories: Category[] };
      setProducts(data.products); setCategories(data.categories);
    }
  }
  useEffect(() => { void load(); }, []);

  async function submitSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const response = await fetch('/api/bms/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: editing ?? undefined, name: form.name, sku: form.sku, description: form.description,
      purchase_price: Number(form.purchase_price), selling_price: Number(form.selling_price), stock_quantity: Number(form.stock_quantity),
      minimum_stock: Number(form.minimum_stock), category_id: form.category_id || null,
    }) });
    setMessage(response.ok ? 'Product saved.' : 'Could not save product.');
    setBusy(false);
    if (response.ok) { setForm(blank); setEditing(null); await load(); }
  }

  async function adjust(product: Product) {
    const input = window.prompt(`Adjustment for ${product.name}. Use positive or negative whole quantity:`);
    if (!input) return;
    const quantity = Number(input);
    if (!Number.isSafeInteger(quantity) || quantity === 0) return;
    const note = window.prompt('Reason for adjustment:');
    if (!note?.trim()) return;
    const response = await fetch('/api/bms/inventory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'adjust', id: product.id, quantity_change: quantity, note }) });
    setMessage(response.ok ? 'Stock adjusted.' : 'Could not adjust stock.');
    await load();
  }

  async function purchase(product: Product) {
    const quantityInput = window.prompt(`Purchase quantity for ${product.name}:`);
    if (!quantityInput) return;
    const quantity = Number(quantityInput);
    const unitCostInput = window.prompt(`Unit purchase cost for ${product.name}:`);
    if (!unitCostInput) return;
    const unitCost = Number(unitCostInput);
    const note = window.prompt('Purchase note (optional):') ?? 'Purchase recorded';
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(unitCost) || unitCost < 0) return;
    const response = await fetch('/api/bms/inventory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purchase', id: product.id, quantity, unit_cost: unitCost, note }) });
    setMessage(response.ok ? 'Purchase recorded.' : 'Could not record purchase.');
    await load();
  }

  async function categoryAction() {
    const name = window.prompt('Category name:');
    if (!name?.trim()) return;
    const response = await fetch('/api/bms/inventory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'category', name }) });
    setMessage(response.ok ? 'Category saved.' : 'Could not save category.');
    await load();
  }

  const filtered = products.filter((product) => `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const money = (value: number) => new Intl.NumberFormat('en-US').format(value) + ' MGA';

  return <div className="page"><header className="page-header"><div><p className="eyebrow">JR CONCEPT</p><h1>Inventory</h1></div><div className="header-actions"><button className="secondary-button" type="button" onClick={categoryAction}>Add category</button></div></header>
    <section className="panel"><h2>{editing ? 'Edit product' : 'Add product'}</h2><form className="form-grid" onSubmit={submitSave}>
      <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>SKU / Reference<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
      <label>Category<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">No category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      <label>Purchase price<input type="number" min="0" step="1" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></label>
      <label>Selling price<input type="number" min="0" step="1" value={form.selling_price} onChange={(event) => setForm({ ...form, selling_price: event.target.value })} /></label>
      <label>Stock quantity<input type="number" min="0" step="1" value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} /></label>
      <label>Minimum stock<input type="number" min="0" step="1" value={form.minimum_stock} onChange={(event) => setForm({ ...form, minimum_stock: event.target.value })} /></label>
      <label className="span-2">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <button className="primary-button span-2" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Add product'}</button>
    </form>{message && <p className="form-message">{message}</p>}</section>
    <section className="panel"><div className="section-tools"><h2>Products</h2><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or SKU" /></div>
      {filtered.length === 0 ? <p className="empty-state">No products found.</p> : <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Purchase</th><th>Selling</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id} className={product.stock_quantity <= product.minimum_stock ? 'low-stock' : ''}><td>{product.name}</td><td>{product.sku ?? '—'}</td><td>{money(product.purchase_price)}</td><td>{money(product.selling_price)}</td><td>{product.stock_quantity}</td><td><button type="button" onClick={() => { setEditing(product.id); setForm({ name: product.name, sku: product.sku ?? '', description: product.description, purchase_price: String(product.purchase_price), selling_price: String(product.selling_price), stock_quantity: String(product.stock_quantity), minimum_stock: String(product.minimum_stock), category_id: product.category_id ?? '' }); }}>Edit</button><button type="button" onClick={() => adjust(product)}>Adjust stock</button><button type="button" onClick={() => purchase(product)}>Record purchase</button><button type="button" onClick={() => categoryAction()}>Add category</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
