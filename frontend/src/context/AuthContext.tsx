import React, { createContext, useContext, useState } from 'react';
import { authApi } from '../api/productsApi';

interface AuthContextValue {
  isLoggedIn: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('auth_username'));

  const login = async (user: string, password: string) => {
    const { token: t } = await authApi.login(user, password);
    localStorage.setItem('auth_token', t);
    localStorage.setItem('auth_username', user);
    setToken(t);
    setUsername(user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn: !!token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
