import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter as Router, MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../../context/AuthContext';
import ChatView from './ChatView';
import * as messageService from '../../services/messageService';

jest.mock('../../services/messageService');

describe('<ChatView />', () => {
  const mockUser = { _id: 'user123', username: 'CurrentUser' };
  const mockAuthState = { isAuthenticated: true, loading: false, user: mockUser, token: 'fake-token' };
  const chatPartnerId = 'partner456';

  // Helper to render with router context for useParams
  const renderWithRouter = (ui, { route = `/messages/${chatPartnerId}`, path = '/messages/:chatPartnerId' } = {}) => {
    window.history.pushState({}, 'Test page', route);
    return render(
        <MemoryRouter initialEntries={[route]}>
            <AuthProvider> {/* Mock AuthProvider or provide context directly */}
                <AuthContext.Provider value={{ authState: mockAuthState }}>
                    <Routes>
                        <Route path={path} element={ui} />
                    </Routes>
                </AuthContext.Provider>
            </AuthProvider>
        </MemoryRouter>
    );
  };


  test('renders chat interface and fetches messages', async () => {
    const mockMessages = [
      { _id: 'msg1', sender: { _id: chatPartnerId, username: 'PartnerUser' }, receiver: { _id: mockUser._id, username: mockUser.username }, content: 'Hi there', timestamp: new Date().toISOString() },
      { _id: 'msg2', sender: { _id: mockUser._id, username: mockUser.username }, receiver: { _id: chatPartnerId, username: 'PartnerUser' }, content: 'Hello back!', timestamp: new Date().toISOString() },
    ];
    messageService.getChatHistory.mockResolvedValueOnce(mockMessages);

    renderWithRouter(<ChatView />);

    expect(await screen.findByText(/Hi there/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello back!/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a message.../i)).toBeInTheDocument();
  });

  test('shows error if fetching messages fails', async () => {
    messageService.getChatHistory.mockRejectedValueOnce(new Error('Failed to load messages.'));
    renderWithRouter(<ChatView />);
    expect(await screen.findByText(/Failed to load messages./i)).toBeInTheDocument();
  });
});
