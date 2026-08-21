import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '~/services/apiClient';
import authService from '~/services/authService';

const AUTH_USER_KEY = 'authUser';

export const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = (data) => {
    apiClient.setTokens(data);
    setUser(data.user);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  };

  const clearSession = () => {
    apiClient.clearTokens();
    localStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
  };

  useEffect(() => {
    apiClient.onUnauthorized = clearSession;
    return () => {
      apiClient.onUnauthorized = null;
    };
  }, []);

  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const bootstrap = async () => {
      const refreshToken = apiClient.getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const tokens = await authService.refreshToken(refreshToken);
        apiClient.setTokens(tokens);
        const cachedUser = localStorage.getItem(AUTH_USER_KEY);
        if (cachedUser) setUser(JSON.parse(cachedUser));
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.signIn({ email, password });
    persistSession(data);
    return data.user;
  }, []);

  const signUp = useCallback(async ({ fullName, email, password, phone }) => {
    const data = await authService.signUp({ fullName, email, password, phone });
    persistSession(data);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = apiClient.getRefreshToken();
    if (refreshToken) {
      await authService.signOut(refreshToken).catch(() => {});
    }
    clearSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, signUp, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
