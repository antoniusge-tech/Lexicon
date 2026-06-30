/* auth.jsx — sign up / log in screen */

function lwAuthErrorMessage(err) {
  if (err && err.code === 'lw/username-taken') return err.message;
  switch (err && err.code) {
    case 'auth/email-already-in-use': return 'Это имя уже занято.';
    case 'auth/weak-password': return 'Пароль слишком короткий (минимум 6 символов).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Неверное имя пользователя или пароль.';
    case 'auth/invalid-email': return 'Имя пользователя содержит недопустимые символы.';
    case 'auth/too-many-requests': return 'Слишком много попыток. Попробуйте позже.';
    default: return 'Что-то пошло не так. Попробуйте ещё раз.';
  }
}

const LW_USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function AuthView() {
  const [mode, setMode] = React.useState('login'); // 'login' | 'register'
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [password2, setPassword2] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const validate = () => {
    if (!LW_USERNAME_RE.test(username.trim())) {
      return 'Имя пользователя: 3–20 символов, латинские буквы, цифры, "_".';
    }
    if (password.length < 6) return 'Пароль должен быть не короче 6 символов.';
    if (mode === 'register' && password !== password2) return 'Пароли не совпадают.';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        await window.lwRegister(username, password);
      } else {
        await window.lwLogin(username, password);
      }
      /* onAuthStateChanged in App picks up the signed-in user from here */
    } catch (err) {
      setError(lwAuthErrorMessage(err));
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
    setPassword('');
    setPassword2('');
  };

  return (
    <div className="lang-select">
      <div className="lang-select-card">
        <p className="lang-select-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</p>
        <p className="lang-select-sub">
          {mode === 'login' ? 'Войдите, чтобы продолжить изучение слов.' : 'Создайте аккаунт, чтобы начать.'}
        </p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Имя пользователя</span>
            <input className="input" value={username} autoFocus autoComplete="username"
              placeholder="например, anton_92"
              onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Пароль</span>
            <input className="input" type="password" value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="не короче 6 символов"
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === 'register' && (
            <label className="field">
              <span className="field-label">Повторите пароль</span>
              <input className="input" type="password" value={password2} autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)} />
            </label>
          )}
          {error && <p className="field-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button className="btn btn-primary lg" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
        <p className="lang-select-sub" style={{ marginTop: 18 }}>
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button type="button" className="btn btn-ghost sm" onClick={switchMode}>
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { AuthView });
