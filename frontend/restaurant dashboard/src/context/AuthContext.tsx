import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, type SafeUser } from '../services/authService';
import { ApiClientError } from '../services/apiClient';

interface AuthContextValue {
  user: SafeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<SafeUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async (): Promise<SafeUser | null> => {
    try {
      const res = await authService.getCurrentUser();
      if (res.user && res.user.role === 'RESTAURANT_OWNER') {
        setUser(res.user);
        setIsAuthenticated(true);
        setError(null);
        return res.user;
      } else {
        // If logged in as customer or unauthorized role
        setUser(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.loginOwner(credentials);
      setUser(res.user);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Invalid login credentials';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; password: string; phone?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.registerOwner(data);
      setUser(res.user);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch {
      // Even if network fails, clear local session state
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
