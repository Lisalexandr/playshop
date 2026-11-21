import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, type Order } from '../api';

export function StatusBadge({ status }: { status: Order['status'] }) {
  return (
    <span className={`status status-${status.toLowerCase()}`} data-testid="order-status">
      {status}
    </span>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Order[]>('/orders')
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <p className="alert alert-error" role="alert">
        {error}
      </p>
    );
  if (!orders)
    return (
      <div className="spinner" role="progressbar" aria-label="Loading orders">
        Loading orders…
      </div>
    );

  if (orders.length === 0) {
    return (
      <section className="empty-state" data-testid="no-orders">
        <h1>My orders</h1>
        <p>You haven’t placed any orders yet.</p>
        <Link to="/products" className="btn btn-primary">
          Start shopping
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1>My orders</h1>
      <table className="table" aria-label="Orders">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Date</th>
            <th scope="col">Items</th>
            <th scope="col">Total</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} data-testid="order-row">
              <td>
                <Link to={`/orders/${o.id}`}>{o.id}</Link>
              </td>
              <td>{new Date(o.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
              <td>{o.items.reduce((n, i) => n + i.qty, 0)}</td>
              <td>{money(o.totals.total)}</td>
              <td>
                <StatusBadge status={o.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
