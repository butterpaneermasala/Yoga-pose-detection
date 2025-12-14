import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CapacitorHttp } from '@capacitor/core';

const AuthContext = createContext();

// Check if running in Capacitor (native app)
const isNative = () => {
  return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
};

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

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Log API URL on mount
  useEffect(() => {
    console.log('🌐 API_BASE_URL:', API_BASE_URL);
    console.log('🌐 process.env.REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  }, [API_BASE_URL]);

  // API call helper with timeout and retry
  const apiCall = useCallback(async (endpoint, options = {}, retries = 2) => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 API Call:', url, options.method || 'GET', 'Native:', isNative());
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      let response, data;

      // Use Capacitor HTTP for native apps to bypass WebView restrictions
      if (isNative()) {
        console.log('Using Capacitor HTTP (native)');
        const capResponse = await CapacitorHttp.request({
          url: url,
          method: options.method || 'GET',
          headers: headers,
          data: options.body ? JSON.parse(options.body) : undefined,
          readTimeout: 60000,
          connectTimeout: 60000
        });
        
        console.log('✅ Capacitor Response status:', capResponse.status);
        
        if (capResponse.status >= 400) {
          throw new Error(capResponse.data.message || 'Something went wrong');
        }
        
        return capResponse.data;
      } else {
        // Use fetch for web
        console.log('Using fetch (web)');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        response = await fetch(url, {
          method: options.method || 'GET',
          headers: headers,
          body: options.body,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('✅ Response status:', response.status);
        
        data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Something went wrong');
        }

        return data;
      }
    } catch (error) {
      console.error('❌ API Error:', error.name, error.message);
      
      // Retry on network errors if retries left
      if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('network'))) {
        console.log(`🔄 Retrying... (${retries} attempts left). Backend may be waking up...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return apiCall(endpoint, options, retries - 1);
      }
      
      throw error;
    }
  }, [token, API_BASE_URL]);

  // Verify token on app load
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiCall('/auth/verify-token', {
          method: 'POST',
        });

        if (response.success) {
          setUser(response.user);
        } else {
          // Invalid token
          localStorage.removeItem('yogaToken');
          setToken(null);
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('yogaToken');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token, apiCall]);

  // Login function
  const login = async (loginData) => {
    try {
      setError('');
      setLoading(true);
      setError('Waking up server... This may take up to 60 seconds on first request.');

      // Wake up the server first
      try {
        console.log('🔔 Waking up server at:', `${API_BASE_URL}/health`);
        if (isNative()) {
          await CapacitorHttp.request({
            url: `${API_BASE_URL}/health`,
            method: 'GET'
          });
        } else {
          await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        }
        console.log('💚 Health check completed');
      } catch (e) {
        console.error('⚠️ Health check failed:', e.message);
        // Ignore wake-up errors, proceed with login
      }

      setError('Logging in...');
      console.log('🔐 Attempting login with data:', { email: loginData.email });
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });
      console.log('🎉 Login successful:', response.success);
      
      setError(''); // Clear the connecting message

      if (response.success) {
        const { token: newToken, user: userData } = response;
        
        localStorage.setItem('yogaToken', newToken);
        setToken(newToken);
        setUser(userData);
        
        return { success: true, message: response.message };
      }
    } catch (error) {
      const errorMessage = error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')
        ? `Cannot connect to server at ${API_BASE_URL}. Please check your internet connection and try again.`
        : error.message;
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (registerData) => {
    try {
      setError('');
      setLoading(true);
      setError('Waking up server... This may take up to 60 seconds on first request.');

      // Wake up the server first
      try {
        if (isNative()) {
          await CapacitorHttp.request({
            url: `${API_BASE_URL}/health`,
            method: 'GET'
          });
        } else {
          await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        }
      } catch (e) {
        // Ignore wake-up errors, proceed with register
      }

      setError('Creating account...');
      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
      
      setError(''); // Clear the connecting message

      if (response.success) {
        const { token: newToken, user: userData } = response;
        
        localStorage.setItem('yogaToken', newToken);
        setToken(newToken);
        setUser(userData);
        
        return { success: true, message: response.message };
      }
    } catch (error) {
      setError(error.message);
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('yogaToken');
    setToken(null);
    setUser(null);
    setError('');
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const response = await apiCall('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (response.success) {
        setUser(response.user);
        return { success: true, message: response.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Update user preferences
  const updatePreferences = async (preferences) => {
    try {
      const response = await apiCall('/user/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      if (response.success) {
        setUser(prev => ({
          ...prev,
          preferences: response.preferences
        }));
        return { success: true, message: response.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Progress API calls
  const getProgress = async () => {
    try {
      const response = await apiCall('/progress');
      return response.success ? response.progress : null;
    } catch (error) {
      console.error('Get progress error:', error);
      return null;
    }
  };

  const addSession = async (sessionData) => {
    try {
      const response = await apiCall('/progress/session', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
      return response.success ? response.progress : null;
    } catch (error) {
      console.error('Add session error:', error);
      return null;
    }
  };

  const addAchievement = async (achievementData) => {
    try {
      const response = await apiCall('/progress/achievement', {
        method: 'POST',
        body: JSON.stringify(achievementData),
      });
      return response.success ? { isNew: response.isNew, progress: response.progress } : null;
    } catch (error) {
      console.error('Add achievement error:', error);
      return null;
    }
  };

  const getStats = async () => {
    try {
      const response = await apiCall('/progress/stats');
      return response.success ? response.stats : null;
    } catch (error) {
      console.error('Get stats error:', error);
      return null;
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
    updatePreferences,
    getProgress,
    addSession,
    addAchievement,
    getStats,
    apiCall,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};