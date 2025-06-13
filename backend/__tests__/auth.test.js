const request = require('supertest');
const express = require('express');
const connectDB = require('../config/db'); // To ensure DB connection logic is loaded
const User = require('../models/User');
const userRoutes = require('../routes/users');
const authMiddleware = require('../middleware/auth'); // Needed if routes directly use it

// Setup Express app for testing
const app = express();
app.use(express.json()); // Body parser for POST requests
app.use('/api/users', userRoutes);

// Mock auth middleware for protected routes if necessary, or perform actual login
// For /api/users/me, we need a token. We can register and login a user to get one.

describe('Auth API (/api/users)', () => {
  let server; // To hold the app instance if your main server.js exports it
  // Or, use the app instance directly if server.js is structured for it.
  // For simplicity, we're using the 'app' instance defined above.

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };
  let token; // To store JWT token for authenticated requests

  beforeAll(async () => {
    // Connect to DB - handled by setup.js
  });

  afterAll(async () => {
    // Disconnect DB - handled by setup.js
  });

  // Clear users before each test in this suite if not handled globally
  beforeEach(async () => {
    await User.deleteMany({});
  });


  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send(testUser);
    expect(res.statusCode).toEqual(200); // Or 201 if you prefer for creation
    expect(res.body).toHaveProperty('token');
    token = res.body.token; // Save token for subsequent tests

    const userInDb = await User.findOne({ email: testUser.email });
    expect(userInDb).not.toBeNull();
    expect(userInDb.username).toBe(testUser.username);
  });

  it('should not register a user with an existing email', async () => {
    await request(app).post('/api/users/register').send(testUser); // First user
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...testUser, username: 'anotheruser' }); // Same email, different username
    expect(res.statusCode).toEqual(400);
    expect(res.body.msg).toBe('User already exists with this email');
  });

  it('should login an existing user successfully', async () => {
    await request(app).post('/api/users/register').send(testUser); // Register user first
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token; // Update token
  });

  it('should not login with incorrect password', async () => {
    await request(app).post('/api/users/register').send(testUser);
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.msg).toContain('Invalid credentials');
  });

  it('should get current user profile with a valid token', async () => {
    // First, register and login to get a token
    const regRes = await request(app).post('/api/users/register').send(testUser);
    const userToken = regRes.body.token;

    const res = await request(app)
      .get('/api/users/me')
      .set('x-auth-token', userToken);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('username', testUser.username);
    expect(res.body).toHaveProperty('email', testUser.email);
    expect(res.body).not.toHaveProperty('password');
  });

  it('should not get profile with an invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('x-auth-token', 'invalidtoken123');
    expect(res.statusCode).toEqual(401);
    expect(res.body.msg).toBe('Token is not valid');
  });
});
