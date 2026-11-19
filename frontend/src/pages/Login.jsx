import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/common/Icons';
import Spinner from '../components/common/Spinner';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@ems.io', password: 'admin123' },
  { label: 'Operator', email: 'operator@ems.io', password: 'operator123' },
  { label: 'Viewer', email: 'viewer@ems.io', password: 'viewer123' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in? Go to the dashboard.
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (account) => setForm({ email: account.email, password: account.password });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-mark brand-mark-lg"><Icon name="drop" size={22} /></span>
          <h1>EcoWatch</h1>
          <p>Air &amp; Water Quality Monitoring</p>
        </div>

        <h2 className="auth-title">Sign in</h2>
        <p className="auth-sub">Access the environmental dashboard.</p>

        {error && <div className="banner banner-error mb-14">{error}</div>}

        <form onSubmit={submit} noValidate>
          <div className="form-field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              placeholder="you@ems.io"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-field mt-14">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block mt-18" disabled={busy}>
            {busy ? <Spinner label="Signing in…" /> : 'Sign in'}
          </button>
        </form>

        <div className="demo-box mt-18">
          <p className="demo-title">Demo accounts (click to fill)</p>
          <div className="demo-row">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="chip" onClick={() => fill(a)}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="hint">admin@ems.io · operator@ems.io · viewer@ems.io — password is the role name + 123</p>
        </div>

        <p className="auth-alt">
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
