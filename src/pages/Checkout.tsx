import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, money, type Order, type Quote } from '../api';
import OrderSummary from '../components/OrderSummary';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import { useToast } from '../context/useToast';

type Step = 'shipping' | 'payment' | 'review';
type Errors = Record<string, string>;

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'UA', name: 'Ukraine' },
];

const formatCardNumber = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="error-text">
      {error}
    </p>
  ) : null;
}

export default function Checkout() {
  const { user } = useAuth();
  const { items, promoCode, clear } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('shipping');
  const [shipping, setShipping] = useState({
    fullName: user?.name ?? '',
    line1: user?.address?.line1 ?? '',
    city: user?.address?.city ?? '',
    zip: user?.address?.zip ?? '',
    country: user?.address?.country ?? 'US',
    phone: user?.phone ?? '',
  });
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [payment, setPayment] = useState({ nameOnCard: '', cardNumber: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const cartPayload = items.map((i) => ({ productId: i.productId, qty: i.qty, option: i.option }));
  const itemCount = items.reduce((n, i) => n + i.qty, 0);

  useEffect(() => {
    if (!items.length) return;
    api<Quote>('/cart/quote', { method: 'POST', body: { items: cartPayload, promoCode, shippingMethod } }).then(setQuote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethod, promoCode, items.length]);

  if (!items.length && !placing) return <Navigate to="/cart" replace />;

  const steps: { id: Step; label: string }[] = [
    { id: 'shipping', label: '1. Shipping' },
    { id: 'payment', label: '2. Payment' },
    { id: 'review', label: '3. Review' },
  ];

  const validateShipping = () => {
    const e: Errors = {};
    if (!shipping.fullName.trim()) e.fullName = 'Full name is required';
    if (!shipping.line1.trim()) e.line1 = 'Address is required';
    if (!shipping.city.trim()) e.city = 'City is required';
    if (!/^\d{5}$/.test(shipping.zip)) e.zip = 'ZIP code must be 5 digits';
    if (shipping.phone && !/^[+\d][\d\s-]{5,}$/.test(shipping.phone)) e.phone = 'Please enter a valid phone number';
    return e;
  };

  const validatePayment = () => {
    const e: Errors = {};
    if (!payment.nameOnCard.trim()) e.nameOnCard = 'Name on card is required';
    if (payment.cardNumber.replace(/\s/g, '').length < 13) e.cardNumber = 'Please enter a valid card number';
    const m = /^(\d{2})\/(\d{2})$/.exec(payment.expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = 'Expiry must be in MM/YY format';
    if (!/^\d{3,4}$/.test(payment.cvc)) e.cvc = 'CVC must be 3 or 4 digits';
    return e;
  };

  const next = (validate: () => Errors, to: Step) => (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setOrderError(null);
      setStep(to);
    }
  };

  const placeOrder = async () => {
    if (!acceptTerms) {
      setErrors({ terms: 'You must accept the terms and conditions' });
      return;
    }
    setErrors({});
    setOrderError(null);
    setPlacing(true);
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        body: { items: cartPayload, shipping, payment, shippingMethod, promoCode },
      });
      clear();
      toast('Order placed successfully!');
      navigate(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (err) {
      setPlacing(false);
      if (err instanceof ApiError) {
        setOrderError(err.message);
        if (Object.keys(err.fields).length) setErrors(err.fields);
      } else {
        setOrderError('Something went wrong. Please try again.');
      }
    }
  };

  const inputProps = (group: 'shipping' | 'payment', key: string) => ({
    id: key,
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
    value: group === 'shipping' ? shipping[key as keyof typeof shipping] : payment[key as keyof typeof payment],
  });

  return (
    <div className="checkout">
      <h1>Checkout</h1>
      <ol className="steps" aria-label="Checkout progress">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={s.id === step ? 'active' : steps.findIndex((x) => x.id === step) > i ? 'done' : ''}
            aria-current={s.id === step ? 'step' : undefined}
          >
            {s.label}
          </li>
        ))}
      </ol>

      <div className="checkout-grid">
        <section className="card">
          {step === 'shipping' && (
            <form onSubmit={next(validateShipping, 'payment')} noValidate aria-label="Shipping address">
              <h2>Shipping address</h2>
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  {...inputProps('shipping', 'fullName')}
                  autoComplete="name"
                  onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}
                />
                <FieldError id="fullName" error={errors.fullName} />
              </div>
              <div className="field">
                <label htmlFor="line1">Street address</label>
                <input
                  {...inputProps('shipping', 'line1')}
                  autoComplete="address-line1"
                  onChange={(e) => setShipping({ ...shipping, line1: e.target.value })}
                />
                <FieldError id="line1" error={errors.line1} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input
                    {...inputProps('shipping', 'city')}
                    autoComplete="address-level2"
                    onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                  />
                  <FieldError id="city" error={errors.city} />
                </div>
                <div className="field">
                  <label htmlFor="zip">ZIP code</label>
                  <input
                    {...inputProps('shipping', 'zip')}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    onChange={(e) => setShipping({ ...shipping, zip: e.target.value })}
                  />
                  <FieldError id="zip" error={errors.zip} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <select {...inputProps('shipping', 'country')} onChange={(e) => setShipping({ ...shipping, country: e.target.value })}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone (optional)</label>
                  <input
                    {...inputProps('shipping', 'phone')}
                    type="tel"
                    autoComplete="tel"
                    onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                  />
                  <FieldError id="phone" error={errors.phone} />
                </div>
              </div>

              <fieldset className="shipping-methods">
                <legend>Delivery method</legend>
                <label className={`radio-card ${shippingMethod === 'standard' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="standard"
                    checked={shippingMethod === 'standard'}
                    onChange={() => setShippingMethod('standard')}
                  />
                  <span>
                    <strong>Standard</strong> – 5–7 business days
                    <br />
                    <span className="muted">$5.99, free over $50</span>
                  </span>
                </label>
                <label className={`radio-card ${shippingMethod === 'express' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="express"
                    checked={shippingMethod === 'express'}
                    onChange={() => setShippingMethod('express')}
                  />
                  <span>
                    <strong>Express</strong> – 1–2 business days
                    <br />
                    <span className="muted">$14.99</span>
                  </span>
                </label>
              </fieldset>

              <div className="row-between">
                <Link to="/cart">← Back to cart</Link>
                <button type="submit" className="btn btn-primary">
                  Continue to payment
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && (
            <form onSubmit={next(validatePayment, 'review')} noValidate aria-label="Payment details">
              <h2>Payment details</h2>
              <p className="alert alert-info small">
                🧪 Sandbox – use test card <code>4242 4242 4242 4242</code>, any future expiry and any CVC.
              </p>
              <div className="field">
                <label htmlFor="nameOnCard">Name on card</label>
                <input
                  {...inputProps('payment', 'nameOnCard')}
                  autoComplete="cc-name"
                  onChange={(e) => setPayment({ ...payment, nameOnCard: e.target.value })}
                />
                <FieldError id="nameOnCard" error={errors.nameOnCard} />
              </div>
              <div className="field">
                <label htmlFor="cardNumber">Card number</label>
                <input
                  {...inputProps('payment', 'cardNumber')}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  onChange={(e) => setPayment({ ...payment, cardNumber: formatCardNumber(e.target.value) })}
                />
                <FieldError id="cardNumber" error={errors.cardNumber} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="expiry">Expiry (MM/YY)</label>
                  <input
                    {...inputProps('payment', 'expiry')}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    onChange={(e) => setPayment({ ...payment, expiry: formatExpiry(e.target.value) })}
                  />
                  <FieldError id="expiry" error={errors.expiry} />
                </div>
                <div className="field">
                  <label htmlFor="cvc">CVC</label>
                  <input
                    {...inputProps('payment', 'cvc')}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    onChange={(e) => setPayment({ ...payment, cvc: e.target.value.replace(/\D/g, '') })}
                  />
                  <FieldError id="cvc" error={errors.cvc} />
                </div>
              </div>
              <div className="row-between">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('shipping')}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-primary">
                  Review order
                </button>
              </div>
            </form>
          )}

          {step === 'review' && (
            <div aria-label="Review order" role="region">
              <h2>Review your order</h2>
              {orderError && (
                <div className="alert alert-error" role="alert" data-testid="order-error">
                  {orderError}{' '}
                  <button className="btn btn-link" onClick={() => setStep('payment')}>
                    Edit payment
                  </button>
                </div>
              )}
              <div className="review-grid">
                <div>
                  <h3>Ship to</h3>
                  <address data-testid="review-address">
                    {shipping.fullName}
                    <br />
                    {shipping.line1}
                    <br />
                    {shipping.city}, {shipping.zip}
                    <br />
                    {COUNTRIES.find((c) => c.code === shipping.country)?.name}
                  </address>
                  <button className="btn btn-link" onClick={() => setStep('shipping')}>
                    Change
                  </button>
                </div>
                <div>
                  <h3>Payment</h3>
                  <p data-testid="review-payment">Card ending in {payment.cardNumber.replace(/\s/g, '').slice(-4)}</p>
                  <button className="btn btn-link" onClick={() => setStep('payment')}>
                    Change
                  </button>
                </div>
              </div>
              <h3>Items</h3>
              <ul className="review-items">
                {items.map((i) => (
                  <li key={i.key}>
                    <span>
                      {i.emoji} {i.name}
                      {i.option && ` (Size ${i.option})`} × {i.qty}
                    </span>
                    <span>{money(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <label className="checkbox">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />I have read and agree to
                the{' '}
                <a href="/terms" target="_blank" rel="noopener">
                  Terms &amp; Conditions
                </a>
              </label>
              <FieldError id="terms" error={errors.terms} />
              <div className="row-between">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('payment')} disabled={placing}>
                  ← Back
                </button>
                <button className="btn btn-primary btn-lg" onClick={placeOrder} disabled={placing}>
                  {placing ? 'Placing order…' : `Place order${quote ? ` · ${money(quote.total)}` : ''}`}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="card" aria-label="Order summary">
          <h2>Summary</h2>
          <p className="muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{shippingMethod === 'express' ? 'Express' : 'Standard'} delivery
          </p>
          <OrderSummary totals={quote} promoCode={promoCode} />
        </aside>
      </div>
    </div>
  );
}
