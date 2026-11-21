import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, money, type Order } from '../api';
import OrderSummary from '../components/OrderSummary';
import { useToast } from '../context/useToast';
import { StatusBadge } from './Orders';

function downloadInvoice(order: Order) {
  const lines = [
    'PLAYSHOP INVOICE',
    '================',
    `Order:   ${order.id}`,
    `Date:    ${new Date(order.createdAt).toISOString().slice(0, 10)}`,
    `Status:  ${order.status}`,
    '',
    'Items',
    '-----',
    ...order.items.map(
      (i) => `${i.qty} x ${i.name}${i.option ? ` (Size ${i.option})` : ''} @ ${money(i.price)} = ${money(i.qty * i.price)}`,
    ),
    '',
    `Subtotal: ${money(order.totals.subtotal)}`,
    `Discount: -${money(order.totals.discount)}`,
    `Shipping: ${money(order.totals.shipping)}`,
    `Tax:      ${money(order.totals.tax)}`,
    `TOTAL:    ${money(order.totals.total)}`,
    '',
    `Ship to: ${order.shipping.fullName}, ${order.shipping.line1}, ${order.shipping.city} ${order.shipping.zip}, ${order.shipping.country}`,
    `Paid with ${order.payment.brand} ending in ${order.payment.last4}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${order.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const justPlaced = params.get('placed') === '1';

  useEffect(() => {
    api<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? 'Order not found' : e.message));
  }, [id]);

  const onCancel = async () => {
    if (!order || !window.confirm(`Are you sure you want to cancel order ${order.id}?`)) return;
    setCancelling(true);
    try {
      setOrder(await api<Order>(`/orders/${order.id}/cancel`, { method: 'POST' }));
      toast('Order cancelled', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <section className="empty-state">
        <h1>{error}</h1>
        <Link to="/orders" className="btn btn-primary">
          Back to my orders
        </Link>
      </section>
    );
  }
  if (!order)
    return (
      <div className="spinner" role="progressbar" aria-label="Loading order">
        Loading…
      </div>
    );

  return (
    <section className="order-detail" data-testid="order-detail">
      {justPlaced && (
        <div className="confirmation" role="status" data-testid="order-confirmation">
          <h1>🎉 Thank you for your order!</h1>
          <p>
            Your order number is <strong data-testid="order-number">{order.id}</strong>. A confirmation email is on its way (not really –
            this is a sandbox).
          </p>
        </div>
      )}
      <div className="row-between">
        <h2>
          Order {order.id} <StatusBadge status={order.status} />
        </h2>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => downloadInvoice(order)}>
            Download invoice
          </button>
          {order.status === 'Processing' && (
            <button className="btn btn-danger" onClick={onCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </div>
      </div>
      <p className="muted">Placed on {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>

      <div className="checkout-grid">
        <div className="card">
          <h3>Items</h3>
          <table className="table" aria-label="Order items">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Qty</th>
                <th scope="col">Price</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={`${i.productId}-${i.option}`}>
                  <td>
                    {i.emoji} <Link to={`/products/${i.productId}`}>{i.name}</Link>
                    {i.option && <span className="muted"> · Size {i.option}</span>}
                  </td>
                  <td>{i.qty}</td>
                  <td>{money(i.price)}</td>
                  <td>{money(i.price * i.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="review-grid">
            <div>
              <h3>Shipping to</h3>
              <address>
                {order.shipping.fullName}
                <br />
                {order.shipping.line1}
                <br />
                {order.shipping.city}, {order.shipping.zip}, {order.shipping.country}
              </address>
              <p className="muted">{order.shippingMethod === 'express' ? 'Express' : 'Standard'} delivery</p>
            </div>
            <div>
              <h3>Payment</h3>
              <p>
                {order.payment.brand} ending in {order.payment.last4}
              </p>
            </div>
          </div>
        </div>
        <aside className="card">
          <h3>Summary</h3>
          <OrderSummary totals={order.totals} promoCode={order.promoCode} />
        </aside>
      </div>
      <Link to="/orders">← All orders</Link>
    </section>
  );
}
