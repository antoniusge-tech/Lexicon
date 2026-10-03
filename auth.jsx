/* auth.jsx — sign up / log in / password reset screen */

function lwAuthErrorMessage(err) {
  if (err && err.code === 'lw/username-taken') return err.message;
  switch (err && err.code) {
    case 'auth/email-already-in-use': return 'This email is already registered.';
    case 'auth/weak-password': return 'The password is too short (at least 6 characters).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Wrong username/email or password.';
    case 'auth/invalid-email': return 'Invalid email.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    default: return 'Something went wrong. Try again.';
  }
}

const LW_USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const LW_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthView() {
  const [mode, setMode] = React.useState('login'); // 'login' | 'register' | 'reset'
  const [username, setUsername] = React.useState(''); // username or email on the login screen
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [password2, setPassword2] = React.useState('');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const validate = () => {
    if (mode === 'reset') {
      if (!LW_EMAIL_RE.test(email.trim())) return 'Enter the email you registered with.';
      return '';
    }
    if (mode === 'register') {
      if (!LW_USERNAME_RE.test(username.trim())) {
        return 'Username: 3–20 characters, Latin letters, digits and "_".';
      }
      if (!LW_EMAIL_RE.test(email.trim())) return 'Enter a valid email — you need it to reset your password.';
    } else if (!username.trim()) {
      return 'Enter your username or email.';
    }
    if (password.length < 6) return 'The password must be at least 6 characters.';
    if (mode === 'register' && password !== password2) return "Passwords don't match.";
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'register') {
        await window.lwRegister(username, email, password);
        /* onAuthStateChanged in App picks up the signed-in user from here */
      } else if (mode === 'reset') {
        await window.lwResetPassword(email);
        setInfo('A password reset link has been sent to ' + email.trim() + '.');
        setBusy(false);
      } else {
        await window.lwLogin(username, password);
        /* onAuthStateChanged in App picks up the signed-in user from here */
      }
    } catch (err) {
      if (mode === 'reset' && err && err.code === 'auth/user-not-found') {
        setError('No account with this email.');
      } else {
        setError(lwAuthErrorMessage(err));
      }
      setBusy(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
    setPassword('');
    setPassword2('');
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create account' : 'Reset password';
  const sub = mode === 'login' ? 'Sign in to keep learning your words.'
    : mode === 'register' ? 'Create an account to get started.'
    : 'Enter your email and we’ll send a link to reset your password.';

  return (
    <div className="lang-select">
      <div className="lang-select-card auth-card">
        <div className="auth-brand">
          <span className="drawer-logo"><Ic.Library /></span>
          <span className="brand-name">Lexicon</span>
        </div>
        <p className="lang-select-title">{title}</p>
        <p className="lang-select-sub">{sub}</p>
        <form className="form" onSubmit={submit}>
          {mode !== 'reset' && (
            <label className="field">
              <span className="field-label">{mode === 'login' ? 'Username or email' : 'Username'}</span>
              <input className="input" value={username} autoFocus autoComplete="username"
                placeholder="e.g. anton_92"
                onChange={(e) => setUsername(e.target.value)} />
            </label>
          )}
          {mode !== 'login' && (
            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" value={email} autoFocus={mode === 'reset'}
                autoComplete="email" placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {mode !== 'reset' && (
            <label className="field">
              <span className="field-label">Password</span>
              <input className="input" type="password" value={password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="at least 6 characters"
                onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {mode === 'register' && (
            <label className="field">
              <span className="field-label">Repeat password</span>
              <input className="input" type="password" value={password2} autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)} />
            </label>
          )}
          {error && <p className="field-hint" style={{ color: 'var(--error)' }}>{error}</p>}
          {info && <p className="field-hint" style={{ color: 'var(--secondary)' }}>{info}</p>}
          <button className="btn btn-primary lg" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : mode === 'register' ? 'Sign up' : 'Send link')}
          </button>
        </form>
        {mode === 'login' && (
          <p className="lang-select-sub" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-ghost sm" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
          </p>
        )}
        <p className="lang-select-sub" style={{ marginTop: mode === 'login' ? 6 : 18 }}>
          {mode === 'login' ? 'No account? ' : 'Already have an account? '}
          <button type="button" className="btn btn-ghost sm" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { AuthView });
