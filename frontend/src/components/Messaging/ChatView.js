import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getChatHistory, sendMessage } from '../../services/messageService';
import { useAuth } from '../../context/AuthContext';
import { Box, TextField, Button, Paper, Typography, List, ListItem, ListItemText, Avatar, ListItemAvatar, CircularProgress, Alert, IconButton, AppBar, Toolbar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const ChatView = () => {
  const { chatPartnerId } = useParams();
  const { authState } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPartnerUsername, setChatPartnerUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (authState.isAuthenticated && chatPartnerId) fetchMessages();
    else if (!authState.isAuthenticated) { setError("Login required."); setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated, chatPartnerId]);

  const fetchMessages = async () => {
    setLoading(true); setError('');
    try {
      const chatHistory = await getChatHistory(chatPartnerId);
      setMessages(chatHistory);
      if (chatHistory.length > 0) {
        const firstMsg = chatHistory[0];
        setChatPartnerUsername(firstMsg.sender._id === authState.user._id ? firstMsg.receiver.username : firstMsg.sender.username);
      } else {
         // Attempt to get username if starting a new chat - needs backend support for fetching user by ID
         // For now, this will default to 'User' if no history.
         // Could fetch User details by chatPartnerId here if needed.
         setChatPartnerUsername('User'); // Fallback
      }
    } catch (err) { setError(err.response?.data?.msg || 'Failed to load messages.'); }
    finally { setLoading(false); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const sentMessage = await sendMessage(chatPartnerId, newMessage);
      // Add sender details manually for immediate UI update if backend doesn't populate them on send
      const messageForUi = { ...sentMessage, sender: { _id: authState.user._id, username: authState.user.username }};
      setMessages(prev => [...prev, messageForUi]);
      setNewMessage('');
    } catch (err) { setError(err.response?.data?.msg || 'Failed to send.'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 32px)', /* Appbar - container padding */ backgroundColor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1} sx={{ backgroundColor: 'background.paper'}}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/messages')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" color="textPrimary">{chatPartnerUsername || 'Chat'}</Typography>
        </Toolbar>
      </AppBar>

      {error && !messages.length && <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>}
      {error && messages.length > 0 && <Alert severity="warning" sx={{m:1, position: 'sticky', top: 0, zIndex: 1}}>{error}</Alert>}


      <List sx={{ flexGrow: 1, overflowY: 'auto', p: 2, backgroundColor: 'background.default' }}>
        {messages.map((msg) => {
          const isCurrentUser = msg.sender._id === authState.user?._id;
          return (
            <ListItem key={msg._id} sx={{ display: 'flex', justifyContent: isCurrentUser ? 'flex-end' : 'flex-start', px:0 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', flexDirection: isCurrentUser ? 'row-reverse' : 'row' }}>
                {!isCurrentUser && (
                  <Avatar sx={{ width: 32, height: 32, mr: 1, mb: 0.5, bgcolor: 'secondary.main' }}>
                    {msg.sender.username?.charAt(0).toUpperCase()}
                  </Avatar>
                )}
                 <Paper
                    elevation={0}
                    sx={{
                        p: '10px 14px',
                        bgcolor: isCurrentUser ? 'primary.main' : 'background.paper',
                        color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
                        borderRadius: isCurrentUser ? '20px 20px 5px 20px' : '5px 20px 20px 20px',
                        maxWidth: 'calc(100% - 40px)', // Max width to leave space for avatar
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                  <Typography variant="body1">{msg.content}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary', mt:0.5 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Paper>
              </Box>
            </ListItem>
          );
        })}
        <div ref={messagesEndRef} />
      </List>
      <Box component="form" onSubmit={handleSendMessage} sx={{ p: 1.5, borderTop: '1px solid', borderColor:'divider', display: 'flex', alignItems: 'center', backgroundColor: 'background.paper' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
        />
        <IconButton type="submit" color="primary" sx={{ ml: 1, p: '10px' }} disabled={!newMessage.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatView;
