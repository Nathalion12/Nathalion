const mongoose = require('mongoose');

// Replace with your MongoDB connection string if you have one
// For local development, this is a common default.
// The database 'do_me_a_favor_db' will be created if it doesn't exist.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/do_me_a_favor_db';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
