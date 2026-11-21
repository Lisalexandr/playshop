import { createContext, useContext } from 'react';
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

export interface CartData {
  items: CartItem[];
  promoCode: string | null;
}

export interface CartState extends CartData {
  count: number;
  subtotal: number;
  add: (product: Product, qty: number, option: string | null) => void;
  updateQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setPromoCode: (code: string | null) => void;
}

export const CartContext = createContext<CartState | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
