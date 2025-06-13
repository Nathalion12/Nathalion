import { render, screen } from '@testing-library/react';
import App from './App';

// Mock react-router-dom's useNavigate if components use it outside a Router context in tests
// Or wrap with MemoryRouter if testing navigation-dependent parts
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'), // use actual for all non-hook parts
  useNavigate: () => jest.fn(),
}));

describe('<App />', () => {
  test('renders welcome message and login/register buttons when not authenticated', () => {
    render(<App />);
    // Check for elements that are present when not logged in
    expect(screen.getByText(/Welcome to Do Me A Favor!/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Register/i })).toBeInTheDocument();
  });
});
