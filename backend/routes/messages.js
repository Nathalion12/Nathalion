const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Auth middleware to protect routes
const Message = require('../models/Message');
const User = require('../models/User'); // To validate users
const mongoose = require('mongoose');


// @route   POST api/messages
// @desc    Send a new message
// @access  Private
router.post('/', auth, async (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.user.id; // from auth middleware

  if (!receiverId || !content) {
    return res.status(400).json({ msg: 'Receiver ID and content are required.' });
  }

  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    return res.status(400).json({ msg: 'Invalid Receiver ID format.' });
  }

  if (senderId === receiverId) {
    return res.status(400).json({ msg: 'Cannot send messages to yourself.' });
  }

  try {
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ msg: 'Receiver not found.' });
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
    });

    const message = await newMessage.save();

    // TODO: Consider emitting a socket event here for real-time updates in the future

    res.status(201).json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/messages/conversations
// @desc    Get all conversations (unique users the current user has chatted with)
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).sort({ timestamp: -1 }) // Get most recent messages first
      .populate('sender', 'username') // Populate sender username
      .populate('receiver', 'username'); // Populate receiver username

    let conversations = {};
    messages.forEach(message => {
      // Determine the other participant in the conversation
      let otherParticipantId;
      if (message.sender._id.toString() === userId) {
        otherParticipantId = message.receiver._id.toString();
      } else {
        otherParticipantId = message.sender._id.toString();
      }

      // Store the most recent message for this conversation
      // And the other participant's details
      if (!conversations[otherParticipantId] || message.timestamp > conversations[otherParticipantId].lastMessageTimestamp) {
        conversations[otherParticipantId] = {
          withUser: message.sender._id.toString() === userId ? message.receiver : message.sender,
          lastMessage: message.content,
          lastMessageTimestamp: message.timestamp,
          lastMessageSender: message.sender.username, // Helps in UI to see who sent last
          isRead: (message.receiver._id.toString() === userId && !message.read) ? false : true, // is the last message unread by current user?
          conversationId: otherParticipantId // For fetching full chat history
        };
      }
    });

    // Convert conversations map to an array
    const conversationList = Object.values(conversations).sort((a,b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

    res.json(conversationList);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// @route   GET api/messages/:userId
// @desc    Get chat history with a specific user
// @access  Private
router.get('/:chatPartnerId', auth, async (req, res) => {
  const currentUserId = req.user.id;
  const { chatPartnerId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatPartnerId)) {
    return res.status(400).json({ msg: 'Invalid Chat Partner ID format.' });
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: chatPartnerId },
        { sender: chatPartnerId, receiver: currentUserId },
      ],
    })
    .populate('sender', 'username') // Populate sender's username
    .populate('receiver', 'username') // Populate receiver's username
    .sort({ timestamp: 1 }); // Sort by oldest first for chat display

    // Optional: Mark messages as read when fetched by the receiver
    // This is a common pattern but can also be a separate PUT /read endpoint
    await Message.updateMany(
      { receiver: currentUserId, sender: chatPartnerId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
