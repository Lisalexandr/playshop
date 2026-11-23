// PlayShop API – a tiny in-memory REST API for the e-commerce sandbox.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createSeed, PROMO_CODES, SHIPPING_METHODS, TAX_RATE } from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT) || 3001;
const TOKEN_SECRET = 'playshop-local-sandbox-secret';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SLOW_USER_DELAY_MS = 2500;
const MAX_QTY_PER_LINE = 10;

let db = createSeed();
const revokedTokens = new Set();

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- helpers ----------
const round = (n) => Math.round(n * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const publicUser = ({ password, slow, ...user }) => user;

function signToken(userId) {
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || revokedTokens.has(token)) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token);
  const user = payload && db.users.find((u) => u.id === payload.sub);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.status === 'locked') return res.status(403).json({ error: 'Your account has been locked.' });
  req.user = user;
  req.token = token;
  if (user.slow) await sleep(SLOW_USER_DELAY_MS);
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function luhnValid(num) {
  let sum = 0;
  let double = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardBrand(num) {
  if (num.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  return 'Card';
}

/** Resolve a promo code. Returns { promo } or { error }. */
function resolvePromo(code, subtotal) {
  if (!code) return { promo: null };
  const key = String(code).trim().toUpperCase();
  const promo = PROMO_CODES[key];
  if (!promo) return { error: 'Invalid promo code' };
  if (promo.expired) return { error: 'This promo code has expired' };
  if (promo.minSubtotal && subtotal < promo.minSubtotal) {
    return { error: `${key} requires a minimum subtotal of $${promo.minSubtotal.toFixed(2)}` };
  }
  return { promo: { code: key, ...promo } };
}

function computeTotals(lines, shippingMethod = 'standard', promo = null) {
  const subtotal = round(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const discount = promo?.type === 'percent' ? round((subtotal * promo.value) / 100) : 0;
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;
  let shipping = method.price;
  if (method.freeOver && subtotal >= method.freeOver) shipping = 0;
  if (promo?.type === 'freeShipping') shipping = 0;
  if (lines.length === 0) shipping = 0;
  const tax = round(subtotal * TAX_RATE);
  const total = round(subtotal - discount + shipping + tax);
  return { subtotal, discount, shipping, tax, total };
}

/** Validate cart items against the catalog. Returns { lines } or { error, status }. */
function resolveLines(items) {
  if (!Array.isArray(items)) return { error: 'items must be an array', status: 400 };
  const lines = [];
  for (const item of items) {
    const product = db.products.find((p) => p.id === Number(item.productId));
    if (!product) return { error: `Product ${item.productId} not found`, status: 400 };
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { error: `Quantity for "${product.name}" must be between 1 and ${MAX_QTY_PER_LINE}`, status: 400 };
    }
    if (product.options) {
      if (!item.option || !product.options.values.includes(String(item.option))) {
        return { error: `Please choose a valid ${product.options.name.toLowerCase()} for "${product.name}"`, status: 400 };
      }
    }
    lines.push({
      productId: product.id,
      name: product.name,
      emoji: product.emoji,
      price: product.price,
      qty,
      option: product.options ? String(item.option) : null,
      product,
    });
  }
  return { lines };
}

// ---------- catalog ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/categories', (_req, res) => {
  res.json(db.categories.map((c) => ({ ...c, productCount: db.products.filter((p) => p.category === c.id).length })));
});

app.get('/api/products', (req, res) => {
  const { category, q, sort = 'featured', minPrice, maxPrice, inStock, featured } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
  let items = [...db.products];

  if (category) items = items.filter((p) => p.category === category);
  if (q) {
    const s = String(q).toLowerCase().trim();
    items = items.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }
  if (minPrice !== undefined && minPrice !== '') items = items.filter((p) => p.price >= Number(minPrice));
  if (maxPrice !== undefined && maxPrice !== '') items = items.filter((p) => p.price <= Number(maxPrice));
  if (inStock === 'true') items = items.filter((p) => p.stock > 0);
  if (featured === 'true') items = items.filter((p) => p.featured);

  const sorters = {
    featured: (a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  items.sort(sorters[sort] || sorters.featured);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  res.json({ items: items.slice(start, start + limit), total, page, limit, totalPages });
});

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---------- auth ----------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.status === 'locked') {
    return res.status(403).json({ error: 'Your account has been locked. Please contact support.' });
  }
  if (user.slow) await sleep(SLOW_USER_DELAY_MS);
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  const fields = {};
  if (!name || String(name).trim().length < 2) fields.name = 'Name must be at least 2 characters';
  if (!isEmail(email)) fields.email = 'Please enter a valid email address';
  if (!password || String(password).length < 8 || !/\d/.test(password)) {
    fields.password = 'Password must be at least 8 characters and contain a number';
  }
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())) {
    return res.status(409).json({ error: 'An account with this email already exists', fields: { email: 'Email already registered' } });
  }
  const user = {
    id: db.nextUserId++,
    email: email.toLowerCase().trim(),
    password,
    name: String(name).trim(),
    role: 'customer',
    status: 'active',
    phone: '',
    address: null,
  };
  db.users.push(user);
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) revokedTokens.add(token);
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

