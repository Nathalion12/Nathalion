import api, { setAuthToken } from './api';

export const registerUser = async (userData) => {
  const response = await api.post('/users/register', userData);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await api.post('/users/login', userData);
  if (response.data.token) {
    setAuthToken(response.data.token);
  }
  return response.data;
};

export const loadUser = async () => {
  // Check local storage for token first
  const token = localStorage.getItem('token');
  if (token) {
    setAuthToken(token); // Set token in axios headers
  }
  const response = await api.get('/users/me');
  return response.data; // User object
};

export const logoutUser = () => {
  setAuthToken(null); // Clear token from headers and local storage
};
