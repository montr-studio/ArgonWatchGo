// Setup wizard handling
(function () {
    const setupForm = document.getElementById('setup-form');
    const qrSection = document.getElementById('qr-section');
    const errorMessage = document.getElementById('error-message');
    const passwordInput = document.getElementById('password');
    const passwordStrengthBar = document.getElementById('password-strength-bar');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const enable2FACheckbox = document.getElementById('enable-2fa');

    let setupToken = null;

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    // Password strength checker
    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 2) {
            passwordStrengthBar.className = 'password-strength-bar weak';
        } else if (strength <= 4) {
            passwordStrengthBar.className = 'password-strength-bar medium';
        } else {
            passwordStrengthBar.className = 'password-strength-bar strong';
        }
    }

    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
    });

    // Handle setup form submission
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const enable2FA = enable2FACheckbox.checked;
        const setupBtn = document.getElementById('setup-btn');

        // Validate passwords match
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            showError('Password must be at least 8 characters long');
            return;
        }

        setupBtn.disabled = true;
        setupBtn.textContent = 'Creating account...';

        try {
            const response = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    enable2fa: enable2FA
                })
            });

            const data = await response.json();

            if (data.success) {
                if (enable2FA && data.qrCode) {
                    // Show QR code for 2FA setup
                    setupToken = data.token;
                    document.getElementById('qr-code').innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
                    document.getElementById('secret-code').textContent = data.secret;
                    setupForm.style.display = 'none';
                    qrSection.classList.add('show');
                } else {
                    // Setup complete, store token and redirect
                    localStorage.setItem('auth_token', data.token);
                    window.location.href = '/';
                }
            } else {
                showError(data.message || 'Setup failed');
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = 'Create Account';
        }
    });

    // Continue to dashboard button
    document.getElementById('continue-btn').addEventListener('click', () => {
        if (setupToken) {
            localStorage.setItem('auth_token', setupToken);
            window.location.href = '/';
        }
    });

    // Check if setup is still required
    fetch('/api/auth/check-setup')
        .then(response => response.json())
        .then(data => {
            if (!data.setupRequired) {
                // Setup already completed, redirect to login
                window.location.href = '/login.html';
            }
        })
        .catch(error => {
            console.error('Failed to check setup status:', error);
        });
})();
