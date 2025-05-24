document.addEventListener('DOMContentLoaded', () => {
    const profileUsernameSpan = document.getElementById('profileUsername');
    const profileEmailSpan = document.getElementById('profileEmail');
    const profileUserIdSpan = document.getElementById('profileUserId'); // Assuming you added this ID

    const token = localStorage.getItem('beachouse_token');
    const userString = localStorage.getItem('beachouse_user');

    if (!token || !userString) {
        // No token or user info, redirect to login
        console.log('User not authenticated, redirecting to login.');
        window.location.href = 'login.html';
        return; // Stop further execution
    }

    try {
        const user = JSON.parse(userString);

        if (user) {
            if (profileUsernameSpan) {
                profileUsernameSpan.textContent = user.username || 'N/A';
            }
            if (profileEmailSpan) {
                profileEmailSpan.textContent = user.email || 'N/A';
            }
            if (profileUserIdSpan) { // Check if the element exists
                // The user object from login includes userId, username, email
                profileUserIdSpan.textContent = user.userId || 'N/A'; 
            }
            // Example for created_at if it were available and you added an element for it:
            // const profileCreatedAtSpan = document.getElementById('profileCreatedAt');
            // if (profileCreatedAtSpan && user.created_at) {
            //    profileCreatedAtSpan.textContent = new Date(user.created_at).toLocaleDateString();
            // }
        } else {
            // User data is somehow invalid after parsing
            console.error('User data is invalid after parsing from localStorage.');
            if (profileUsernameSpan) profileUsernameSpan.textContent = 'Error loading data';
            if (profileEmailSpan) profileEmailSpan.textContent = 'Error loading data';
            if (profileUserIdSpan) profileUserIdSpan.textContent = 'Error loading data';
        }
    } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
        // Fallback if JSON parsing fails (e.g. corrupted data)
        if (profileUsernameSpan) profileUsernameSpan.textContent = 'Error loading data';
        if (profileEmailSpan) profileEmailSpan.textContent = 'Error loading data';
        if (profileUserIdSpan) profileUserIdSpan.textContent = 'Error loading data';
        
        // Optional: Clear corrupted data and redirect
        // localStorage.removeItem('beachouse_token');
        // localStorage.removeItem('beachouse_user');
        // window.location.href = 'login.html';
    }
});
