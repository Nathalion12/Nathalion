document.addEventListener('DOMContentLoaded', () => {
    const loginLinkListItem = document.querySelector('.auth-link-login');
    const registerLinkListItem = document.querySelector('.auth-link-register');
    const navLinksUl = document.querySelector('.nav-links');

    if (!navLinksUl) {
        console.error('Navigation links UL element not found. Check your HTML structure.');
        return;
    }

    const token = localStorage.getItem('beachouse_token');
    const userString = localStorage.getItem('beachouse_user');

    if (token && userString) {
        // User is logged in
        try {
            const user = JSON.parse(userString);

            if (loginLinkListItem) loginLinkListItem.style.display = 'none';
            if (registerLinkListItem) registerLinkListItem.style.display = 'none';

            // Create "Logged in as [username]" list item
            const userInfoLi = document.createElement('li');
            userInfoLi.classList.add('nav-item', 'nav-user-info');
            userInfoLi.textContent = `Logged in as: ${user.username}`;
            
            // Create Logout link
            const logoutLi = document.createElement('li');
            logoutLi.classList.add('nav-item');
            const logoutLink = document.createElement('a');
            logoutLink.classList.add('nav-link');
            logoutLink.href = '#'; // Prevent navigation
            logoutLink.textContent = 'Logout';
            logoutLink.id = 'logoutButton'; // For event listener
            logoutLi.appendChild(logoutLink);

            // Append new items: User Info first, then Logout
            // To ensure they appear on the right, typically we'd append to the end of existing items
            // or insert before specific items if order matters and other items might exist.
            
            // Create Profile link
            const profileLi = document.createElement('li');
            profileLi.classList.add('nav-item');
            const profileLink = document.createElement('a');
            profileLink.classList.add('nav-link');
            profileLink.href = 'profile.html';
            profileLink.textContent = 'Profile';
            profileLi.appendChild(profileLink);

            // Append new items: User Info, then Profile, then Logout
            navLinksUl.appendChild(userInfoLi);
            navLinksUl.appendChild(profileLi);
            navLinksUl.appendChild(logoutLi);
            
            // Add event listener to logoutButton
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton) {
                logoutButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    localStorage.removeItem('beachouse_token');
                    localStorage.removeItem('beachouse_user');
                    // Optionally clear other session-related data
                    window.location.href = 'login.html'; // Redirect to login page
                });
            }

        } catch (error) {
            console.error('Error parsing user data from localStorage:', error);
            // Fallback: treat as logged out if user data is corrupted
            if (loginLinkListItem) loginLinkListItem.style.display = 'list-item'; // Or 'block'/'inline' depending on original display
            if (registerLinkListItem) registerLinkListItem.style.display = 'list-item';
            localStorage.removeItem('beachouse_token'); // Clean up
            localStorage.removeItem('beachouse_user');
        }
    } else {
        // User is not logged in
        // Ensure Login and Register links are visible (they are by default in HTML)
        if (loginLinkListItem) loginLinkListItem.style.display = 'list-item'; // Or 'block'/'inline'
        if (registerLinkListItem) registerLinkListItem.style.display = 'list-item';
    }
});
