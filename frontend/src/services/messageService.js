import api from './api'; // Uses the existing configured axios instance

// Send a new message
export const sendMessage = async (receiverId, content) => {
  const response = await api.post('/messages', { receiverId, content });
  return response.data;
};

// Get all conversations for the logged-in user
export const getConversations = async () => {
  const response = await api.get('/messages/conversations');
  return response.data;
};

// Get chat history with a specific user
export const getChatHistory = async (chatPartnerId) => {
  const response = await api.get(`/messages/${chatPartnerId}`);
  return response.data;
};

// (Placeholder for future use, e.g., finding users to message)
// export const findUsers = async (searchTerm) => {
//   const response = await api.get(`/users/search?q=${searchTerm}`);
//   return response.data;
// };