app.put('/api/account', requireAuth, (req, res) => {
  const { name, phone, address, avatar } = req.body || {};
  const fields = {};
  if (name !== undefined && String(name).trim().length < 2) fields.name = 'Name must be at least 2 characters';
  if (phone && !/^[+\d][\d\s-]{5,}$/.test(phone)) fields.phone = 'Please enter a valid phone number';
  if (address?.zip && !/^\d{5}$/.test(address.zip)) fields.zip = 'ZIP code must be 5 digits';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });
  if (name !== undefined) req.user.name = String(name).trim();
  if (phone !== undefined) req.user.phone = phone;
  if (address !== undefined) req.user.address = address;
  if (avatar !== undefined) req.user.avatar = avatar;
  res.json(publicUser(req.user));
});

// ---------- cart pricing ----------
app.post('/api/cart/quote', (req, res) => {
  const { items = [], promoCode, shippingMethod } = req.body || {};
  const { lines, error, status } = resolveLines(items);
  if (error) return res.status(status).json({ error });
  const subtotal = round(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const { promo, error: promoError } = resolvePromo(promoCode, subtotal);
  const totals = computeTotals(lines, shippingMethod, promo);
  res.json({
    ...totals,
    promo: promo ? { code: promo.code, description: promo.description } : null,
    promoError: promoError || null,
  });
});

// ---------- orders ----------
app.post('/api/orders', requireAuth, (req, res) => {
  const { items, shipping = {}, payment = {}, shippingMethod = 'standard', promoCode } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty' });

  const { lines, error, status } = resolveLines(items);
  if (error) return res.status(status).json({ error });

  // Validate stock (sum quantities of the same product across options)
  const qtyByProduct = {};
  for (const l of lines) qtyByProduct[l.productId] = (qtyByProduct[l.productId] || 0) + l.qty;
  for (const [id, qty] of Object.entries(qtyByProduct)) {
    const product = db.products.find((p) => p.id === Number(id));
    if (product.stock === 0) return res.status(409).json({ error: `"${product.name}" is out of stock` });
    if (qty > product.stock) {
      return res.status(409).json({ error: `Only ${product.stock} of "${product.name}" left in stock` });
    }
  }

  if (!SHIPPING_METHODS[shippingMethod]) return res.status(400).json({ error: 'Invalid shipping method' });

  const fields = {};
  if (!shipping.fullName?.trim()) fields.fullName = 'Full name is required';
  if (!shipping.line1?.trim()) fields.line1 = 'Address is required';
  if (!shipping.city?.trim()) fields.city = 'City is required';
  if (!/^\d{5}$/.test(shipping.zip || '')) fields.zip = 'ZIP code must be 5 digits';
  if (!shipping.country) fields.country = 'Country is required';

  const cardNumber = String(payment.cardNumber || '').replace(/[\s-]/g, '');
  if (!payment.nameOnCard?.trim()) fields.nameOnCard = 'Name on card is required';
  if (!/^\d{13,19}$/.test(cardNumber) || !luhnValid(cardNumber)) fields.cardNumber = 'Invalid card number';
  const exp = /^(\d{2})\/(\d{2})$/.exec(payment.expiry || '');
  if (!exp || Number(exp[1]) < 1 || Number(exp[1]) > 12) {
    fields.expiry = 'Expiry must be in MM/YY format';
  } else {
    const expEnd = new Date(2000 + Number(exp[2]), Number(exp[1]), 1); // first day of the following month
    if (expEnd <= new Date()) fields.expiry = 'Card has expired';
  }
  if (!/^\d{3,4}$/.test(payment.cvc || '')) fields.cvc = 'CVC must be 3 or 4 digits';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Validation failed', fields });

  // Simulated payment processor responses
  if (cardNumber === '4000000000000002') return res.status(402).json({ error: 'Your card was declined.' });
  if (cardNumber === '4000000000009995') return res.status(402).json({ error: 'Insufficient funds.' });

  const subtotal = round(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const { promo, error: promoError } = resolvePromo(promoCode, subtotal);
  if (promoError) return res.status(400).json({ error: promoError });
  const totals = computeTotals(lines, shippingMethod, promo);

  for (const l of lines) l.product.stock -= l.qty;

  const order = {
    id: `ORD-${db.nextOrderNumber++}`,
    userId: req.user.id,
    createdAt: new Date().toISOString(),
    status: 'Processing',
    items: lines.map(({ product, ...l }) => l),
    shipping: {
      fullName: shipping.fullName.trim(),
      line1: shipping.line1.trim(),
      city: shipping.city.trim(),
      zip: shipping.zip,
      country: shipping.country,
      phone: shipping.phone || '',
    },
    shippingMethod,
    payment: { brand: cardBrand(cardNumber), last4: cardNumber.slice(-4) },
    promoCode: promo?.code || null,
    totals,
  };
  db.orders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = db.orders.filter((o) => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(orders);
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'Processing') {
    return res.status(409).json({ error: `Orders with status "${order.status}" cannot be cancelled` });
  }
  order.status = 'Cancelled';
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product) product.stock += item.qty;
  }
  res.json(order);
});

// ---------- admin ----------
app.get('/api/admin/orders', requireAuth, requireAdmin, (_req, res) => {
  res.json(
    db.orders
      .map((o) => ({ ...o, customerEmail: db.users.find((u) => u.id === o.userId)?.email }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
});

app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
  res.json(db.users.map(publicUser));
});

app.patch('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
  const product = db.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const stock = Number(req.body?.stock);
  if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative integer' });
  product.stock = stock;
  res.json(product);
});

// ---------- test helpers ----------
// Reset all data (products, users, orders) to the seed state. Handy in beforeEach / globalSetup.
app.post('/api/test/reset', (_req, res) => {
  db = createSeed();
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- production: serve the built frontend ----------
const distDir = path.join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`PlayShop API listening on http://localhost:${PORT}`);
});
