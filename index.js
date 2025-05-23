const express = require('express');
const app = express();
const port = 3000;

// Import WebSocketServer
const { WebSocketServer } = require('ws');
const bcrypt = require('bcrypt');
const db = require('./db');

// Middleware for parsing JSON bodies
app.use(express.json());

const saltRounds = 10; // For bcrypt password hashing

// JWT Configuration
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-and-long-key-that-is-at-least-32-chars'; 
// IMPORTANT: Use a strong, environment-managed JWT_SECRET for production! 
// It should be at least 32 characters long and cryptographically random.
const JWT_EXPIRES_IN = '1h'; // Token expiration time

app.get('/', (req, res) => {
  res.send('Beachouse server is running!');
});

// User Registration Route
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Basic Input Validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }
  if (!email.includes('@')) { // Simple email format check
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const queryText = 'INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING user_id, username, email, created_at';
    const values = [username, email, passwordHash];
    const result = await db.query(queryText, values);

    // Send success response
    res.status(201).json({ 
      message: 'User registered successfully!', 
      user: {
        user_id: result.rows[0].user_id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        created_at: result.rows[0].created_at
      } 
    });

  } catch (err) {
    console.error('Registration error:', err.stack); // Log the full error stack

    // Check for unique constraint violation (PostgreSQL error code '23505')
    if (err.code === '23505') {
      let duplicateField = 'unknown';
      if (err.constraint === 'users_username_key') {
        duplicateField = 'Username';
      } else if (err.constraint === 'users_email_key') {
        duplicateField = 'Email';
      }
      return res.status(409).json({ message: `${duplicateField} already exists.` });
    }
    
    // For other errors
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// User Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic Input Validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Retrieve User from Database
    const queryText = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(queryText, [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT
    const payload = { 
      userId: user.user_id, 
      username: user.username 
      // You can add more non-sensitive info to the payload if needed, e.g., roles
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Send success response
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email
        // Do not send password_hash or other sensitive info
      }
    });

  } catch (err) {
    console.error('Login error:', err.stack); // Log the full error stack
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (token == null) {
    return res.status(401).json({ message: 'Access token is missing or invalid.' });
  }

  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) {
      // Differentiate between expired and invalid token for more specific client feedback if desired
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Token has expired.' });
      }
      return res.status(403).json({ message: 'Token is invalid.' });
    }
    req.user = userPayload; // Add user payload to request object
    next(); // Proceed to the next middleware or route handler
  });
}

// Example Protected Route
app.get('/api/protected-test', authenticateToken, (req, res) => {
  res.json({ 
    message: `Hello ${req.user.username}! This is a protected route. Your user ID is ${req.user.userId}.`,
    user: req.user 
  });
});

// HTTP Endpoint for Active Streams
app.get('/active-streams', (req, res) => {
  const streams = [];
  const WebSocketOPEN = require('ws').OPEN;
  for (const [streamId, streamData] of activeStreams.entries()) {
    if (streamData.broadcaster && streamData.broadcaster.readyState === WebSocketOPEN) {
      streams.push({
        streamId: streamId,
        streamName: streamData.streamName || 'Untitled Stream',
        broadcasterId: streamData.broadcasterId,
        broadcasterUsername: streamData.broadcasterUsername
      });
    }
  }
  res.json(streams);
});

// Get the HTTP server instance
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// In-memory store for active streams
const activeStreams = new Map();
let nextStreamId = 1; // Simple counter for unique stream IDs

