import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, type Order, type ProductPage, type Product, type User } from '../api';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from './Orders';

type Tab = 'orders' | 'inventory' | 'users';

export default function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const [o, p, u] = await Promise.all([
      api<Order[]>('/admin/orders'),
      api<ProductPage>('/products?sort=name'),
      api<User[]>('/admin/users'),
    ]);
    setOrders(o);
    setProducts(p.items);
    setUsers(u);
    setStockDrafts(Object.fromEntries(p.items.map((x) => [x.id, String(x.stock)])));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveStock = async (p: Product) => {
    try {
      await api(`/admin/products/${p.id}`, { method: 'PATCH', body: { stock: Number(stockDrafts[p.id]) } });
      toast(`Stock for "${p.name}" updated`);
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset ALL sandbox data (products, users, orders) to the initial state?')) return;
    await api('/test/reset', { method: 'POST' });
    toast('Sandbox data has been reset', 'info');
    load();
  };

  const revenue = orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.totals.total, 0);

  return (
    <section>
      <div className="row-between">
        <h1>Admin panel</h1>
        <button className="btn btn-danger" onClick={reset}>
          Reset sandbox data
        </button>
      </div>

      <div className="stats">
        <div className="card stat">
          <span className="muted">Orders</span>
          <strong data-testid="stat-orders">{orders.length}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Revenue</span>
          <strong data-testid="stat-revenue">{money(revenue)}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Users</span>
          <strong data-testid="stat-users">{users.length}</strong>
        </div>
      </div>

      <div className="tabs">
        <div role="tablist" aria-label="Admin sections">
          {(['orders', 'inventory', 'users'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'orders' && (
            <table className="table" aria-label="All orders">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Date</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>{o.id}</Link>
                    </td>
                    <td>{o.customerEmail}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
                    <td>{money(o.totals.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'inventory' && (
            <table className="table" aria-label="Inventory">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.emoji} {p.name}
                    </td>
                    <td>{p.category}</td>
                    <td>{money(p.price)}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="input-sm"
                        aria-label={`Stock for ${p.name}`}
                        value={stockDrafts[p.id] ?? ''}
                        onChange={(e) => setStockDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        disabled={stockDrafts[p.id] === String(p.stock)}
                        onClick={() => saveStock(p)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'users' && (
            <table className="table" aria-label="Users">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
