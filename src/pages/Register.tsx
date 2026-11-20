import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type Fields = 'name' | 'email' | 'password' | 'confirm' | 'terms';

export default function Register() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={redirect} replace />;

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<Fields, string>> = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address';
    if (form.password.length < 8 || !/\d/.test(form.password)) {
      e.password = 'Password must be at least 8 characters and contain a number';
    }
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    if (!form.terms) e.terms = 'You must accept the terms and conditions';
    return e;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      toast('Account created successfully!');
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setErrors(err.fields as Partial<Record<Fields, string>>);
      } else {
        setFormError('Something went wrong');
      }
      setSubmitting(false);
    }
  };

  const field = (k: 'name' | 'email' | 'password' | 'confirm', label: string, type = 'text', autoComplete?: string) => (
    <div className="field">
      <label htmlFor={`reg-${k}`}>{label}</label>
      <input
        id={`reg-${k}`}
        type={type}
        autoComplete={autoComplete}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `reg-${k}-error` : undefined}
      />
      {errors[k] && (
        <p id={`reg-${k}-error`} className="error-text">
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <section className="auth-card card">
      <h1>Create account</h1>
      {formError && (
        <p className="alert alert-error" role="alert">
          {formError}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        {field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        {field('confirm', 'Confirm password', 'password', 'new-password')}
        <div className="field">
          <label className="checkbox">
            <input type="checkbox" checked={form.terms} onChange={(e) => set('terms', e.target.checked)} />I agree to the{' '}
            <Link to="/terms" target="_blank" rel="noopener">
              Terms &amp; Conditions
            </Link>
          </label>
          {errors.terms && <p className="error-text">{errors.terms}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
