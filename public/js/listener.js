document.addEventListener('DOMContentLoaded', () => {
    const streamIdInput = document.getElementById('streamIdInput');
    const joinStreamButton = document.getElementById('joinStreamButton');
    const statusMessages = document.getElementById('statusMessages');
    const audioPlaybackElement = document.getElementById('audioPlayback');
    const activeStreamsList = document.getElementById('activeStreamsList');
    const refreshStreamsButton = document.getElementById('refreshStreamsButton');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages'); // For later use

    let socket;
    let audioContext; 
    let mediaSource;
    let sourceBuffer;
    const audioQueue = [];
    let isPlaying = false;
    let isMediaSourceOpen = false;
    const audioCodec = 'audio/webm; codecs=opus'; 

    function updateStatus(message, isError = false) {
        console.log(message);
        statusMessages.textContent = message;
        messageArea.className = 'message-feedback'; // Base class
        if (isError) {
            statusMessages.classList.add('message-error');
        } else {
            // Clear potential error class if it was a success/info message
            statusMessages.classList.remove('message-error');
        }
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(wsProtocol + window.location.host);

        joinStreamButton.disabled = true;
        refreshStreamsButton.disabled = true;
        updateStatus('Connecting to server...');

        socket.onopen = () => {
            updateStatus('Connected to server. Enter a Stream ID and click Join, or select from active streams.');
            joinStreamButton.disabled = false;
            refreshStreamsButton.disabled = false;
            fetchActiveStreams(); 
        };

        socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                try {
                    const message = JSON.parse(event.data);
                    console.log('Server JSON message:', message);

                    if (message.type === 'joinedStream') {
                        updateStatus(`Joined stream: "${message.streamName}" by ${message.broadcasterUsername || 'Unknown User'} (ID: ${message.streamId})`);
                        initMediaSource();
                        // Restore Join Stream button state (as it was disabled before sending message)
                        const originalButtonText = joinStreamButton.dataset.originalText || 'Join Stream';
                        joinStreamButton.disabled = false;
                        joinStreamButton.textContent = originalButtonText;
                    } else if (message.type === 'streamEnded') {
                        updateStatus(`Stream ${message.streamId} has ended. Reason: ${message.reason}`, true);
                        cleanupMediaSource();
                    } else if (message.type === 'error') {
                        updateStatus(`Server error: ${message.message}`, true);
                         // Restore Join Stream button state if the error is related to joining
                        if(message.message.includes('Stream not found') || message.message.includes('invalid stream ID')) {
                            const originalButtonText = joinStreamButton.dataset.originalText || 'Join Stream';
                            joinStreamButton.disabled = false;
                            joinStreamButton.textContent = originalButtonText;
                        }
                    } else if (message.type === 'info') {
                        updateStatus(`Info: ${message.message}`);
                    } else {
                        console.log('Received unhandled JSON message type:', message.type);
                    }
                } catch (e) {
                    updateStatus(`Error parsing JSON message from server: ${e.message}`, true);
                }
            } else if (event.data instanceof Blob) {
                audioQueue.push(event.data);
                processAudioQueue();
            } else if (parsedMessage.type === 'newChatMessage') {
                if (chatMessages) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('chat-message');

                    // Check if it's the user's own message (if user info is available)
                    // Listeners don't "log in" in the same way as broadcasters for this app,
                    // so 'own-message' styling might be less relevant or based on a temporary session ID if implemented.
                    // For now, we'll skip 'own-message' for listeners or assume all messages are from others.
                    // const currentUser = JSON.parse(localStorage.getItem('beachouse_user'));
                    // if (currentUser && parsedMessage.username === currentUser.username) {
                    //    messageElement.classList.add('own-message');
                    // }

                    const timestamp = new Date(parsedMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const usernameSpan = document.createElement('strong');
                    usernameSpan.className = 'username';
                    usernameSpan.textContent = parsedMessage.username;

                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'timestamp';
                    timestampSpan.textContent = ` [${timestamp}]`;

                    const textSpan = document.createElement('span');
                    textSpan.className = 'text';
                    textSpan.textContent = parsedMessage.text;

                    messageElement.appendChild(usernameSpan);
                    messageElement.appendChild(timestampSpan);
                    messageElement.appendChild(document.createTextNode(': '));
                    messageElement.appendChild(textSpan);

                    chatMessages.appendChild(messageElement);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                console.warn('Received unknown message type from server:', event.data);
            }
        };

        socket.onclose = () => {
            updateStatus('Disconnected from server.', true);
            joinStreamButton.disabled = true;
            refreshStreamsButton.disabled = true;
            cleanupMediaSource();
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('WebSocket error. Check console.', true);
            joinStreamButton.disabled = true;
            refreshStreamsButton.disabled = true;
            cleanupMediaSource();
        };
    }

    function initMediaSource() {
        if (!audioContext) { 
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                updateStatus('AudioContext not supported by this browser.', true);
                return;
            }
        }
        
        if (mediaSource && mediaSource.readyState !== 'closed') {
           cleanupMediaSource(); 
        }

        try {
            mediaSource = new MediaSource();
        } catch(e) {
            updateStatus('MediaSource API not available.', true);
            return;
        }
        
        audioPlaybackElement.src = URL.createObjectURL(mediaSource);
        isMediaSourceOpen = false; 

        mediaSource.addEventListener('sourceopen', () => {
            isMediaSourceOpen = true;
            URL.revokeObjectURL(audioPlaybackElement.src); 

            try {
                if (!MediaSource.isTypeSupported(audioCodec)) {
                    updateStatus(`Codec ${audioCodec} not supported.`, true);
                    cleanupMediaSource();
                    return;
                }
                sourceBuffer = mediaSource.addSourceBuffer(audioCodec);
                sourceBuffer.mode = 'sequence'; 

                sourceBuffer.addEventListener('updateend', processAudioQueue);
                sourceBuffer.addEventListener('error', (ev) => {
                    console.error('SourceBuffer error:', ev);
                    updateStatus('SourceBuffer error. Check console.', true);
                });
                processAudioQueue();
            } catch (e) {
                updateStatus(`Error adding SourceBuffer: ${e.message}`, true);
                cleanupMediaSource();
            }
        }, { once: true }); 

        mediaSource.addEventListener('sourceended', () => isMediaSourceOpen = false);
        mediaSource.addEventListener('sourceclose', () => isMediaSourceOpen = false);
        
        audioPlaybackElement.play().then(() => {
            isPlaying = true;
        }).catch(e => {
            console.error('Autoplay was prevented:', e);
            updateStatus('Playback waiting for user interaction.');
        });
    }

    async function processAudioQueue() {
        if (!audioQueue.length || !sourceBuffer || sourceBuffer.updating || !isMediaSourceOpen) {
            return;
        }

        const audioBlob = audioQueue.shift();
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            sourceBuffer.appendBuffer(arrayBuffer);
            if (!isPlaying && audioPlaybackElement.paused && audioPlaybackElement.buffered.length > 0) {
                audioPlaybackElement.play().then(() => isPlaying = true).catch(e => console.warn('Play attempt failed:', e));
            }
        } catch (error) {
            console.error('Error appending buffer:', error);
            updateStatus(`Error processing audio: ${error.message}`, true);
        }
    }
    
    function cleanupMediaSource() {
        isPlaying = false;
        isMediaSourceOpen = false;
        audioQueue.length = 0; 

        if (mediaSource && mediaSource.readyState === 'open') {
            try {
                if (sourceBuffer && !sourceBuffer.updating) {
                    mediaSource.endOfStream();
                } else if (sourceBuffer && sourceBuffer.updating) {
                    sourceBuffer.abort(); 
                }
            } catch (e) {
                console.error("Error during mediaSource.endOfStream() or abort():", e);
            }
        }
        mediaSource = null;
        sourceBuffer = null;
    }

    joinStreamButton.addEventListener('click', () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            updateStatus('Not connected to server. Please wait or refresh.', true);
            return;
        }

        const streamId = streamIdInput.value.trim();
        if (streamId) {
            cleanupMediaSource(); 
            
            const originalButtonText = joinStreamButton.textContent;
            joinStreamButton.dataset.originalText = originalButtonText; // Store for later
            joinStreamButton.disabled = true;
            joinStreamButton.textContent = 'Joining...';
            
            socket.send(JSON.stringify({ type: 'joinStream', streamId: streamId }));
            updateStatus(`Attempting to join stream ID: ${streamId}...`);
        } else {
            updateStatus('Please enter a Stream ID.', true);
        }
    });

    async function fetchActiveStreams() {
        if (!activeStreamsList || !refreshStreamsButton) return; 
        
        const originalButtonText = refreshStreamsButton.textContent;
        refreshStreamsButton.disabled = true;
        refreshStreamsButton.textContent = 'Loading...';
        activeStreamsList.innerHTML = '<li>Loading streams...</li>';

        try {
            const response = await fetch('/active-streams');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const streams = await response.json();

            activeStreamsList.innerHTML = ''; 

            if (streams.length === 0) {
                activeStreamsList.innerHTML = '<p>No active streams currently.</p>'; // Use <p> for consistency
            } else {
                streams.forEach(stream => {
                    const card = document.createElement('div');
                    card.classList.add('stream-card');
                    card.dataset.streamId = stream.streamId; // Store streamId for click event

                    const nameEl = document.createElement('h3');
                    nameEl.classList.add('stream-card-name');
                    nameEl.textContent = stream.streamName || 'Untitled Stream';
                    card.appendChild(nameEl);

                    const broadcasterEl = document.createElement('p');
                    broadcasterEl.classList.add('stream-card-broadcaster');
                    broadcasterEl.textContent = `By: ${stream.broadcasterUsername || 'Unknown User'}`;
                    card.appendChild(broadcasterEl);

                    // Optional: Placeholder for listener count or other info
                    // const infoEl = document.createElement('p');
                    // infoEl.classList.add('stream-card-info');
                    // infoEl.textContent = 'Listeners: N/A';
                    // card.appendChild(infoEl);

                    card.addEventListener('click', () => {
                        streamIdInput.value = stream.streamId;
                        if (!joinStreamButton.disabled) {
                            joinStreamButton.click(); 
                        } else {
                            updateStatus('Cannot join stream now. WebSocket might not be ready.', true);
                        }
                    });

                    activeStreamsList.appendChild(card);
                });
            }
        } catch (error) {
            console.error('Error fetching active streams:', error);
            activeStreamsList.innerHTML = '<p>Error loading streams. Please try again.</p>'; // Use <p>
            updateStatus(`Error fetching streams: ${error.message}`, true);
        } finally {
            refreshStreamsButton.disabled = false;
            refreshStreamsButton.textContent = originalButtonText;
        }
    }

    if (refreshStreamsButton) {
        refreshStreamsButton.addEventListener('click', fetchActiveStreams);
    }

    connectWebSocket();

    // Chat Form Submit Listener
    if (chatForm) {
        chatForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const messageText = chatInput.value.trim();
            if (messageText && socket && socket.readyState === WebSocket.OPEN) {
                // Server will validate authentication and stream association.
                // Client assumes if chat is visible, user is authenticated and in a stream.
                socket.send(JSON.stringify({
                    type: 'sendChatMessage',
                    text: messageText
                }));
                chatInput.value = ''; // Clear input after sending
            } else if (!messageText) {
                // console.warn('Chat message cannot be empty.');
            } else {
                console.warn('WebSocket not connected. Cannot send chat message.');
                updateStatus('Not connected to chat. Please join a stream and ensure you are connected.', true);
            }
        });
    }
});
