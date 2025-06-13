const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  // Add other profile fields later e.g., bio, avatar
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// We'll add pre-save hook for password hashing here later if needed,
// or handle it in the route. For now, keeping it simple.

module.exports = mongoose.model('User', UserSchema);
