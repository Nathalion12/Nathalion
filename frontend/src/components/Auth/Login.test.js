import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom'; // Needed for <Link>
import { AuthProvider } from '../../context/AuthContext'; // Needed if component uses useAuth
import Login from './Login';

describe('<Login />', () => {
  test('renders login form', () => {
    render(
      <Router>
        <AuthProvider> {/* Wrap with AuthProvider if useAuth is called */}
          <Login />
        </AuthProvider>
      </Router>
    );
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });
});
