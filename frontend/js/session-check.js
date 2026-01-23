// Session check and auto-redirect logic
(function () {
    // Don't run on login or setup pages
    const currentPath = window.location.pathname;
    if (currentPath === '/login' || currentPath === '/login.html' ||
        currentPath === '/setup' || currentPath === '/setup.html') {
        return;
    }

    // Check if setup is required
    fetch('/api/auth/check-setup')
        .then(response => response.json())
        .then(data => {
            if (data.setupRequired) {
                // No users exist, redirect to setup
                window.location.href = '/setup';
                return;
            }

            // Setup complete, check if user is logged in
            const token = localStorage.getItem('auth_token');
            if (!token) {
                // Not logged in, redirect to login
                window.location.href = '/login';
                return;
            }

            // Verify token is valid
            fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(response => {
                if (!response.ok) {
                    // Token invalid or expired, clear and redirect to login
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                }
                // Token valid, user can stay on page
            }).catch(() => {
                // Network error or server down, clear token and redirect
                localStorage.removeItem('auth_token');
                window.location.href = '/login';
            });
        })
        .catch(error => {
            console.error('Failed to check setup status:', error);
            // On error, assume not logged in and redirect to login
            window.location.href = '/login';
        });
})();
