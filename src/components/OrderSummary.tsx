import { money, type Totals } from '../api';

export default function OrderSummary({
  totals,
  promoCode,
  loading,
}: {
  totals: Totals | null;
  promoCode?: string | null;
  loading?: boolean;
}) {
  return (
    <dl className="summary" data-testid="order-summary" aria-busy={loading ? 'true' : 'false'}>
      {!totals ? (
        <p className="muted">Calculating…</p>
      ) : (
        <>
          <div>
            <dt>Subtotal</dt>
            <dd data-testid="summary-subtotal">{money(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="discount">
              <dt>Discount{promoCode ? ` (${promoCode})` : ''}</dt>
              <dd data-testid="summary-discount">-{money(totals.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Shipping</dt>
            <dd data-testid="summary-shipping">{totals.shipping === 0 ? 'FREE' : money(totals.shipping)}</dd>
          </div>
          <div>
            <dt>Tax (8%)</dt>
            <dd data-testid="summary-tax">{money(totals.tax)}</dd>
          </div>
          <div className="total">
            <dt>Total</dt>
            <dd data-testid="order-total">{money(totals.total)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
