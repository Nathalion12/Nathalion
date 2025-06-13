import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadUser as loadUserService, setAuthToken } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    token: localStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null,
    error: null,
  });

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (token && !authState.isAuthenticated) { // only load if token exists and not already authenticated
      setAuthToken(token);
      try {
        const user = await loadUserService();
        setAuthState({
          token: token,
          isAuthenticated: true,
          loading: false,
          user: user,
          error: null,
        });
      } catch (err) {
        console.error("Failed to load user:", err.response ? err.response.data : err.message);
        localStorage.removeItem('token'); // Remove invalid token
        setAuthState({
          token: null,
          isAuthenticated: false,
          loading: false,
          user: null,
          error: err.response ? err.response.data.msg : 'Failed to load user',
        });
      }
    } else {
      setAuthState(prevState => ({ ...prevState, loading: false })); // No token, stop loading
    }
  };

  // Attempt to load user on initial mount and when token changes
  useEffect(() => {
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to check localStorage

  const login = (userData) => { // userData here is the token from authService
    localStorage.setItem('token', userData.token);
    setAuthToken(userData.token);
    // Reload user data after login
    loadUser();
  };

  const register = (userData) => { // userData here is the token from authService
    localStorage.setItem('token', userData.token);
    setAuthToken(userData.token);
    // Reload user data after registration
    loadUser();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setAuthState({
      token: null,
      isAuthenticated: false,
      loading: false,
      user: null,
      error: null,
    });
  };

  return (
    <AuthContext.Provider value={{ authState, setAuthState, login, register, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
