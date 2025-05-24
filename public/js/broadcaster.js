document.addEventListener('DOMContentLoaded', () => {
    const goLiveButton = document.getElementById('goLiveButton');
    const streamNameInput = document.getElementById('streamName');
    const statusMessages = document.getElementById('statusMessages');
    const loggedInUsernameSpan = document.getElementById('loggedInUsername');
    const liveIndicator = document.getElementById('liveIndicator'); 
    const currentStreamInfoDiv = document.getElementById('currentStreamInfo');
    const currentStreamNameDisplaySpan = document.getElementById('currentStreamNameDisplay');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages'); // For later use

    let socket;
    let mediaRecorder;
    let localStream; 
    let currentStreamId; 
    let originalGoLiveButtonText = goLiveButton ? goLiveButton.textContent : 'Go Live';

    function updateStatus(message, isError = false) {
        console.log(message);
        if (statusMessages) { // Check if statusMessages exists
            statusMessages.textContent = message;
            statusMessages.className = 'message-feedback'; // Base class
            if (isError) {
                statusMessages.classList.add('message-error');
            } else {
                statusMessages.classList.remove('message-error');
            }
        }
    }
    
    function setGoLiveButtonState(disabled, text) {
        if (goLiveButton) {
            goLiveButton.disabled = disabled;
            goLiveButton.textContent = text;
        }
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(wsProtocol + window.location.host);

        setGoLiveButtonState(true, originalGoLiveButtonText); 
        if (liveIndicator) liveIndicator.style.display = 'none';


        socket.onopen = () => {
            updateStatus('Connected to server. Authenticating...');
            const token = localStorage.getItem('beachouse_token');
            if (token) {
                socket.send(JSON.stringify({ type: 'auth', token: token }));
            } else {
                updateStatus("Authentication token not found. Please login.", true);
                if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'Guest';
            }
        };

        socket.onmessage = (event) => {
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(event.data);
            } catch (error) {
                updateStatus(`Error parsing message from server: ${error.message}`, true);
                return;
            }

            console.log('Server message:', parsedMessage);

            if (parsedMessage.type === 'authSuccess') {
                updateStatus(`Authenticated as ${parsedMessage.user.username}. Ready to go live.`);
                if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = parsedMessage.user.username;
                localStorage.setItem('beachouse_user', JSON.stringify(parsedMessage.user));
                setGoLiveButtonState(false, originalGoLiveButtonText);
            } else if (parsedMessage.type === 'authFailure') {
                updateStatus(`Authentication failed: ${parsedMessage.message}. Please login again.`, true);
                if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'Guest';
                setGoLiveButtonState(true, originalGoLiveButtonText); // Keep disabled
            } else if (parsedMessage.type === 'streamStarted') {
                currentStreamId = parsedMessage.streamId;
                const currentStreamName = parsedMessage.streamName || 'Untitled Stream';
                updateStatus(`Stream started by ${parsedMessage.broadcasterUsername}! ID: ${parsedMessage.streamId}. Name: "${currentStreamName}".`);
                if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = currentStreamName;
                if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'block';
                startMediaRecorder(); 
            } else if (parsedMessage.type === 'error') {
                updateStatus(`Server error: ${parsedMessage.message}`, true);
                if (parsedMessage.message === 'Please authenticate first.') {
                     setGoLiveButtonState(true, originalGoLiveButtonText);
                } else {
                    setGoLiveButtonState(false, originalGoLiveButtonText);
                }
                 if (liveIndicator) liveIndicator.style.display = 'none'; // Hide on error
            } else if (parsedMessage.type === 'info') {
                updateStatus(`Info: ${parsedMessage.message}`);
            } else if (parsedMessage.type === 'newChatMessage') {
                if (chatMessages) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('chat-message');

                    const currentUser = JSON.parse(localStorage.getItem('beachouse_user'));
                    if (currentUser && parsedMessage.username === currentUser.username) {
                        messageElement.classList.add('own-message');
                    }

                    const timestamp = new Date(parsedMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const usernameSpan = document.createElement('strong');
                    usernameSpan.className = 'username';
                    usernameSpan.textContent = parsedMessage.username;

                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'timestamp';
                    timestampSpan.textContent = ` [${timestamp}]`;

                    const textSpan = document.createElement('span');
                    textSpan.className = 'text';
                    textSpan.textContent = parsedMessage.text; // Server is responsible for sanitizing if needed before broadcast

                    messageElement.appendChild(usernameSpan);
                    messageElement.appendChild(timestampSpan);
                    messageElement.appendChild(document.createTextNode(': '));
                    messageElement.appendChild(textSpan);

                    chatMessages.appendChild(messageElement);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                console.log('Received unhandled message type:', parsedMessage.type);
            }
        };

        socket.onclose = () => {
            updateStatus('Disconnected from server.', true);
            setGoLiveButtonState(true, originalGoLiveButtonText);
            stopBroadcasting(false); 
            if (liveIndicator) liveIndicator.style.display = 'none';
            if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'none';
            if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = '';
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('WebSocket error. Check console.', true);
            setGoLiveButtonState(true, originalGoLiveButtonText);
            stopBroadcasting(false);
            if (liveIndicator) liveIndicator.style.display = 'none';
            if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'none';
            if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = '';
        };
    }

    function startMediaRecorder() {
        if (!localStream || !socket || socket.readyState !== WebSocket.OPEN || !currentStreamId) {
            updateStatus('Cannot start media recorder: conditions not met.', true);
            setGoLiveButtonState(false, originalGoLiveButtonText); 
            if (liveIndicator) liveIndicator.style.display = 'none';
            return;
        }
        
        try {
            mediaRecorder = new MediaRecorder(localStream, { mimeType: 'audio/webm' });
        } catch (e) {
            console.error("Error creating MediaRecorder:", e);
            updateStatus(`Error creating MediaRecorder: ${e.message}. Try a different browser.`, true);
            setGoLiveButtonState(false, originalGoLiveButtonText);
            if (liveIndicator) liveIndicator.style.display = 'none';
            return;
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            updateStatus(`Streaming live... (Stream ID: ${currentStreamId})`);
            setGoLiveButtonState(false, 'Stop Stream'); 
            if (goLiveButton) goLiveButton.onclick = stopBroadcastingClickHandler;
            if (liveIndicator) liveIndicator.style.display = 'inline-block'; // Show LIVE
        };

        mediaRecorder.onstop = () => {
            updateStatus('Stream stopped locally.');
            setGoLiveButtonState(false, originalGoLiveButtonText);
            if (goLiveButton) goLiveButton.onclick = goLiveClickHandler;
            if (liveIndicator) liveIndicator.style.display = 'none'; 
            if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'none';
            if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = '';
            currentStreamId = null;
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            updateStatus(`MediaRecorder error: ${event.error.name}`, true);
            stopBroadcasting(true); 
            if (liveIndicator) liveIndicator.style.display = 'none'; 
            if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'none';
            if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = '';
        };

        try {
            mediaRecorder.start(1000); 
        } catch (e) {
            console.error("Error starting MediaRecorder:", e);
            updateStatus(`Error starting MediaRecorder: ${e.message}.`, true);
            setGoLiveButtonState(false, originalGoLiveButtonText);
            if (liveIndicator) liveIndicator.style.display = 'none';
        }
    }

    function stopBroadcastingClickHandler() {
        setGoLiveButtonState(true, 'Stopping...');
        stopBroadcasting(true); 
    }

    function stopBroadcasting(notifyServer = true) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop(); 
        } else {
            if (liveIndicator) liveIndicator.style.display = 'none';
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (notifyServer && socket && socket.readyState === WebSocket.OPEN && currentStreamId) {
            socket.send(JSON.stringify({ type: 'stopStream', streamId: currentStreamId }));
        }
        
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
             updateStatus('Stream ended and resources released.');
             setGoLiveButtonState(false, originalGoLiveButtonText);
             if (goLiveButton) goLiveButton.onclick = goLiveClickHandler;
             if (liveIndicator) liveIndicator.style.display = 'none';
             if (currentStreamInfoDiv) currentStreamInfoDiv.style.display = 'none';
             if (currentStreamNameDisplaySpan) currentStreamNameDisplaySpan.textContent = '';
             currentStreamId = null;
        }
    }

    function goLiveClickHandler() {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            updateStatus('Not connected. Attempting to reconnect...', true);
            connectWebSocket();
            return;
        }
        // Check if authenticated (button would be enabled if authSuccess)
        if (goLiveButton && goLiveButton.disabled && goLiveButton.textContent === originalGoLiveButtonText) { 
            updateStatus('Authentication in progress or failed. Please wait or try logging in again.', true);
            // Optionally, try to re-auth if token exists
            const token = localStorage.getItem('beachouse_token');
            if (token && socket.readyState === WebSocket.OPEN) {
                 socket.send(JSON.stringify({ type: 'auth', token: token }));
            }
            return;
        }

        setGoLiveButtonState(true, 'Starting...');
        updateStatus('Requesting microphone access...');

        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                updateStatus('Microphone access granted. Preparing stream...');
                localStream = stream; 
                const streamName = streamNameInput.value.trim() || 'Untitled Stream';
                socket.send(JSON.stringify({ type: 'startStream', streamName: streamName }));
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                updateStatus(`Could not access microphone: ${err.message}`, true);
                setGoLiveButtonState(false, originalGoLiveButtonText); 
                if (liveIndicator) liveIndicator.style.display = 'none';
            });
    }

    if (goLiveButton) {
        goLiveButton.onclick = goLiveClickHandler;
        originalGoLiveButtonText = goLiveButton.textContent; // Ensure it's set after DOM is loaded
    }


    const storedUser = localStorage.getItem('beachouse_user');
    if (storedUser && loggedInUsernameSpan) {
        try {
            const user = JSON.parse(storedUser);
            if (user && user.username) {
                loggedInUsernameSpan.textContent = user.username;
            }
        } catch (e) {
            console.error("Error parsing stored user data:", e);
            localStorage.removeItem('beachouse_user'); 
        }
    }
    
    connectWebSocket();

    // Chat Form Submit Listener
    if (chatForm) {
        chatForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const messageText = chatInput.value.trim();
            if (messageText && socket && socket.readyState === WebSocket.OPEN) {
                // Server will validate authentication and stream association
                socket.send(JSON.stringify({
                    type: 'sendChatMessage',
                    text: messageText
                }));
                chatInput.value = ''; // Clear input after sending
            } else if (!messageText) {
                // Optionally, provide feedback if message is empty
                // console.warn('Chat message cannot be empty.');
            } else {
                console.warn('WebSocket not connected. Cannot send chat message.');
                updateStatus('Not connected to chat. Please ensure you are live and connected.', true);
            }
        });
    }
});
