import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, type User } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Account() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user!.name,
    phone: user!.phone ?? '',
    line1: user!.address?.line1 ?? '',
    city: user!.address?.city ?? '',
    zip: user!.address?.zip ?? '',
    country: user!.address?.country ?? 'US',
  });
  const [avatar, setAvatar] = useState<string | undefined>(user!.avatar);
  const [avatarName, setAvatarName] = useState<string>('');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (PNG, JPG, GIF, SVG).');
      return;
    }
    if (file.size > 1024 * 1024) {
      setAvatarError('Image must be smaller than 1 MB.');
      return;
    }
    setAvatarName(file.name);
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = await api<User>('/account', {
        method: 'PUT',
        body: {
          name: form.name,
          phone: form.phone,
          avatar,
          address: form.line1 || form.city || form.zip ? { line1: form.line1, city: form.city, zip: form.zip, country: form.country } : null,
        },
      });
      setUser(updated);
      toast('Profile updated');
    } catch (err) {
      if (err instanceof ApiError) setErrors({ form: err.message, ...err.fields });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="account">
      <h1>My account</h1>
      <div className="checkout-grid">
        <form className="card" onSubmit={onSubmit} noValidate aria-label="Profile">
          <h2>Profile</h2>
          {errors.form && (
            <p className="alert alert-error" role="alert">
              {errors.form}
            </p>
          )}
          <div className="field">
            <label htmlFor="acc-email">Email</label>
            <input id="acc-email" value={user!.email} disabled readOnly />
          </div>
          <div className="field">
            <label htmlFor="acc-name">Full name</label>
            <input id="acc-name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor="acc-phone">Phone</label>
            <input id="acc-phone" type="tel" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <p className="error-text">{errors.phone}</p>}
          </div>
          <h3>Default shipping address</h3>
          <div className="field">
            <label htmlFor="acc-line1">Street address</label>
            <input id="acc-line1" value={form.line1} onChange={set('line1')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="acc-city">City</label>
              <input id="acc-city" value={form.city} onChange={set('city')} />
            </div>
            <div className="field">
              <label htmlFor="acc-zip">ZIP code</label>
              <input id="acc-zip" value={form.zip} onChange={set('zip')} aria-invalid={Boolean(errors.zip)} />
              {errors.zip && <p className="error-text">{errors.zip}</p>}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <aside className="card">
          <h2>Avatar</h2>
          <div className="avatar" data-testid="avatar-preview">
            {avatar ? <img src={avatar} alt="Your avatar" /> : <span aria-label="No avatar">{user!.name[0]}</span>}
          </div>
          <label htmlFor="avatar-upload" className="btn btn-secondary">
            Upload picture
          </label>
          <input id="avatar-upload" type="file" accept="image/*" className="sr-only" onChange={onAvatar} />
          {avatarName && <p className="muted small" data-testid="avatar-filename">{avatarName}</p>}
          {avatarError && (
            <p className="error-text" role="alert">
              {avatarError}
            </p>
          )}
          <p className="muted small">Click “Save changes” to keep your new picture.</p>
          <p className="muted small">
            Role: <strong data-testid="user-role">{user!.role}</strong>
          </p>
        </aside>
      </div>
    </section>
  );
}
