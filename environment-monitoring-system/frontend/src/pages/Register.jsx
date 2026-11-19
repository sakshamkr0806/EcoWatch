import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/common/Icons';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'OPERATOR' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-mark brand-mark-lg"><Icon name="drop" size={22} /></span>
          <h1>EnvMonitor</h1>
          <p>Air &amp; Water Quality Monitoring</p>
        </div>

        <h2 className="auth-title">Create account</h2>
        <p className="auth-sub">Join the monitoring team.</p>

        {serverError && <div className="banner banner-error mb-14">{serverError}</div>}

        <form onSubmit={submit} noValidate>
          <div className="form-field">
            <label className="label" htmlFor="reg-name">Full name</label>
            <input id="reg-name" className="input" value={form.name} onChange={set('name')} placeholder="Your name" />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div className="form-field mt-14">
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" className="input" value={form.email} onChange={set('email')} placeholder="you@ems.io" />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div className="form-grid mt-14">
            <div className="form-field">
              <label className="label" htmlFor="reg-pass">Password</label>
              <input id="reg-pass" type="password" className="input" value={form.password} onChange={set('password')} placeholder="min. 6 characters" />
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>
            <div className="form-field">
              <label className="label" htmlFor="reg-confirm">Confirm</label>
              <input id="reg-confirm" type="password" className="input" value={form.confirm} onChange={set('confirm')} placeholder="repeat password" />
              {errors.confirm && <p className="field-error">{errors.confirm}</p>}
            </div>
          </div>
          <div className="form-field mt-14">
            <label className="label" htmlFor="reg-role">Role</label>
            <select id="reg-role" className="select" value={form.role} onChange={set('role')}>
              <option value="ADMIN">Administrator — manage stations &amp; users</option>
              <option value="OPERATOR">Operator — submit measurements</option>
              <option value="VIEWER">Viewer — read-only access</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-block mt-18" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-alt">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
