import { useCallback, useEffect, useState } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

// The JWT lives in sessionStorage: it survives a page refresh but is cleared when the tab
// closes, and it is sent only in the Authorization header (Assessment 1 §4).
const STORAGE_KEY = 'taskparty.session';
const EXPIRED_MESSAGE = 'Your session has expired. Sign in again.';

function readStoredSession() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (!session?.token || !session?.user || !(session.expiresAt > Date.now())) return null;
    return session;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (e.g. private browsing); the app still works until refresh.
  }
}

/** Sign-in state: the token, the signed-in user, and login/register/logout actions. */
export function useSession() {
  const [session, setSession] = useState(() => {
    const stored = readStoredSession();
    setAuthToken(stored?.token); // set before any child component starts fetching
    return stored;
  });
  const [notice, setNotice] = useState('');

  const start = useCallback(({ token, user, expiresIn }) => {
    const next = { token, user, expiresAt: Date.now() + expiresIn * 1000 };
    setAuthToken(token);
    writeStoredSession(next);
    setSession(next);
    setNotice('');
  }, []);

  const logout = useCallback((message = '') => {
    setAuthToken(null);
    writeStoredSession(null);
    setSession(null);
    setNotice(message);
  }, []);

  // Any 401 from the API (expired or revoked token) signs the user out with an explanation.
  useEffect(() => {
    setUnauthorizedHandler(() => logout(EXPIRED_MESSAGE));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Sign out when the token's 24 hours are up, even if the user is idle.
  useEffect(() => {
    if (!session) return undefined;
    const ms = Math.min(session.expiresAt - Date.now(), 2 ** 31 - 1);
    const id = setTimeout(() => logout(EXPIRED_MESSAGE), Math.max(ms, 0));
    return () => clearTimeout(id);
  }, [session, logout]);

  const login = useCallback(async (email, password) => start(await authApi.login({ email, password })), [start]);
  const register = useCallback(async (details) => start(await authApi.register(details)), [start]);

  /** Replaces the cached user (accepts a value or an updater function). */
  const updateUser = useCallback((update) => {
    setSession((current) => {
      if (!current) return current;
      const user = typeof update === 'function' ? update(current.user) : update;
      const next = { ...current, user };
      writeStoredSession(next);
      return next;
    });
  }, []);

  return {
    user: session?.user ?? null,
    notice,
    clearNotice: useCallback(() => setNotice(''), []),
    login,
    register,
    logout,
    updateUser,
  };
}
