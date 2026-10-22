'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { formatAr } from '@/lib/catalog/format';

export type CartProduct = { id: string; name: string; price: number; image: string | null; available: number };
type CartLine = CartProduct & { qty: number };
const cartSchema = z.array(z.object({
  id: z.uuid(),
  name: z.string().min(1).max(160),
  price: z.number().int().nonnegative(),
  image: z.string().url().nullable(),
  available: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
})).max(100);
type CartValue = {
  items: CartLine[];
  add: (product: CartProduct, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  open: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('CartProvider is missing');
  return context;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const t = useTranslations('Cart');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jr-cart-v1');
      if (saved) {
        const parsed = cartSchema.safeParse(JSON.parse(saved));
        if (parsed.success) setItems(parsed.data);
        else localStorage.removeItem('jr-cart-v1');
      }
    } catch {
      localStorage.removeItem('jr-cart-v1');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) localStorage.setItem('jr-cart-v1', JSON.stringify(items));
  }, [items, isHydrated]);

  function add(product: CartProduct, qty = 1) {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id
        ? { ...item, ...product, qty: Math.min(product.available, item.qty + qty) }
        : item);
      return [...current, { ...product, qty: Math.min(product.available, qty) }];
    });
    setIsOpen(true);
  }

  function setQty(id: string, qty: number) {
    if (qty < 1) return remove(id);
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, qty: Math.min(item.available, qty) }
      : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return (
    <CartContext.Provider value={{ items, add, setQty, remove, open: () => setIsOpen(true) }}>
      {children}
      {isOpen && <div className="cart-scrim" onClick={() => setIsOpen(false)}>
        <aside className="cart-drawer" onClick={(event) => event.stopPropagation()} aria-label={t('title')}>
          <header className="cart-drawer-head"><h2>{t('title')}</h2><button type="button" onClick={() => setIsOpen(false)} aria-label={t('close')}>×</button></header>
          {items.length === 0 ? <p className="empty-cart">{t('empty')}</p> : <ul className="cart-lines">
            {items.map((item) => <li key={item.id}>
              {item.image && <Image src={item.image} alt="" width={64} height={64} sizes="64px" />}
              <div className="cart-line-copy"><strong>{item.name}</strong><span>{formatAr(item.price)}</span>
                <div className="quantity-control"><button type="button" onClick={() => setQty(item.id, item.qty - 1)} aria-label={t('decrease')}>−</button>
                  <output>{item.qty}</output><button type="button" onClick={() => setQty(item.id, item.qty + 1)} disabled={item.qty >= item.available} aria-label={t('increase')}>+</button></div>
              </div>
              <button className="remove-line" type="button" onClick={() => remove(item.id)} aria-label={t('remove')}>×</button>
            </li>)}
          </ul>}
          <footer className="cart-total"><span>{t('subtotal')}</span><strong>{formatAr(total)}</strong><p>{t('checkoutLater')}</p></footer>
        </aside>
      </div>}
    </CartContext.Provider>
  );
}

export function CartTrigger() {
  const { items, open } = useCart();
  const t = useTranslations('Cart');
  return <button className="cart-trigger" type="button" onClick={open} aria-label={t('open')}>
    {t('open')} <span>{items.reduce((sum, item) => sum + item.qty, 0)}</span>
  </button>;
}

export function AddToCartButton({ product, label }: { product: CartProduct; label: string }) {
  const { add } = useCart();
  return <button className="button button-primary" type="button" disabled={product.available < 1} onClick={() => add(product)}>{label}</button>;
}

export function ProductQuantityAdd({ product, label, quantityLabel }: { product: CartProduct; label: string; quantityLabel: string }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  return <div className="detail-add-control">
    <label>{quantityLabel}<input type="number" min="1" max={product.available} step="1" value={quantity}
      disabled={product.available < 1}
      onChange={(event) => setQuantity(Math.max(1, Math.min(product.available, Math.trunc(Number(event.target.value) || 1))))} /></label>
    <button className="button button-primary" type="button" disabled={product.available < 1}
      onClick={() => add(product, quantity)}>{label}</button>
  </div>;
}
