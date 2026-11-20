// Tiny fetch wrapper + shared types for the PlayShop API.

export const TOKEN_KEY = 'playshop.token';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  productCount: number;
}

export interface Review {
  author: string;
  rating: number;
  text: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  stock: number;
  rating: number;
  emoji: string;
  color: string;
  featured: boolean;
  description: string;
  features: string[];
  options?: { name: string; values: string[] };
  reviews: Review[];
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Address {
  line1: string;
  city: string;
  zip: string;
  country: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  status: string;
  phone: string;
  address: Address | null;
  avatar?: string;
}

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface Quote extends Totals {
  promo: { code: string; description: string } | null;
  promoError: string | null;
}

export interface OrderItem {
  productId: number;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  option: string | null;
}

export interface Order {
  id: string;
  userId: number;
  createdAt: string;
  status: 'Processing' | 'Delivered' | 'Cancelled';
  items: OrderItem[];
  shipping: Address & { fullName: string; phone: string };
  shippingMethod: 'standard' | 'express';
  payment: { brand: string; last4: string };
  promoCode: string | null;
  totals: Totals;
  customerEmail?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Network error – is the API server running?');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('playshop:unauthorized'));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.fields);
  }
  return data as T;
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
