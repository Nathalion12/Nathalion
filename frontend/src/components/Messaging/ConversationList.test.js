import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import * as messageService from '../../services/messageService'; // To mock

jest.mock('../../services/messageService'); // Mock the service

describe('<ConversationList />', () => {
  const mockUser = { _id: 'user123', username: 'CurrentUser' };
  const mockAuthState = { isAuthenticated: true, loading: false, user: mockUser, token: 'fake-token' };

  test('renders "No conversations yet" when service returns empty array', async () => {
    messageService.getConversations.mockResolvedValueOnce([]);
    render(
      <Router>
        <AuthContext.Provider value={{ authState: mockAuthState }}>
          <ConversationList />
        </AuthContext.Provider>
      </Router>
    );
    expect(await screen.findByText(/No conversations yet/i)).toBeInTheDocument();
  });

  test('renders conversations when service returns data', async () => {
    const mockConversations = [
      { conversationId: 'conv1', withUser: { _id: 'user2', username: 'UserTwo' }, lastMessage: 'Hello', lastMessageTimestamp: new Date().toISOString(), lastMessageSender: 'UserTwo' },
    ];
    messageService.getConversations.mockResolvedValueOnce(mockConversations);
    render(
      <Router>
        <AuthContext.Provider value={{ authState: mockAuthState }}>
          <ConversationList />
        </AuthContext.Provider>
      </Router>
    );
    expect(await screen.findByText(/UserTwo/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello/i)).toBeInTheDocument();
  });
});