// WebSocket connection listener
wss.on('connection', (ws, req) => { // Added req to potentially access original request if needed
  ws.isAuthenticated = false; // Initialize authentication status
  ws.user = null; // Store user payload
  // Assign a unique ID to each client for logging/debugging (moved earlier)
  ws.id = (nextStreamId++).toString(); // Re-using nextStreamId for client IDs for simplicity
  console.log(`Client ${ws.id} connected via WebSocket.`);

  // Send welcome message (can be sent before auth)
  ws.send(JSON.stringify({ type: 'info', message: 'Welcome to Beachouse WebSockets! Please authenticate.', clientId: ws.id }));

  // Listener for messages from client
  ws.on('message', (message) => {
    try {
      // Handle JSON messages
      const parsedMessage = JSON.parse(message.toString());
      console.log(`Received JSON message from client ${ws.id}:`, parsedMessage);

      if (parsedMessage.type === 'auth') {
        if (ws.isAuthenticated) {
          ws.send(JSON.stringify({ type: 'authSuccess', message: 'Already authenticated.' }));
          return;
        }
        jwt.verify(parsedMessage.token, JWT_SECRET, (err, userPayload) => {
          if (err) {
            console.error(`Authentication failed for client ${ws.id}:`, err.message);
            ws.send(JSON.stringify({ type: 'authFailure', message: `Authentication failed: ${err.message}` }));
            // Optionally close connection after failed auth attempt
            // ws.close(); 
          } else {
            ws.isAuthenticated = true;
            ws.user = userPayload; // Store { userId, username }
            console.log(`Client ${ws.id} authenticated successfully as user ${ws.user.username} (ID: ${ws.user.userId}).`);
            ws.send(JSON.stringify({ type: 'authSuccess', message: 'Authenticated successfully.', user: ws.user }));
          }
        });
        return; // Auth message handled, return
      }

      // All other actions require authentication first
      if (!ws.isAuthenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Please authenticate first.' }));
        return;
      }

      if (parsedMessage.type === 'startStream') {
        if (!ws.user) { // Should be redundant if ws.isAuthenticated is true
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication error, user data not found.' }));
          return;
        }
        const streamId = (nextStreamId++).toString(); // Use a different ID counter for streams
        const streamName = parsedMessage.streamName || 'Untitled Stream';
        
        activeStreams.set(streamId, {
          broadcaster: ws,
          listeners: new Set(),
          streamName: streamName,
          broadcasterId: ws.user.userId,      // New
          broadcasterUsername: ws.user.username // New
        });
        ws.streamId = streamId; // Associate streamId with the WebSocket connection
        ws.isBroadcaster = true; // Mark this client as a broadcaster

        ws.send(JSON.stringify({ 
          type: 'streamStarted', 
          streamId, 
          streamName, 
          broadcasterUsername: ws.user.username 
        }));
        console.log(`Stream ${streamId} ('${streamName}') started by client ${ws.id} (User: ${ws.user.username}).`);

      } else if (parsedMessage.type === 'joinStream') {
        // Note: Listeners do not need to be authenticated for this subtask.
        // If listener authentication were required, a similar ws.isAuthenticated check would be here.
        const streamIdToJoin = parsedMessage.streamId;
        if (streamIdToJoin && activeStreams.has(streamIdToJoin)) {
          const stream = activeStreams.get(streamIdToJoin);
          stream.listeners.add(ws);
          ws.joinedStreamId = streamIdToJoin; // Associate streamId with the listener's WebSocket
          ws.isListener = true; // Mark this client as a listener

          ws.send(JSON.stringify({ 
            type: 'joinedStream', 
            streamId: streamIdToJoin, 
            streamName: stream.streamName,
            broadcasterUsername: stream.broadcasterUsername // Added broadcasterUsername
          }));
          console.log(`Listener client ${ws.id} joined stream ${streamIdToJoin} ('${stream.streamName}') by ${stream.broadcasterUsername}.`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Stream not found or invalid stream ID.' }));
          console.log(`Client ${ws.id} failed to join stream ${streamIdToJoin}: Not found.`);
        }
      } else if (parsedMessage.type === 'stopStream') {
        if (!ws.isBroadcaster || !ws.streamId || !activeStreams.has(ws.streamId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not a broadcaster or no active stream to stop.' }));
          return;
        }
        const stream = activeStreams.get(ws.streamId);
        if (stream.broadcaster === ws) { // Ensure it's the actual broadcaster
            console.log(`Stream ${ws.streamId} ('${stream.streamName}') stopped by broadcaster ${ws.id} (User: ${ws.user.username}).`);
            stream.listeners.forEach(listener => {
                if (listener.readyState === require('ws').OPEN) {
                    listener.send(JSON.stringify({ type: 'streamEnded', streamId: ws.streamId, reason: 'Broadcaster stopped the stream.' }));
                }
            });
            activeStreams.delete(ws.streamId);
        } else {
             ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized to stop this stream.' }));
        }
      } else {
        console.log(`Received unhandled JSON message type: ${parsedMessage.type} from client ${ws.id}`);
      }
    } catch (error) { // Not a JSON message, assume binary audio data from a broadcaster
      if (!ws.isAuthenticated) {
        // If not authenticated, and message isn't JSON (so not an 'auth' message), it might be an early binary stream.
        // Or just an invalid message. We'll treat as error.
        console.log(`Client ${ws.id} sent non-JSON message before authenticating.`);
        ws.send(JSON.stringify({ type: 'error', message: 'Please authenticate first with a JSON auth message.' }));
        return;
      }

      if (message instanceof Buffer || message instanceof ArrayBuffer || Array.isArray(message)) {
        if (ws.isBroadcaster && ws.streamId && activeStreams.has(ws.streamId)) {
          const stream = activeStreams.get(ws.streamId);
          if (stream && stream.broadcaster === ws) {
            stream.listeners.forEach(listener => {
              if (listener.readyState === require('ws').OPEN) {
                listener.send(message);
              }
            });
          }
        }
      } else {
        console.error(`Failed to parse message from client ${ws.id}. Not JSON and not recognized binary. Error:`, error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON or binary audio.' }));
      }
    }
  });

  // Listener for client disconnection
  ws.on('close', () => {
    console.log(`Client ${ws.id} (User: ${ws.user ? ws.user.username : 'anonymous'}) disconnected.`);
    if (ws.isBroadcaster && ws.streamId && activeStreams.has(ws.streamId)) {
      const streamToEnd = activeStreams.get(ws.streamId);
      if (streamToEnd && streamToEnd.broadcaster === ws) {
        const streamId = ws.streamId;
        const streamName = streamToEnd.streamName;
        const listeners = new Set(streamToEnd.listeners);

        activeStreams.delete(streamId);
        console.log(`Stream ${streamId} ('${streamName}') by user ${ws.user ? ws.user.username : 'unknown'} ended as broadcaster ${ws.id} disconnected.`);

        listeners.forEach(listener => {
          if (listener.readyState === require('ws').OPEN) {
            listener.send(JSON.stringify({ type: 'streamEnded', streamId: streamId, reason: 'Broadcaster disconnected.' }));
          }
        });
      }
    }
    else if (ws.isListener && ws.joinedStreamId && activeStreams.has(ws.joinedStreamId)) {
      const stream = activeStreams.get(ws.joinedStreamId);
      if (stream) {
        stream.listeners.delete(ws);
        console.log(`Listener client ${ws.id} disconnected from stream ${ws.joinedStreamId}. Remaining listeners: ${stream.listeners.size}`);
      } else {
        console.log(`Listener client ${ws.id} disconnected from stream ${ws.joinedStreamId}, but stream was already removed.`);
      }
    }
  });
});
