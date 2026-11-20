import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '../api';

export const CART_KEY = 'playshop.cart';
export const MAX_QTY = 10;

export interface CartItem {
  key: string; // productId + option
  productId: number;
  name: string;
  price: number;
  emoji: string;
  color: string;
  stock: number;
  option: string | null;
  qty: number;
}

interface CartData {
  items: CartItem[];
  promoCode: string | null;
}

interface CartState extends CartData {
  count: number;
  subtotal: number;
  add: (product: Product, qty: number, option: string | null) => void;
  updateQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setPromoCode: (code: string | null) => void;
}

const CartContext = createContext<CartState | null>(null);

function load(): CartData {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { items: parsed.items ?? [], promoCode: parsed.promoCode ?? null };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return { items: [], promoCode: null };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CartData>(load);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }, [data]);

  // keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setData(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<CartState>(() => {
    const limit = (stock: number) => Math.min(MAX_QTY, stock);
    return {
      ...data,
      count: data.items.reduce((n, i) => n + i.qty, 0),
      subtotal: Math.round(data.items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
      add: (product, qty, option) =>
        setData((d) => {
          const key = `${product.id}:${option ?? ''}`;
          const existing = d.items.find((i) => i.key === key);
          const items = existing
            ? d.items.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, limit(product.stock)) } : i))
            : [
                ...d.items,
                {
                  key,
                  productId: product.id,
                  name: product.name,
                  price: product.price,
                  emoji: product.emoji,
                  color: product.color,
                  stock: product.stock,
                  option,
                  qty: Math.min(qty, limit(product.stock)),
                },
              ];
          return { ...d, items };
        }),
      updateQty: (key, qty) =>
        setData((d) => ({
          ...d,
          items: d.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, limit(i.stock))) } : i)),
        })),
      remove: (key) => setData((d) => ({ ...d, items: d.items.filter((i) => i.key !== key) })),
      clear: () => setData({ items: [], promoCode: null }),
      setPromoCode: (promoCode) => setData((d) => ({ ...d, promoCode })),
    };
  }, [data]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
