import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  loginWithInviteToken,
  logoutInviteSession,
  restoreInviteSession,
} from '@/services/inviteAuth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (inviteToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const ok = await restoreInviteSession();
        if (mounted) {
          setIsAuthenticated(ok);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Ошибка инициализации авторизации.');
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (inviteToken: string) => {
    setError(null);
    await loginWithInviteToken(inviteToken);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await logoutInviteSession();
    setIsAuthenticated(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, error, login, logout, clearError }),
    [isAuthenticated, isLoading, error, login, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
