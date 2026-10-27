import { useState } from 'react';
import AvatarPicker from '../components/AvatarPicker.jsx';
import BusyButton from '../components/BusyButton.jsx';
import ConnectionNotice from '../components/ConnectionNotice.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Screen 1 (registration): display name, optional avatar choice, email and password.
export default function RegisterPage({ health, onRegister, onShowLogin, onError }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('teal');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!displayName.trim()) next.displayName = 'Enter the name your party will see.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters for your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      onError?.();
      return;
    }
    setBusy(true);
    try {
      await onRegister({ displayName: displayName.trim(), email: email.trim(), password, avatar });
    } catch (error) {
      setErrors(Object.fromEntries((error.details || []).map((d) => [d.field, d.message])));
      setFormError(error.message);
      onError?.();
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <h1 className="wordmark-lg">Task Party</h1>
        <p className="login-sub">Create your account</p>

        <ConnectionNotice health={health} />
        {formError && <p className="form-error" role="alert">{formError}</p>}

        <div className="field">
          <label htmlFor="r-name">Display name</label>
          <input id="r-name" autoComplete="nickname" maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-invalid={!!errors.displayName} aria-describedby={errors.displayName ? 'r-name-err' : undefined} />
          {errors.displayName && <p id="r-name-err" className="error" role="alert">{errors.displayName}</p>}
        </div>

        <AvatarPicker name={displayName} value={avatar} onChange={setAvatar} />

        <div className="field">
          <label htmlFor="r-email">Email</label>
          <input id="r-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'r-email-err' : undefined} />
          {errors.email && <p id="r-email-err" className="error" role="alert">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="r-password">Password</label>
          <input id="r-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'r-password-err' : 'r-password-hint'} />
          {errors.password ? (
            <p id="r-password-err" className="error" role="alert">{errors.password}</p>
          ) : (
            <p id="r-password-hint" className="hint">At least 8 characters.</p>
          )}
        </div>

        <BusyButton type="submit" className="btn btn-primary btn-block" busy={busy} busyText="Creating account…">Create account</BusyButton>
        <p className="login-foot">
          Already have an account? <button type="button" className="link" onClick={onShowLogin}>Sign in</button>
        </p>
      </form>
    </main>
  );
}
