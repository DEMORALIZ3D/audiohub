import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  role: 'super_admin' | 'admin' | 'user';
  is_admin: boolean;
  is_under_13: boolean;
  is_active: boolean;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  switchProfile: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const userId = localStorage.getItem('audiohub_user_id');
    if (!userId) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { 'X-User-Id': userId },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && !ct.includes('text/html')) {
        const user = await res.json();
        setCurrentUser(user);
      } else if (res.status === 401 || res.status === 403) {
        // Only clear user ID if session is explicitly rejected by backend
        localStorage.removeItem('audiohub_user_id');
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Error fetching current user', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim(), password }),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        return {
          success: false,
          error:
            'Cannot reach AudioHub API (server returned web page). Please verify your server address.',
        };
      }
      if (res.ok) {
        const user: UserProfile = await res.json();
        localStorage.setItem('audiohub_user_id', user.id);
        setCurrentUser(user);
        return { success: true };
      } else {
        let errMessage = 'Invalid username or password';
        try {
          const err = await res.json();
          if (err.detail) errMessage = err.detail;
        } catch {}
        return { success: false, error: errMessage };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('audiohub_user_id');
    setCurrentUser(null);
    window.location.reload();
  };

  const switchProfile = async (userId: string) => {
    localStorage.setItem('audiohub_user_id', userId);
    await refreshUser();
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        logout,
        refreshUser,
        switchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
