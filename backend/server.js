const express = require('express');
const connectDB = require('./config/db'); // Import DB connection function

const app = express();

// Connect to Database
connectDB();

// Init Middleware for parsing JSON bodies
app.use(express.json({ extended: false }));

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Hello from the Do Me A Favor App Backend!');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', message: 'Backend is healthy' });
});

// Define Routes
app.use('/api/users', require('./routes/users')); // Mount user routes
app.use('/api/messages', require('./routes/messages')); // Mount message routes

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
