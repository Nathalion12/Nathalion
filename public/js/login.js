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
            messageArea.className = 'message-feedback'; // Base class for styling

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // Basic client-side validation
            if (!email || !password) {
                messageArea.textContent = 'Email and password are required.';
                messageArea.classList.add('message-error');
                return;
            }
            
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Logging in...';

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

                const data = await response.json(); 

                if (response.ok) { 
                    messageArea.textContent = data.message || 'Login successful!';
                    messageArea.classList.add('message-success');

                    localStorage.setItem('beachouse_token', data.token);
                    localStorage.setItem('beachouse_user', JSON.stringify(data.user)); 

                    loginForm.reset(); 

                    setTimeout(() => {
                        window.location.href = 'broadcaster.html'; 
                    }, 1000); 

                } else {
                    messageArea.textContent = data.message || `Login failed: ${response.statusText || response.status}`;
                    messageArea.classList.add('message-error');
                }
            } catch (error) {
                console.error('Login request error:', error);
                messageArea.textContent = 'An error occurred during login. Please check your connection and try again.';
                messageArea.classList.add('message-error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    } else {
        console.error('Login form not found. Check your HTML structure.');
    }
});
