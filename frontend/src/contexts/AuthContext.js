import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

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
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking', 'production', 'local', 'offline'

  const PRODUCTION_API_URL = process.env.REACT_APP_API_URL || 'https://yoga-pose-detection-1.onrender.com/api';
  const LOCAL_API_URL = process.env.REACT_APP_LOCAL_API_URL || 'http://localhost:5000/api';
  
  const [currentApiUrl, setCurrentApiUrl] = useState(PRODUCTION_API_URL);

  // Check API health
  const checkApiHealth = useCallback(async () => {
    try {
      setApiStatus('checking');
      
      // Try production first
      try {
        const response = await fetch(`${PRODUCTION_API_URL}/health`, { 
          method: 'GET',
          timeout: 5000 
        });
        if (response.ok) {
          setCurrentApiUrl(PRODUCTION_API_URL);
          setApiStatus('production');
          return 'production';
        }
      } catch (prodError) {
        console.warn('Production API health check failed:', prodError.message);
      }

      // Try local if production fails
      try {
        const response = await fetch(`${LOCAL_API_URL}/health`, { 
          method: 'GET',
          timeout: 3000 
        });
        if (response.ok) {
          setCurrentApiUrl(LOCAL_API_URL);
          setApiStatus('local');
          return 'local';
        }
      } catch (localError) {
        console.warn('Local API health check failed:', localError.message);
      }

      // Both failed
      setApiStatus('offline');
      return 'offline';
    } catch (error) {
      console.error('API health check error:', error);
      setApiStatus('offline');
      return 'offline';
    }
  }, [PRODUCTION_API_URL, LOCAL_API_URL]);

  // API call helper with fallback
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const tryApiCall = async (baseUrl) => {
      const url = `${baseUrl}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    };

    try {
      // Try production API first
      const result = await tryApiCall(currentApiUrl);
      return result;
    } catch (error) {
      console.warn(`API call failed with ${currentApiUrl}:`, error.message);
      
      // If production fails and we're not already using local, try local
      if (currentApiUrl !== LOCAL_API_URL) {
        try {
          console.log('Falling back to local API...');
          setCurrentApiUrl(LOCAL_API_URL);
          const result = await tryApiCall(LOCAL_API_URL);
          return result;
        } catch (localError) {
          console.error('Local API also failed:', localError.message);
          // Switch back to production for next attempt
          setCurrentApiUrl(PRODUCTION_API_URL);
          throw new Error(`Both production and local APIs failed. Production: ${error.message}, Local: ${localError.message}`);
        }
      } else {
        // If local fails, try production
        try {
          console.log('Local API failed, trying production...');
          setCurrentApiUrl(PRODUCTION_API_URL);
          const result = await tryApiCall(PRODUCTION_API_URL);
          return result;
        } catch (prodError) {
          console.error('Production API also failed:', prodError.message);
          throw new Error(`Both APIs failed. Local: ${error.message}, Production: ${prodError.message}`);
        }
      }
    }
  }, [token, currentApiUrl, PRODUCTION_API_URL, LOCAL_API_URL]);

  // Check API health and verify token on app load
  useEffect(() => {
    const initializeApp = async () => {
      // First check API health
      await checkApiHealth();
      
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

    initializeApp();
  }, [token, apiCall, checkApiHealth]);

  // Login function
  const login = async (loginData) => {
    try {
      setError('');
      setLoading(true);

      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });

      if (response.success) {
        const { token: newToken, user: userData } = response;
        
        localStorage.setItem('yogaToken', newToken);
        setToken(newToken);
        setUser(userData);
        
        return { success: true, message: response.message };
      }
    } catch (error) {
      let errorMessage = error.message;
      
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        errorMessage = `Cannot connect to server. Current API: ${currentApiUrl === PRODUCTION_API_URL ? 'Production (Render)' : 'Local'}. ${error.message}`;
      } else if (error.message.includes('Both APIs failed')) {
        errorMessage = 'Both production and local servers are unavailable. Please try again later.';
      }
      
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

      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });

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
    apiStatus,
    currentApiUrl,
    checkApiHealth,
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