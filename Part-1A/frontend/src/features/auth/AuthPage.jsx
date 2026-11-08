import { useState } from 'react';
import { useAuth } from '../../app/useAuth.js';
import { ErrorMessage, FieldErrors, StatusMessage } from '../../components/Feedback.jsx';

export function AuthPage({ mode, navigate }) {
  const { login, register } = useAuth();
  const [values, setValues] = useState({ fullName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [registered, setRegistered] = useState(false);
  const isRegistration = mode === 'register';

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      if (isRegistration) {
        await register(values);
        setMessage('Your patient account was created. Sign in to continue.');
        setRegistered(true);
      } else {
        await login({ email: values.email, password: values.password });
        navigate('/', { replace: true });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel auth-panel" aria-labelledby="auth-heading">
      <p className="eyebrow">Hospital Management System</p>
      <h1 id="auth-heading">{isRegistration ? 'Create a patient account' : 'Welcome back'}</h1>
      <p className="muted">
        {isRegistration
          ? 'Create your secure account to manage your profile, family and appointments.'
          : 'Sign in to continue to your secure patient, doctor or staff workspace.'}
      </p>
      <form aria-label={isRegistration ? 'Register' : 'Log in'} onSubmit={submit}>
        {isRegistration && (
          <label>
            Full name
            <input
              autoComplete="name"
              maxLength={120}
              name="fullName"
              onChange={(event) => update('fullName', event.target.value)}
              required
              value={values.fullName}
            />
            <FieldErrors error={error} field="fullName" />
          </label>
        )}
        <label>
          Email address
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => update('email', event.target.value)}
            required
            type="email"
            value={values.email}
          />
          <FieldErrors error={error} field="email" />
        </label>
        <label>
          Password
          <input
            autoComplete={isRegistration ? 'new-password' : 'current-password'}
            maxLength={72}
            minLength={isRegistration ? 12 : undefined}
            name="password"
            onChange={(event) => update('password', event.target.value)}
            required
            type="password"
            value={values.password}
          />
          {isRegistration && <small>Use at least 12 characters.</small>}
          <FieldErrors error={error} field="password" />
        </label>
        <ErrorMessage error={error} />
        <StatusMessage>{message}</StatusMessage>
        <button disabled={loading} type="submit">
          {loading ? 'Please wait…' : isRegistration ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        {registered ? (
          <button className="link-button" onClick={() => navigate('/login')} type="button">
            Continue to sign in
          </button>
        ) : (
          <>
            {isRegistration ? 'Already registered?' : 'New to HMS?'}{' '}
            <button
              className="link-button"
              onClick={() => navigate(isRegistration ? '/login' : '/register')}
              type="button"
            >
              {isRegistration ? 'Sign in' : 'Create a patient account'}
            </button>
          </>
        )}
      </p>
    </section>
  );
}
