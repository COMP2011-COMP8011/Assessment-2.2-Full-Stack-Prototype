import { useState } from 'react';
import BusyButton from '../components/BusyButton.jsx';
import ConnectionNotice from '../components/ConnectionNotice.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Screen 1: sign in. Accounts are checked by the API (bcrypt + JWT).
export default function LoginPage({ health, notice, onLogin, onShowRegister, onError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      onError?.();
      return;
    }
    setBusy(true);
    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      setFormError(error.message);
      onError?.();
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <h1 className="wordmark-lg">Task Party</h1>
        <p className="login-sub">Quests are better with a party.</p>

        {notice && <p className="notice" role="status">{notice}</p>}
        <ConnectionNotice health={health} />
        {formError && <p className="form-error" role="alert">{formError}</p>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} />
          {errors.email && <p id="email-err" className="error" role="alert">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined} />
          {errors.password && <p id="password-err" className="error" role="alert">{errors.password}</p>}
        </div>

        <BusyButton type="submit" className="btn btn-primary btn-block" busy={busy} busyText="Signing in…">Sign in</BusyButton>
        <p className="login-foot">
          New here? <button type="button" className="link" onClick={onShowRegister}>Create an account</button>
        </p>
        <p className="login-foot">Demo accounts: ruddro@taskparty.app, rafsan@taskparty.app, nova@taskparty.app, sabrina@taskparty.app — password <code>password123</code></p>
      </form>
    </main>
  );
}
