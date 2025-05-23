document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageArea = document.getElementById('messageArea');

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            // Clear previous messages
            messageArea.textContent = '';
            messageArea.className = ''; // Clear any previous styling classes

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // Basic client-side validation (though HTML5 attributes 'required' and 'minlength' also help)
            if (!username || !email || !password) {
                messageArea.textContent = 'All fields are required.';
                messageArea.className = 'message-error';
                return;
            }
            if (password.length < 6) {
                messageArea.textContent = 'Password must be at least 6 characters long.';
                messageArea.className = 'message-error';
                return;
            }
            if (!email.includes('@') || !email.includes('.')) { // Very basic email check
                messageArea.textContent = 'Please enter a valid email address.';
                messageArea.className = 'message-error';
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        password: password,
                    }),
                });

                const data = await response.json(); // Always try to parse JSON

                if (response.ok) { // response.status >= 200 && response.status < 300 (e.g., 201 Created)
                    messageArea.textContent = data.message || 'Registration successful!';
                    messageArea.className = 'message-success';
                    registerForm.reset(); // Clear the form on success
                    // Optional: Redirect to login page after a short delay
                    // setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                } else {
                    // Error messages from the server (e.g., validation, duplicate user)
                    messageArea.textContent = data.message || `Registration failed: ${response.statusText || response.status}`;
                    messageArea.className = 'message-error';
                }
            } catch (error) {
                console.error('Registration request error:', error);
                messageArea.textContent = 'An error occurred during registration. Please check your connection and try again.';
                messageArea.className = 'message-error';
            }
        });
    } else {
        console.error('Registration form not found. Check your HTML structure.');
    }
});
