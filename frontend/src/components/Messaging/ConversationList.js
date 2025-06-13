import React, { useEffect, useState } from 'react';
import { getConversations } from '../../services/messageService';
import { useAuth } from '../../context/AuthContext';
import { List, ListItem, ListItemAvatar, Avatar, ListItemText, Typography, Paper, CircularProgress, Alert, Divider, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ConversationList = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchConversations();
    } else {
      setLoading(false);
      setError("You need to be logged in to view conversations.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated]);

  const fetchConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError(err.response?.data?.msg || 'Failed to fetch conversations.');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (chatPartnerId) => {
    navigate(`/messages/${chatPartnerId}`);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  if (conversations.length === 0) return <Typography sx={{ mt: 2, textAlign: 'center' }}>No conversations yet.</Typography>;

  return (
    <Paper elevation={2} sx={{ mt: 2 }}>
      <Typography variant="h5" sx={{ p: 2 }}>Conversations</Typography>
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {conversations.map((conv, index) => (
          <React.Fragment key={conv.conversationId}>
            <ListItem
              alignItems="flex-start"
              button
              onClick={() => handleConversationClick(conv.withUser._id)}
              sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <ListItemAvatar>
                {/* Placeholder Avatar - replace with actual user avatar later */}
                <Avatar alt={conv.withUser.username}>{conv.withUser.username.charAt(0).toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={conv.withUser.username}
                secondary={
                  <Typography
                    sx={{ display: 'inline' }}
                    component="span"
                    variant="body2"
                    color="text.primary"
                  >
                    {conv.lastMessageSender === authState.user?.username ? "You: " : ""}
                    {conv.lastMessage.length > 30 ? conv.lastMessage.substring(0, 30) + "..." : conv.lastMessage}
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </ListItem>
            {index < conversations.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default ConversationList;
