import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CapacitorHttp } from '@capacitor/core';

const AuthContext = createContext();

// Check if running in Capacitor (native app)
const isNative = () =>
  window.Capacitor &&
  window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('yogaToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('checking'); // checking | production | local | offline

  const PRODUCTION_API_URL =
    process.env.REACT_APP_API_URL ||
    'https://yoga-pose-detection-1.onrender.com/api';

  const LOCAL_API_URL =
    process.env.REACT_APP_LOCAL_API_URL ||
    'http://localhost:5000/api';

  const [currentApiUrl, setCurrentApiUrl] = useState(PRODUCTION_API_URL);

  // =========================
  // API health check
  // =========================
  const checkApiHealth = useCallback(async () => {
    setApiStatus('checking');

    const tryHealth = async (baseUrl, timeoutMs) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Health check failed');
    };

    try {
      await tryHealth(PRODUCTION_API_URL, 6000);
      setCurrentApiUrl(PRODUCTION_API_URL);
      setApiStatus('production');
      return 'production';
    } catch {
      try {
        await tryHealth(LOCAL_API_URL, 3000);
        setCurrentApiUrl(LOCAL_API_URL);
        setApiStatus('local');
        return 'local';
      } catch {
        setApiStatus('offline');
        return 'offline';
      }
    }
  }, [PRODUCTION_API_URL, LOCAL_API_URL]);

  // =========================
  // API helper (native + web)
  // =========================
  const apiCall = useCallback(
    async (endpoint, options = {}, retries = 2) => {
      const url = `${currentApiUrl}${endpoint}`;

      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      try {
        if (isNative()) {
          const res = await CapacitorHttp.request({
            url,
            method: options.method || 'GET',
            headers,
            data: options.body ? JSON.parse(options.body) : undefined,
            readTimeout: 60000,
            connectTimeout: 60000,
          });

          if (res.status >= 400) {
            throw new Error(res.data?.message || 'Request failed');
          }

          return res.data;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const res = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');

        return data;
      } catch (err) {
        if (
          retries > 0 &&
          (err.name === 'AbortError' ||
            err.message.includes('fetch') ||
            err.message.includes('network'))
        ) {
          await new Promise(r => setTimeout(r, 2000));
          return apiCall(endpoint, options, retries - 1);
        }
        throw err;
      }
    },
    [token, currentApiUrl]
  );

  // =========================
  // App initialization
  // =========================
  useEffect(() => {
    const init = async () => {
      await checkApiHealth();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiCall('/auth/verify-token', { method: 'POST' });
        if (res.success) setUser(res.user);
        else throw new Error('Invalid token');
      } catch {
        localStorage.removeItem('yogaToken');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, apiCall, checkApiHealth]);

  // =========================
  // Auth actions
  // =========================
  const login = async (data) => {
    try {
      setLoading(true);
      setError('Waking up server…');

      await fetch(`${currentApiUrl}/health`).catch(() => {});

      const res = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      localStorage.setItem('yogaToken', res.token);
      setToken(res.token);
      setUser(res.user);
      setError('');
      return { success: true };
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    try {
      setLoading(true);
      const res = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      localStorage.setItem('yogaToken', res.token);
      setToken(res.token);
      setUser(res.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('yogaToken');
    setUser(null);
    setToken(null);
  };

  // =========================
  // Context value
  // =========================
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        apiStatus,
        currentApiUrl,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        apiCall,
        checkApiHealth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
