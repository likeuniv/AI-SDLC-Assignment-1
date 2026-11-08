import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import { api as defaultApi } from '../api/client.js';

export function AuthProvider({ children, client = defaultApi }) {
  const [session, setSession] = useState({ account: null, status: 'loading', error: null });

  const getCsrfToken = useCallback(async () => {
    const result = await client.get('/api/v1/auth/csrf');
    if (typeof result?.csrfToken !== 'string' || result.csrfToken.length === 0) {
      throw new Error('The server did not provide a CSRF token.');
    }
    client.setCsrfToken(result.csrfToken);
  }, [client]);

  const restore = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setSession((current) => ({ ...current, status: 'loading', error: null }));
    }
    try {
      const account = await client.get('/api/v1/auth/session');
      await getCsrfToken();
      setSession({ account, status: 'authenticated', error: null });
      return account;
    } catch (error) {
      client.clearCsrfToken();
      if (error.status === 401) {
        setSession({ account: null, status: 'anonymous', error: null });
      } else {
        setSession({ account: null, status: 'error', error });
      }
      return null;
    }
  }, [client, getCsrfToken]);

  useEffect(() => {
    Promise.resolve().then(() => restore({ showLoading: false }));
  }, [restore]);

  const login = useCallback(async (credentials) => {
    const account = await client.post('/api/v1/auth/login', credentials);
    client.clearCsrfToken();
    try {
      await getCsrfToken();
    } catch (error) {
      setSession({ account: null, status: 'error', error });
      throw error;
    }
    setSession({ account, status: 'authenticated', error: null });
    return account;
  }, [client, getCsrfToken]);

  const register = useCallback((details) => (
    client.post('/api/v1/auth/register', details)
  ), [client]);

  const logout = useCallback(async () => {
    await client.post('/api/v1/auth/logout', {});
    client.clearCsrfToken();
    setSession({ account: null, status: 'anonymous', error: null });
  }, [client]);

  const value = useMemo(() => ({
    ...session,
    login,
    logout,
    register,
    restore,
  }), [session, login, logout, register, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
