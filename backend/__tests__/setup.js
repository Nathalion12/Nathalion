const mongoose = require('mongoose');
const connectDB = require('../config/db'); // Assuming this now properly handles connections for test env
const User = require('../models/User');
const Message = require('../models/Message');

// Use a separate test database
process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/do_me_a_favor_db_test';
process.env.JWT_SECRET = 'testsecretkey'; // Use a fixed secret for tests

beforeAll(async () => {
  await connectDB(); // Connect to the test database
});

afterEach(async () => {
  // Clean up database after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect(); // Disconnect after all tests
});
