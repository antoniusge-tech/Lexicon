/* auth.jsx — sign up / log in / password reset screen */

function lwAuthErrorMessage(err) {
  if (err && err.code === 'lw/username-taken') return err.message;
  switch (err && err.code) {
    case 'auth/email-already-in-use': return 'Этот email уже зарегистрирован.';
    case 'auth/weak-password': return 'Пароль слишком короткий (минимум 6 символов).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Неверное имя пользователя/email или пароль.';
    case 'auth/invalid-email': return 'Некорректный email.';
    case 'auth/too-many-requests': return 'Слишком много попыток. Попробуйте позже.';
    default: return 'Что-то пошло не так. Попробуйте ещё раз.';
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
      if (!LW_EMAIL_RE.test(email.trim())) return 'Введите email, указанный при регистрации.';
      return '';
    }
    if (mode === 'register') {
      if (!LW_USERNAME_RE.test(username.trim())) {
        return 'Имя пользователя: 3–20 символов, латинские буквы, цифры, "_".';
      }
      if (!LW_EMAIL_RE.test(email.trim())) return 'Введите корректный email — он нужен для восстановления пароля.';
    } else if (!username.trim()) {
      return 'Введите имя пользователя или email.';
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
    setInfo('');
    try {
      if (mode === 'register') {
        await window.lwRegister(username, email, password);
        /* onAuthStateChanged in App picks up the signed-in user from here */
      } else if (mode === 'reset') {
        await window.lwResetPassword(email);
        setInfo('Письмо со ссылкой для сброса пароля отправлено на ' + email.trim() + '.');
        setBusy(false);
      } else {
        await window.lwLogin(username, password);
        /* onAuthStateChanged in App picks up the signed-in user from here */
      }
    } catch (err) {
      if (mode === 'reset' && err && err.code === 'auth/user-not-found') {
        setError('Аккаунт с таким email не найден.');
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

  const title = mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Сброс пароля';
  const sub = mode === 'login' ? 'Войдите, чтобы продолжить изучение слов.'
    : mode === 'register' ? 'Создайте аккаунт, чтобы начать.'
    : 'Укажите email — мы пришлём ссылку для смены пароля.';

  return (
    <div className="lang-select">
      <div className="lang-select-card">
        <p className="lang-select-title">{title}</p>
        <p className="lang-select-sub">{sub}</p>
        <form className="form" onSubmit={submit}>
          {mode !== 'reset' && (
            <label className="field">
              <span className="field-label">{mode === 'login' ? 'Имя пользователя или email' : 'Имя пользователя'}</span>
              <input className="input" value={username} autoFocus autoComplete="username"
                placeholder="например, anton_92"
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
              <span className="field-label">Пароль</span>
              <input className="input" type="password" value={password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="не короче 6 символов"
                onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {mode === 'register' && (
            <label className="field">
              <span className="field-label">Повторите пароль</span>
              <input className="input" type="password" value={password2} autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)} />
            </label>
          )}
          {error && <p className="field-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {info && <p className="field-hint" style={{ color: '#5BA02E' }}>{info}</p>}
          <button className="btn btn-primary lg" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : (mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Отправить письмо')}
          </button>
        </form>
        {mode === 'login' && (
          <p className="lang-select-sub" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-ghost sm" onClick={() => switchMode('reset')}>
              Забыли пароль?
            </button>
          </p>
        )}
        <p className="lang-select-sub" style={{ marginTop: mode === 'login' ? 6 : 18 }}>
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button type="button" className="btn btn-ghost sm" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { AuthView });
