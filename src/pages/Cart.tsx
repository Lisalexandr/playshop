import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money, type Quote } from '../api';
import OrderSummary from '../components/OrderSummary';
import { ProductImage } from '../components/ProductCard';
import { MAX_QTY, useCart } from '../context/useCart';
import { useToast } from '../context/useToast';

export default function Cart() {
  const { items, updateQty, remove, clear, promoCode, setPromoCode, count } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const cartPayload = items.map((i) => ({ productId: i.productId, qty: i.qty, option: i.option }));

  const quoteKey = JSON.stringify([cartPayload, promoCode]);
  const [prevQuoteKey, setPrevQuoteKey] = useState<string | null>(null);
  if (quoteKey !== prevQuoteKey) {
    setPrevQuoteKey(quoteKey);
    if (items.length === 0) setQuote(null);
    else setQuoteLoading(true);
  }

  useEffect(() => {
    if (items.length === 0) return;
    api<Quote>('/cart/quote', { method: 'POST', body: { items: cartPayload, promoCode } })
      .then((q) => {
        setQuote(q);
        // A previously applied code can become invalid (e.g. WELCOME20 when subtotal drops below $100)
        if (q.promoError && promoCode) {
          setPromoCode(null);
          setPromoError(q.promoError);
        }
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const applyPromo = async (e: FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim();
    if (!code) {
      setPromoError('Please enter a promo code');
      return;
    }
    setApplying(true);
    setPromoError(null);
    try {
      const q = await api<Quote>('/cart/quote', { method: 'POST', body: { items: cartPayload, promoCode: code } });
      if (q.promoError) {
        setPromoError(q.promoError);
      } else {
        setPromoCode(q.promo!.code);
        setPromoInput('');
        toast(`Promo code ${q.promo!.code} applied`);
      }
    } finally {
      setApplying(false);
    }
  };

  const onRemove = (key: string, name: string) => {
    if (window.confirm(`Remove "${name}" from your cart?`)) {
      remove(key);
      toast(`Removed "${name}" from cart`, 'info');
    }
  };

  const onClear = () => {
    if (window.confirm('Remove all items from your cart?')) clear();
  };

  if (items.length === 0) {
    return (
      <section className="empty-state" data-testid="empty-cart">
        <h1>Your cart is empty</h1>
        <p>Looks like you haven’t added anything yet.</p>
        <Link to="/products" className="btn btn-primary">
          Continue shopping
        </Link>
      </section>
    );
  }

  return (
    <div className="cart-page">
      <section>
        <div className="row-between">
          <h1>
            Shopping cart ({count} {count === 1 ? 'item' : 'items'})
          </h1>
          <button className="btn btn-ghost" onClick={onClear}>
            Clear cart
          </button>
        </div>
        <ul className="cart-items" aria-label="Cart items">
          {items.map((item) => (
            <li key={item.key} className="cart-item" data-testid="cart-item" data-product-id={item.productId}>
              <ProductImage product={item} size="sm" />
              <div className="cart-item-info">
                <Link to={`/products/${item.productId}`} className="cart-item-name">
                  {item.name}
                </Link>
                {item.option && <span className="muted">Size: {item.option}</span>}
                <span className="muted">{money(item.price)} each</span>
              </div>
              <label className="cart-item-qty">
                <span className="sr-only">Quantity for {item.name}</span>
                <select
                  value={item.qty}
                  aria-label={`Quantity for ${item.name}`}
                  onChange={(e) => updateQty(item.key, Number(e.target.value))}
                >
                  {Array.from({ length: Math.min(MAX_QTY, item.stock) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <strong className="cart-item-total" data-testid="line-total">
                {money(item.price * item.qty)}
              </strong>
              <button className="btn btn-link" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key, item.name)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <Link to="/products">← Continue shopping</Link>
      </section>

      <aside className="card cart-sidebar" aria-label="Order summary">
        <h2>Order summary</h2>

        {promoCode ? (
          <div className="promo-applied" data-testid="promo-applied">
            <span>
              🏷️ <strong>{promoCode}</strong> {quote?.promo?.description && `– ${quote.promo.description}`}
            </span>
            <button className="btn btn-link" onClick={() => setPromoCode(null)}>
              Remove code
            </button>
          </div>
        ) : (
          <form onSubmit={applyPromo} className="promo-form" noValidate>
            <label htmlFor="promo">Promo code</label>
            <div className="row">
              <input
                id="promo"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="e.g. SAVE10"
                aria-invalid={Boolean(promoError)}
                aria-describedby={promoError ? 'promo-error' : undefined}
              />
              <button className="btn btn-secondary" type="submit" disabled={applying}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
            {promoError && (
              <p id="promo-error" className="error-text" role="alert">
                {promoError}
              </p>
            )}
          </form>
        )}

        <OrderSummary totals={quote} promoCode={promoCode} loading={quoteLoading} />
        <p className="muted small">Shipping shown for Standard delivery. Free standard shipping on orders over $50.</p>
        <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/checkout')}>
          Proceed to checkout
        </button>
      </aside>
    </div>
  );
}
