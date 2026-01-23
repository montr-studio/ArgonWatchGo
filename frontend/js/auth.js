// Authentication handling for login page
(function () {
    const loginForm = document.getElementById('login-form');
    const twoFAForm = document.getElementById('two-fa-form');
    const loginSection = loginForm.parentElement;
    const twoFASection = document.getElementById('two-fa-section');
    const errorMessage = document.getElementById('error-message');
    const backToLogin = document.getElementById('back-to-login');

    let tempToken = null;

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('login-btn');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                if (data.requires2fa) {
                    // Show 2FA form
                    tempToken = data.tempToken;
                    loginSection.style.display = 'none';
                    twoFASection.classList.add('show');
                    document.getElementById('totp-token').focus();
                } else {
                    // Login successful, store token and redirect
                    localStorage.setItem('auth_token', data.token);
                    window.location.href = '/';
                }
            } else {
                showError(data.message || 'Login failed');
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });

    // Handle 2FA form submission
    twoFAForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const totpToken = document.getElementById('totp-token').value;
        const verifyBtn = document.getElementById('verify-btn');

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const response = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tempToken: tempToken,
                    totpToken: totpToken
                })
            });

            const data = await response.json();

            if (data.success) {
                // Login successful, store token and redirect
                localStorage.setItem('auth_token', data.token);
                window.location.href = '/';
            } else {
                showError(data.message || '2FA verification failed');
                document.getElementById('totp-token').value = '';
                document.getElementById('totp-token').focus();
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });

    // Back to login link
    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        twoFASection.classList.remove('show');
        loginSection.style.display = 'block';
        document.getElementById('totp-token').value = '';
        tempToken = null;
    });

    // Check if already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
        // Verify token is still valid
        fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => {
            if (response.ok) {
                window.location.href = '/';
            }
        });
    }
})();
