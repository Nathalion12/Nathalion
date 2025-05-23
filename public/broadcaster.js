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

        goLiveButton.disabled = true; // Disable button until connection is open

        socket.onopen = () => {
            updateStatus('Connected to server.');
            goLiveButton.disabled = false; // Enable button
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
            if (parsedMessage.type === 'streamStarted') {
                currentStreamId = parsedMessage.streamId;
                updateStatus(`Stream started! ID: ${parsedMessage.streamId}. Name: "${parsedMessage.streamName}". Waiting for listeners...`);
                // At this point, the server has confirmed the stream, now start sending audio
                startMediaRecorder();
            } else if (parsedMessage.type === 'error') {
                updateStatus(`Server error: ${parsedMessage.message}`, true);
                stopBroadcasting(); // Stop broadcasting if server reports an error related to stream
            } else if (parsedMessage.type === 'info') {
                updateStatus(`Info: ${parsedMessage.message}`);
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

        goLiveButton.disabled = true;
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
});
