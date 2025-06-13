import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../../context/AuthContext'; // Import AuthContext to provide mock value
import Profile from './Profile';

describe('<Profile />', () => {
  test('shows login prompt if not authenticated', () => {
    // Mock initial authState for not authenticated
    const mockAuthState = {
      token: null,
      isAuthenticated: false,
      loading: false,
      user: null,
      error: null,
    };
    render(
      <Router>
        <AuthContext.Provider value={{ authState: mockAuthState, loadUser: jest.fn(), logout: jest.fn() }}>
          <Profile />
        </AuthContext.Provider>
      </Router>
    );
    expect(screen.getByText(/You are not logged in/i)).toBeInTheDocument();
  });

  test('renders profile information if authenticated', () => {
    const mockUser = { username: 'testuser', email: 'test@example.com', createdAt: new Date().toISOString() };
    const mockAuthState = {
      token: 'fake-token',
      isAuthenticated: true,
      loading: false,
      user: mockUser,
      error: null,
    };
     render(
      <Router>
        <AuthContext.Provider value={{ authState: mockAuthState, loadUser: jest.fn(), logout: jest.fn() }}>
          <Profile />
        </AuthContext.Provider>
      </Router>
    );
    expect(screen.getByText(/My Profile/i)).toBeInTheDocument();
    expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument();
  });
});
