const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const messageRoutes = require('../routes/messages');
const userRoutes = // Need user routes to register users for testing messages
    require('../routes/users');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/users', userRoutes); // Mount user routes for user creation
app.use('/api/messages', messageRoutes);


describe('Messaging API (/api/messages)', () => {
  let user1Token, user2Token;
  let user1Id, user2Id;

  beforeAll(async () => {
    // DB connection handled by setup.js
    // Create two users for testing messages
    await User.deleteMany({}); // Clear users before starting this suite

    const user1Data = { username: 'user1', email: 'user1@example.com', password: 'password123' };
    const user2Data = { username: 'user2', email: 'user2@example.com', password: 'password123' };

    let res = await request(app).post('/api/users/register').send(user1Data);
    user1Token = res.body.token;
    const user1 = await User.findOne({email: user1Data.email});
    user1Id = user1._id.toString();


    res = await request(app).post('/api/users/register').send(user2Data);
    user2Token = res.body.token;
    const user2 = await User.findOne({email: user2Data.email});
    user2Id = user2._id.toString();
  });

  beforeEach(async () => {
    // Clear messages before each test
    await Message.deleteMany({});
  });


  it('should send a message successfully between two users', async () => {
    const messageContent = 'Hello User2 from User1';
    const res = await request(app)
      .post('/api/messages')
      .set('x-auth-token', user1Token)
      .send({ receiverId: user2Id, content: messageContent });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('content', messageContent);
    expect(res.body.sender.toString()).toBe(user1Id);
    expect(res.body.receiver.toString()).toBe(user2Id);

    const msgInDb = await Message.findById(res.body._id);
    expect(msgInDb).not.toBeNull();
    expect(msgInDb.content).toBe(messageContent);
  });

  it('should not send a message if receiver does not exist', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('x-auth-token', user1Token)
      .send({ receiverId: new mongoose.Types.ObjectId().toString(), content: 'Test' });
    expect(res.statusCode).toEqual(404);
    expect(res.body.msg).toBe('Receiver not found.');
  });

  it('should not send a message to self', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('x-auth-token', user1Token)
      .send({ receiverId: user1Id, content: 'Test to myself' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.msg).toBe('Cannot send messages to yourself.');
  });

  it('should get chat history between two users', async () => {
    // User1 sends a message to User2
    await request(app).post('/api/messages').set('x-auth-token', user1Token).send({ receiverId: user2Id, content: 'Hi User2' });
    // User2 sends a message to User1
    await request(app).post('/api/messages').set('x-auth-token', user2Token).send({ receiverId: user1Id, content: 'Hi User1' });

    // User1 fetches chat history with User2
    const res = await request(app)
      .get(`/api/messages/${user2Id}`)
      .set('x-auth-token', user1Token);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(2);
    expect(res.body[0].content).toBe('Hi User2');
    expect(res.body[1].content).toBe('Hi User1');
  });

  it('should get conversations for a user', async () => {
    await request(app).post('/api/messages').set('x-auth-token', user1Token).send({ receiverId: user2Id, content: 'First message to User2' });
    await request(app).post('/api/messages').set('x-auth-token', user2Token).send({ receiverId: user1Id, content: 'Reply from User2' });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set('x-auth-token', user1Token);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1); // Only one conversation with User2
    expect(res.body[0].withUser.username).toBe('user2');
    expect(res.body[0].lastMessage).toBe('Reply from User2');
  });
});
