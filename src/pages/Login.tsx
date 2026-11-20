import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={redirect} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const u = await login(email, password);
      toast(`Welcome back, ${u.name.split(' ')[0]}!`);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card card">
      <h1>Sign in</h1>
      {params.get('redirect') && <p className="alert alert-info">Please sign in to continue.</p>}
      {error && (
        <p className="alert alert-error" role="alert" data-testid="login-error">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="row">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p>
        New to PlayShop? <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Create an account</Link>
      </p>

      <details className="demo-accounts">
        <summary>Demo accounts</summary>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Password</th>
              <th>Behaviour</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>alice@example.com</td><td>Password123!</td><td>Customer with an order history</td></tr>
            <tr><td>bob@example.com</td><td>Password123!</td><td>Customer, no orders</td></tr>
            <tr><td>locked@example.com</td><td>Password123!</td><td>Locked – login fails</td></tr>
            <tr><td>slow@example.com</td><td>Password123!</td><td>Every request takes ~2.5s</td></tr>
            <tr><td>admin@example.com</td><td>Admin123!</td><td>Admin panel access</td></tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}
