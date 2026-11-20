import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ ok: false, text: 'Please enter a valid email address.' });
      return;
    }
    setMessage({ ok: true, text: `Thanks! ${email} is subscribed.` });
    setEmail('');
  };

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <strong>PlayShop</strong>
          <p className="muted">A sandbox store for practicing end-to-end testing. Nothing here is real.</p>
        </div>
        <nav aria-label="Footer">
          <Link to="/products">Shop all</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/orders">My orders</Link>
        </nav>
        <form onSubmit={onSubscribe} className="newsletter" noValidate>
          <label htmlFor="newsletter-email">Subscribe to our newsletter</label>
          <div className="row">
            <input
              id="newsletter-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Subscribe
            </button>
          </div>
          {message && (
            <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'success-text' : 'error-text'}>
              {message.text}
            </p>
          )}
        </form>
      </div>
    </footer>
  );
}
