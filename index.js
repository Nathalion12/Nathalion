const express = require('express');
const app = express();
const port = 3000;

// Import WebSocketServer
const { WebSocketServer } = require('ws');

app.get('/', (req, res) => {
  res.send('Beachouse server is running!');
});

// HTTP Endpoint for Active Streams
app.get('/active-streams', (req, res) => {
  const streams = [];
  const WebSocketOPEN = require('ws').OPEN; // Ensure ws is available here
  for (const [streamId, streamData] of activeStreams.entries()) {
    // Only list streams that still have an active broadcaster
    if (streamData.broadcaster && streamData.broadcaster.readyState === WebSocketOPEN) {
      streams.push({
        streamId: streamId,
        streamName: streamData.streamName || 'Untitled Stream'
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
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');

  // Listener for messages from client
  ws.on('message', (message) => {
    try {
      // Handle JSON messages
      const parsedMessage = JSON.parse(message.toString());
      console.log('Received JSON message:', parsedMessage);

      if (parsedMessage.type === 'startStream') {
        const streamId = (nextStreamId++).toString();
        const streamName = parsedMessage.streamName || 'Untitled Stream';
        // Store ws as broadcaster, initialize listeners set, store stream name
        activeStreams.set(streamId, { broadcaster: ws, listeners: new Set(), streamName });
        ws.streamId = streamId; // Associate streamId with the broadcaster's WebSocket connection
        ws.isBroadcaster = true; // Mark this client as a broadcaster

        ws.send(JSON.stringify({ type: 'streamStarted', streamId, streamName }));
        console.log(`Stream ${streamId} ('${streamName}') started by client ${ws.id}.`);

      } else if (parsedMessage.type === 'joinStream') {
        const streamIdToJoin = parsedMessage.streamId;
        if (streamIdToJoin && activeStreams.has(streamIdToJoin)) {
          const stream = activeStreams.get(streamIdToJoin);
          stream.listeners.add(ws);
          ws.joinedStreamId = streamIdToJoin; // Associate streamId with the listener's WebSocket
          ws.isListener = true; // Mark this client as a listener

          ws.send(JSON.stringify({ type: 'joinedStream', streamId: streamIdToJoin, streamName: stream.streamName }));
          console.log(`Listener client ${ws.id} joined stream ${streamIdToJoin} ('${stream.streamName}').`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Stream not found or invalid stream ID.' }));
          console.log(`Client ${ws.id} failed to join stream ${streamIdToJoin}: Not found.`);
        }
      } else if (parsedMessage.type === 'stopStream') { // Broadcaster explicitly stops
        if (ws.isBroadcaster && ws.streamId && activeStreams.has(ws.streamId)) {
            const stream = activeStreams.get(ws.streamId);
            if (stream.broadcaster === ws) { // Ensure it's the actual broadcaster
                console.log(`Stream ${ws.streamId} ('${stream.streamName}') stopped by broadcaster ${ws.id}.`);
                // Notify listeners before deleting
                stream.listeners.forEach(listener => {
                    if (listener.readyState === require('ws').OPEN) {
                        listener.send(JSON.stringify({ type: 'streamEnded', streamId: ws.streamId, reason: 'Broadcaster stopped the stream.' }));
                    }
                });
                activeStreams.delete(ws.streamId);
                // No need to clear ws.streamId or ws.isBroadcaster here, as 'close' event will handle final cleanup
            }
        }
      } else {
        console.log(`Received unhandled JSON message type: ${parsedMessage.type} from client ${ws.id}`);
      }
    } catch (error) { // Not a JSON message, assume binary audio data from a broadcaster
      if (message instanceof Buffer || message instanceof ArrayBuffer || Array.isArray(message)) { // Check if it's binary
        if (ws.isBroadcaster && ws.streamId && activeStreams.has(ws.streamId)) {
          const stream = activeStreams.get(ws.streamId);
          if (stream && stream.broadcaster === ws) { // Ensure it's the correct broadcaster for this stream
            // Relay audio data to all listeners of this stream
            stream.listeners.forEach(listener => {
              if (listener.readyState === require('ws').OPEN) {
                listener.send(message); // Forward raw binary audio data
              }
            });
          } else {
            // console.log(`Received audio data from client ${ws.id} who is not the current broadcaster for stream ${ws.streamId}.`);
          }
        } else {
          // console.log(`Received audio data from client ${ws.id} who is not a recognized broadcaster or stream ID is missing.`);
        }
      } else {
        console.error(`Failed to parse message from client ${ws.id}. Not JSON and not recognized binary. Error:`, error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON or binary audio.' }));
      }
    }
  });

  // Listener for client disconnection
  ws.on('close', () => {
    console.log(`Client ${ws.id} disconnected.`);
    // If the disconnecting client was a broadcaster
    if (ws.isBroadcaster && ws.streamId && activeStreams.has(ws.streamId)) {
      const streamToEnd = activeStreams.get(ws.streamId);
      // Ensure this ws was indeed the broadcaster for this stream
      if (streamToEnd && streamToEnd.broadcaster === ws) {
        const streamId = ws.streamId;
        const streamName = streamToEnd.streamName;
        const listeners = new Set(streamToEnd.listeners); // Copy listeners before deleting stream

        activeStreams.delete(streamId);
        console.log(`Stream ${streamId} ('${streamName}') ended as broadcaster ${ws.id} disconnected.`);

        // Notify all listeners of this stream that it has ended
        listeners.forEach(listener => {
          if (listener.readyState === require('ws').OPEN) {
            listener.send(JSON.stringify({ type: 'streamEnded', streamId: streamId, reason: 'Broadcaster disconnected.' }));
          }
        });
      }
    }
    // If the disconnecting client was a listener
    else if (ws.isListener && ws.joinedStreamId && activeStreams.has(ws.joinedStreamId)) {
      const stream = activeStreams.get(ws.joinedStreamId);
      if (stream) { // Stream might have been deleted if broadcaster disconnected first
        stream.listeners.delete(ws);
        console.log(`Listener client ${ws.id} disconnected from stream ${ws.joinedStreamId}. Remaining listeners: ${stream.listeners.size}`);
      } else {
        console.log(`Listener client ${ws.id} disconnected from stream ${ws.joinedStreamId}, but stream was already removed.`);
      }
    }
  });

  // Assign a unique ID to each client for logging/debugging
  ws.id = (nextStreamId++).toString(); // Re-using nextStreamId for client IDs for simplicity
  console.log(`Client ${ws.id} connected via WebSocket.`);
  // Send welcome message
  ws.send(JSON.stringify({ type: 'info', message: 'Welcome to Beachouse WebSockets!', clientId: ws.id }));
});
