import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authApi } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  devLogin: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { error, success } = useToast();

  const refreshUser = useCallback(async () => {
    try {
      // Check if URL contains token from OAuth callback redirect
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
          localStorage.setItem('auth_token', urlToken);
          params.delete('token');
          const remainingQuery = params.toString() ? `?${params.toString()}` : '';
          window.history.replaceState({}, '', `${window.location.pathname}${remainingQuery}`);
        }
      }

      const me = await authApi.getMe();
      setUser(me);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = async () => {
    try {
      const url = await authApi.getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to start Google login');
    }
  };

  const devLogin = async (email?: string, name?: string) => {
    try {
      setLoading(true);
      const res = await authApi.devLogin(email, name);
      if (res.token) {
        localStorage.setItem('auth_token', res.token);
      }
      setUser(res.user);
      success(`Welcome back, ${res.user.name || res.user.email}!`);
    } catch (err: any) {
      error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      success('Logged out successfully');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        loginWithGoogle,
        devLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

