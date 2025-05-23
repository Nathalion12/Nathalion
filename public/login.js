document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageArea = document.getElementById('messageArea');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            // Clear previous messages
            messageArea.textContent = '';
            messageArea.className = ''; // Clear any previous styling classes (if using classes for errors/success)
            // Or, if directly styling: messageArea.style.color = ''; 

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // Basic client-side validation
            if (!email || !password) {
                messageArea.textContent = 'Email and password are required.';
                messageArea.className = 'message-error'; // Using class for styling
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                    }),
                });

                const data = await response.json(); // Always try to parse JSON

                if (response.ok) { // response.status >= 200 && response.status < 300 (e.g., 200 OK)
                    messageArea.textContent = data.message || 'Login successful!';
                    messageArea.className = 'message-success'; // Using class for styling

                    // Store the JWT
                    localStorage.setItem('beachouse_token', data.token);
                    localStorage.setItem('beachouse_user', JSON.stringify(data.user)); // Store user info

                    loginForm.reset(); // Clear the form on success

                    // Redirect to a protected page or update UI
                    // For now, let's redirect to broadcaster page
                    // Consider a short delay to let the user see the success message
                    setTimeout(() => {
                        window.location.href = 'broadcaster.html'; 
                    }, 1000); 

                } else {
                    // Error messages from the server (e.g., validation, invalid credentials)
                    messageArea.textContent = data.message || `Login failed: ${response.statusText || response.status}`;
                    messageArea.className = 'message-error'; // Using class for styling
                }
            } catch (error) {
                console.error('Login request error:', error);
                messageArea.textContent = 'An error occurred during login. Please check your connection and try again.';
                messageArea.className = 'message-error'; // Using class for styling
            }
        });
    } else {
        console.error('Login form not found. Check your HTML structure.');
    }
});
