document.addEventListener('DOMContentLoaded', () => {
    const streamIdInput = document.getElementById('streamIdInput');
    const joinStreamButton = document.getElementById('joinStreamButton');
    const statusMessages = document.getElementById('statusMessages');
    const audioPlaybackElement = document.getElementById('audioPlayback');
    const activeStreamsList = document.getElementById('activeStreamsList');
    const refreshStreamsButton = document.getElementById('refreshStreamsButton');

    let socket;
    let audioContext; // Will be initialized on first interaction or when needed
    let mediaSource;
    let sourceBuffer;
    const audioQueue = [];
    let isPlaying = false;
    let isMediaSourceOpen = false;
    const audioCodec = 'audio/webm; codecs=opus'; // Ensure this matches broadcaster's output

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
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(wsProtocol + window.location.host);

        joinStreamButton.disabled = true;
        refreshStreamsButton.disabled = true; // Disable initially
        updateStatus('Connecting to server...');

        socket.onopen = () => {
            updateStatus('Connected to server. Enter a Stream ID and click Join, or select from active streams.');
            joinStreamButton.disabled = false;
            refreshStreamsButton.disabled = false;
            fetchActiveStreams(); // Fetch streams once connected
        };

        socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                try {
                    const message = JSON.parse(event.data);
                    console.log('Server JSON message:', message);

                    if (message.type === 'joinedStream') {
                        updateStatus(`Joined stream: "${message.streamName}" (ID: ${message.streamId})`);
                        initMediaSource();
                    } else if (message.type === 'streamEnded') {
                        updateStatus(`Stream ${message.streamId} has ended. Reason: ${message.reason}`, true);
                        cleanupMediaSource();
                    } else if (message.type === 'error') {
                        updateStatus(`Server error: ${message.message}`, true);
                    } else if (message.type === 'info') {
                        updateStatus(`Info: ${message.message}`);
                    } else {
                        console.log('Received unhandled JSON message type:', message.type);
                    }
                } catch (e) {
                    updateStatus(`Error parsing JSON message from server: ${e.message}`, true);
                }
            } else if (event.data instanceof Blob) {
                // Received binary audio data
                audioQueue.push(event.data);
                processAudioQueue();
            } else {
                console.warn('Received unknown message type from server:', event.data);
            }
        };

        socket.onclose = () => {
            updateStatus('Disconnected from server.', true);
            joinStreamButton.disabled = true;
            cleanupMediaSource();
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('WebSocket error. Check console.', true);
            joinStreamButton.disabled = true;
            cleanupMediaSource();
        };
    }

    function initMediaSource() {
        if (!audioContext) { // Initialize AudioContext on first use (often needs user gesture)
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                updateStatus('AudioContext not supported by this browser.', true);
                console.error('AudioContext not supported:', e);
                return;
            }
        }
        
        if (mediaSource && mediaSource.readyState !== 'closed') {
            console.warn("MediaSource already initialized or not closed.");
           //Potentially call cleanupMediaSource here if re-init is desired
           // cleanupMediaSource(); 
        }

        try {
            mediaSource = new MediaSource();
        } catch(e) {
            updateStatus('MediaSource API not available.', true);
            console.error('Failed to create MediaSource:', e);
            return;
        }
        
        audioPlaybackElement.src = URL.createObjectURL(mediaSource);
        isMediaSourceOpen = false; // Reset flag

        mediaSource.addEventListener('sourceopen', () => {
            isMediaSourceOpen = true;
            console.log('MediaSource sourceopen event fired.');
            URL.revokeObjectURL(audioPlaybackElement.src); // Revoke old Object URL once source is open

            try {
                if (!MediaSource.isTypeSupported(audioCodec)) {
                    updateStatus(`Codec ${audioCodec} not supported.`, true);
                    console.error(`Codec ${audioCodec} not supported.`);
                    cleanupMediaSource();
                    return;
                }
                sourceBuffer = mediaSource.addSourceBuffer(audioCodec);
                sourceBuffer.mode = 'sequence'; // Crucial for streaming segment by segment

                sourceBuffer.addEventListener('updateend', () => {
                    // This indicates the buffer is ready for more data.
                    processAudioQueue(); 
                });
                sourceBuffer.addEventListener('error', (ev) => {
                    console.error('SourceBuffer error:', ev);
                    updateStatus('SourceBuffer error. Check console.', true);
                });
                 // Start processing any data that might have arrived before sourceBuffer was ready
                processAudioQueue();
            } catch (e) {
                updateStatus(`Error adding SourceBuffer: ${e.message}`, true);
                console.error('Error adding SourceBuffer:', e);
                cleanupMediaSource();
            }
        }, { once: true }); // Use { once: true } to prevent multiple bindings if re-initialized

        mediaSource.addEventListener('sourceended', () => {
            console.log('MediaSource sourceended event fired.');
            isMediaSourceOpen = false;
        });
        mediaSource.addEventListener('sourceclose', () => {
            console.log('MediaSource sourceclose event fired.');
            isMediaSourceOpen = false;
        });
        
        audioPlaybackElement.play().then(() => {
            isPlaying = true;
            updateStatus('Playback started...');
        }).catch(e => {
            console.error('Autoplay was prevented:', e);
            updateStatus('Playback waiting for user interaction (click play on audio element if needed).');
            // Browser might block autoplay until user interaction
        });
    }

    async function processAudioQueue() {
        if (!audioQueue.length || !sourceBuffer || sourceBuffer.updating || !isMediaSourceOpen) {
            // If queue is empty, or buffer not ready/updating, or mediaSource not open, wait.
            return;
        }

        const audioBlob = audioQueue.shift();
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            sourceBuffer.appendBuffer(arrayBuffer);
            // Playback should start/resume automatically due to the audio element's controls and previous .play()
            // Or if explicitly managed:
            if (!isPlaying && audioPlaybackElement.paused && audioPlaybackElement.buffered.length > 0) {
                audioPlaybackElement.play().then(() => {
                    isPlaying = true;
                }).catch(e => {
                    console.warn('Play attempt in processAudioQueue failed:', e);
                    // isPlaying remains false, user might need to click play
                });
            }
        } catch (error) {
            console.error('Error appending buffer:', error);
            updateStatus(`Error processing audio: ${error.message}`, true);
            // If appendBuffer fails, it might be due to various reasons (e.g., bad data, MediaSource state).
            // Re-queuing the blob might lead to an infinite loop if the error is persistent.
            // Consider a strategy for handling such errors, e.g., skipping the chunk or stopping.
            // For now, we just log and try to continue.
            // audioQueue.unshift(audioBlob); // Re-queue if error, but be cautious
        }
    }
    
    function cleanupMediaSource() {
        console.log("Cleaning up MediaSource...");
        isPlaying = false;
        isMediaSourceOpen = false;
        audioQueue.length = 0; // Clear the queue

        if (mediaSource && mediaSource.readyState === 'open') {
            try {
                if (sourceBuffer && !sourceBuffer.updating) {
                    mediaSource.endOfStream();
                } else if (sourceBuffer && sourceBuffer.updating) {
                    // If updating, abort and then end.
                    // This might be abrupt for the sourceBuffer.
                    sourceBuffer.abort(); 
                    // mediaSource.endOfStream(); // endOfStream might throw if sourceBuffer was aborted while updating.
                    console.warn("SourceBuffer was updating during cleanup. Aborted.");
                } else {
                     mediaSource.endOfStream();
                }
            } catch (e) {
                console.error("Error during mediaSource.endOfStream():", e);
            }
        }
        // audioPlaybackElement.src = ''; // Detach MediaSource
        // audioPlaybackElement.load(); // Reset audio element
        if (mediaSource) {
            // Remove specific listeners if added multiple times, or rely on sourceclose to detach
        }
        mediaSource = null;
        sourceBuffer = null;
        updateStatus('Stream ended. Ready to join another stream.');
    }


    joinStreamButton.addEventListener('click', () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            updateStatus('Not connected to server. Please wait or refresh.', true);
            return;
        }

        const streamId = streamIdInput.value.trim();
        if (streamId) {
            // Clean up any previous stream before joining a new one
            cleanupMediaSource(); 
            // Re-initialize MediaSource for the new stream *after* server confirms 'joinedStream'
            
            socket.send(JSON.stringify({ type: 'joinStream', streamId: streamId }));
            updateStatus(`Attempting to join stream ID: ${streamId}...`);
            joinStreamButton.disabled = true; // Disable while attempting to join
        } else {
            updateStatus('Please enter a Stream ID.', true);
        }
    });

    // Initial connection
    connectWebSocket();

    // Fetch Active Streams Functionality
    async function fetchActiveStreams() {
        if (!activeStreamsList) return; // In case element not found
        activeStreamsList.innerHTML = '<li>Loading active streams...</li>';
        refreshStreamsButton.disabled = true;

        try {
            const response = await fetch('/active-streams');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const streams = await response.json();

            activeStreamsList.innerHTML = ''; // Clear loading message

            if (streams.length === 0) {
                activeStreamsList.innerHTML = '<li>No active streams currently.</li>';
            } else {
                streams.forEach(stream => {
                    const li = document.createElement('li');
                    li.textContent = `${stream.streamName} by ${stream.broadcasterUsername || 'Unknown User'} (ID: ${stream.streamId})`;
                    li.style.cursor = 'pointer';
                    li.style.padding = '5px 0'; // Add some padding for easier clicking
                    li.style.borderBottom = '1px solid #eee'; // Separator

                    li.addEventListener('mouseover', () => li.style.backgroundColor = '#f0f0f0');
                    li.addEventListener('mouseout', () => li.style.backgroundColor = 'transparent');
                    
                    li.onclick = () => {
                        streamIdInput.value = stream.streamId;
                        // Ensure cleanup and other logic from joinStreamButton.click() is triggered
                        // If joinStreamButton.click() is not appropriate due to UI state,
                        // replicate the core logic of initiating a join here.
                        if (!joinStreamButton.disabled) {
                            joinStreamButton.click();
                        } else {
                            updateStatus('Cannot join stream now. WebSocket might not be ready.', true);
                        }
                    };
                    activeStreamsList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error fetching active streams:', error);
            activeStreamsList.innerHTML = '<li>Error loading streams. Please try again.</li>';
            updateStatus(`Error fetching streams: ${error.message}`, true);
        } finally {
            if (socket && socket.readyState === WebSocket.OPEN) {
                 refreshStreamsButton.disabled = false;
            }
        }
    }

    if (refreshStreamsButton) {
        refreshStreamsButton.addEventListener('click', fetchActiveStreams);
    }
});
