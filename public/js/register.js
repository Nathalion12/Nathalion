document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageArea = document.getElementById('messageArea');

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            messageArea.textContent = '';
            messageArea.className = 'message-feedback'; // Base class

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !email || !password) {
                messageArea.textContent = 'All fields are required.';
                messageArea.classList.add('message-error');
                return;
            }
            if (password.length < 6) {
                messageArea.textContent = 'Password must be at least 6 characters long.';
                messageArea.classList.add('message-error');
                return;
            }
            if (!email.includes('@') || !email.includes('.')) { 
                messageArea.textContent = 'Please enter a valid email address.';
                messageArea.classList.add('message-error');
                return;
            }

            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Registering...';

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

                const data = await response.json(); 

                if (response.ok) { 
                    messageArea.textContent = data.message || 'Registration successful!';
                    messageArea.classList.add('message-success');
                    registerForm.reset(); 
                } else {
                    messageArea.textContent = data.message || `Registration failed: ${response.statusText || response.status}`;
                    messageArea.classList.add('message-error');
                }
            } catch (error) {
                console.error('Registration request error:', error);
                messageArea.textContent = 'An error occurred during registration. Please check your connection and try again.';
                messageArea.classList.add('message-error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    } else {
        console.error('Registration form not found. Check your HTML structure.');
    }
});
