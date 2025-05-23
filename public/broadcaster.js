document.addEventListener('DOMContentLoaded', () => {
    const goLiveButton = document.getElementById('goLiveButton');
    const streamNameInput = document.getElementById('streamName');
    const statusMessages = document.getElementById('statusMessages');

    let socket;
    let mediaRecorder;
    let localStream; // To keep track of the stream from getUserMedia
    let currentStreamId; // To store the ID of the current stream

    function updateStatus(message, isError = false) {
        console.log(message);
        statusMessages.textContent = message;
        if (isError) {
            statusMessages.style.color = 'red';
        } else {
            statusMessages.style.color = 'inherit';
        }
    }

    function connectWebSocket() {
        // Determine WebSocket protocol based on window.location.protocol
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(wsProtocol + window.location.host);

        goLiveButton.disabled = true; // Disable button until connection and authentication are successful

        socket.onopen = () => {
            updateStatus('Connected to server. Authenticating...');
            const token = localStorage.getItem('beachouse_token');
            if (token) {
                socket.send(JSON.stringify({ type: 'auth', token: token }));
            } else {
                updateStatus("Authentication token not found. Please login.", true);
                // Optionally redirect to login page or show a more prominent error
                // window.location.href = 'login.html';
                goLiveButton.disabled = true; // Keep disabled
            }
        };

        socket.onmessage = (event) => {
            let parsedMessage;
            try {
                if (typeof event.data === 'string') {
                    parsedMessage = JSON.parse(event.data);
                } else {
                    // If it's not a string, it might be binary data (like from the stream later)
                    // For now, we only expect JSON control messages from the server to the broadcaster
                    console.log('Received binary/non-JSON message:', event.data);
                    return;
                }
            } catch (error) {
                updateStatus(`Error parsing message from server: ${error.message}`, true);
                return;
            }

            console.log('Server message:', parsedMessage);

            if (parsedMessage.type === 'authSuccess') {
                updateStatus(`Authenticated as ${parsedMessage.user.username}. Ready to go live.`);
                goLiveButton.disabled = false; // Enable Go Live button after successful auth
                
                // Display logged-in username
                const usernameDisplay = document.getElementById('loggedInUsername');
                if (usernameDisplay) {
                    usernameDisplay.textContent = parsedMessage.user.username;
                }
                // Store/update user info in localStorage for persistence across page loads (optional)
                localStorage.setItem('beachouse_user', JSON.stringify(parsedMessage.user));

            } else if (parsedMessage.type === 'authFailure') {
                updateStatus(`Authentication failed: ${parsedMessage.message}. Please login again.`, true);
                goLiveButton.disabled = true; // Keep Go Live button disabled
                const usernameDisplay = document.getElementById('loggedInUsername');
                if (usernameDisplay) {
                    usernameDisplay.textContent = 'Guest'; // Reset to guest
                }
                // Optionally redirect to login page
                // setTimeout(() => { window.location.href = 'login.html'; }, 3000);
            } else if (parsedMessage.type === 'streamStarted') {
                currentStreamId = parsedMessage.streamId;
                updateStatus(`Stream started by ${parsedMessage.broadcasterUsername}! ID: ${parsedMessage.streamId}. Name: "${parsedMessage.streamName}". Waiting for listeners...`);
                startMediaRecorder();
            } else if (parsedMessage.type === 'error') {
                updateStatus(`Server error: ${parsedMessage.message}`, true);
                if (parsedMessage.message === 'Please authenticate first.') {
                     goLiveButton.disabled = true;
                } else {
                    stopBroadcasting(); // Stop broadcasting if server reports other errors
                }
            } else if (parsedMessage.type === 'info') {
                // Avoid overwriting critical auth messages if an info message arrives early
                if (statusMessages.textContent.includes('Authenticating...') || statusMessages.textContent.includes('Connected to server')) {
                     updateStatus(`Info: ${parsedMessage.message}`);
                } else if (!statusMessages.textContent.includes('failed') && !statusMessages.textContent.includes('Authenticated as')) {
                    updateStatus(`Info: ${parsedMessage.message}`);
                }
            } else {
                console.log('Received unhandled message type from server:', parsedMessage.type);
            }
        };

        socket.onclose = () => {
            updateStatus('Disconnected from server.', true);
            goLiveButton.disabled = true;
            stopBroadcasting(); // Ensure resources are released
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('WebSocket error. Check console.', true);
            goLiveButton.disabled = true;
            stopBroadcasting(); // Ensure resources are released
        };
    }

    function startMediaRecorder() {
        if (!localStream || !socket || socket.readyState !== WebSocket.OPEN) {
            updateStatus('Cannot start media recorder: local stream or socket not ready.', true);
            return;
        }
        if (goLiveButton.disabled) { // Check if button is disabled (which implies not authenticated)
            updateStatus('Cannot start stream: Not authenticated or authentication failed.', true);
            return;
        }
        
        try {
            mediaRecorder = new MediaRecorder(localStream, { mimeType: 'audio/webm' });
        } catch (e) {
            console.error("Error creating MediaRecorder:", e);
            updateStatus(`Error creating MediaRecorder: ${e.message}. Try a different browser or check mimeType.`, true);
            return;
        }


        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket && socket.readyState === WebSocket.OPEN) {
                // Prefix with streamId for the server to route correctly
                // This is a simple way to multiplex data; more robust solutions might use dedicated channels or message types
                const message = {
                    type: 'streamData',
                    streamId: currentStreamId,
                    // The actual audio data will be sent as a Blob after this JSON header
                };
                // We can't send a mix of JSON and Blob directly in one go.
                // The server-side logic will need to be adapted if we want to send metadata along with audio.
                // For now, the server handles raw blob data by associating it with the broadcaster's connection.
                // A more robust approach would be:
                // 1. Client sends `startStream` (as is)
                // 2. Server confirms with `streamStarted` (as is)
                // 3. Client then starts sending raw audio blobs. Server knows this ws is the broadcaster for `currentStreamId`.
                socket.send(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            updateStatus(`Streaming live... (Stream ID: ${currentStreamId})`);
            goLiveButton.textContent = 'Stop Stream'; // Change button text
            goLiveButton.onclick = stopBroadcasting; // Change button action
        };

        mediaRecorder.onstop = () => {
            updateStatus('Stream stopped.');
            goLiveButton.textContent = 'Go Live';
            goLiveButton.onclick = goLiveClickHandler; // Reset button action
            goLiveButton.disabled = (socket && socket.readyState !== WebSocket.OPEN);

            // If the stream was stopped locally, inform the server
            if (socket && socket.readyState === WebSocket.OPEN && currentStreamId) {
                socket.send(JSON.stringify({ type: 'stopStream', streamId: currentStreamId }));
            }
            currentStreamId = null; // Reset stream ID
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            updateStatus(`MediaRecorder error: ${event.error.name} - ${event.error.message}`, true);
            stopBroadcasting();
        };

        try {
            mediaRecorder.start(1000); // Send data every 1000ms (1 second)
        } catch (e) {
            console.error("Error starting MediaRecorder:", e);
            updateStatus(`Error starting MediaRecorder: ${e.message}.`, true);
        }
    }

    function stopBroadcasting() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        updateStatus('Stream ended and resources released.');
        goLiveButton.textContent = 'Go Live';
        goLiveButton.onclick = goLiveClickHandler;
        if (socket && socket.readyState === WebSocket.OPEN) {
            goLiveButton.disabled = false;
             // If stream was stopped, and server wasn't notified via mediaRecorder.onstop (e.g. abrupt stop)
            if (currentStreamId) {
                 socket.send(JSON.stringify({ type: 'stopStream', streamId: currentStreamId }));
                 currentStreamId = null;
            }
        } else {
            goLiveButton.disabled = true;
        }
    }

    function goLiveClickHandler() {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            updateStatus('Not connected to server. Attempting to reconnect...', true);
            connectWebSocket(); // Attempt to reconnect if not connected
            return;
        }
        
        // Check if the button is disabled (which means not authenticated or some other error)
        if (goLiveButton.disabled) {
            updateStatus('Cannot go live. Ensure you are connected and authenticated.', true);
            // Attempt to re-authenticate if socket is open but button is disabled
            if (socket.readyState === WebSocket.OPEN) {
                const token = localStorage.getItem('beachouse_token');
                if (token) {
                    socket.send(JSON.stringify({ type: 'auth', token: token }));
                } else {
                    updateStatus("Authentication token not found. Please login.", true);
                }
            }
            return;
        }

        goLiveButton.disabled = true; // Temporarily disable while setting up stream
        updateStatus('Requesting microphone access...');

        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                updateStatus('Microphone access granted. Preparing stream...');
                localStream = stream; // Store the stream

                const streamName = streamNameInput.value.trim() || 'Untitled Stream';
                socket.send(JSON.stringify({ type: 'startStream', streamName: streamName }));
                // Note: mediaRecorder.start() will be called from socket.onmessage when 'streamStarted' is received
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                updateStatus(`Could not access microphone: ${err.message}`, true);
                goLiveButton.disabled = (socket && socket.readyState !== WebSocket.OPEN);
            });
    }

    goLiveButton.onclick = goLiveClickHandler;

    // Initial connection attempt
    connectWebSocket();

    // Attempt to display username on page load if already logged in
    const storedUser = localStorage.getItem('beachouse_user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            const usernameDisplay = document.getElementById('loggedInUsername');
            if (usernameDisplay && user && user.username) {
                usernameDisplay.textContent = user.username;
            }
        } catch (e) {
            console.error("Error parsing stored user data:", e);
            localStorage.removeItem('beachouse_user'); // Clear corrupted data
        }
    }
});
