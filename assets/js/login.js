// assets/js/login.js
// Login page behavior: session redirect, password visibility toggle, and sign-in flow.

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-year').textContent = new Date().getFullYear();

    const dashboards = {
        'Administrator': 'admin_dashboard.html',
        'Doctor': 'doctor_dashboard.html',
        'Receptionist': 'receptionist_dashboard.html'
    };

    axios.get('api/auth_controller.php?action=check', {
        headers: { 'Accept': 'application/json' }
    }).then((response) => {
        const data = response.data && response.data.data;
        const user = data && data.logged_in ? data.user : null;
        if (user && dashboards[user.role_name]) {
            showActiveSession(user, dashboards[user.role_name]);
        }
    }).catch(() => {
        // No active session: keep showing the login form
    });

    // When a session is already active, offer Continue / Sign out instead of
    // silently bouncing the user back to their dashboard.
    function showActiveSession(user, dashboardUrl) {
        const panel = document.getElementById('session-panel');
        const form = document.getElementById('login-form');
        const subtitle = document.getElementById('login-subtitle');

        if (!panel || !form) {
            window.location.replace(dashboardUrl);
            return;
        }

        const fullName = (user.full_name || user.username || 'User').trim();
        document.getElementById('session-avatar').textContent = fullName.charAt(0).toUpperCase();
        document.getElementById('session-name').textContent = fullName;
        document.getElementById('session-role').textContent = user.role_name || '';
        document.getElementById('session-continue').setAttribute('href', dashboardUrl);
        if (subtitle) {
            subtitle.textContent = 'Your secure session is still active.';
        }

        form.style.display = 'none';
        alertBox.style.display = 'none';
        panel.style.display = 'block';
    }

    const form = document.getElementById('login-form');
    const alertBox = document.getElementById('login-alert');
    const btnLogin = document.getElementById('btn-login');
    const btnText = btnLogin.querySelector('.btn-text');
    const btnSpinner = btnLogin.querySelector('.btn-spinner');

    const btnTogglePassword = document.getElementById('btn-toggle-password');
    const passwordInput = document.getElementById('password');
    const iconEyeOff = document.getElementById('icon-eye-off');
    const iconEyeOn = document.getElementById('icon-eye-on');

    if (btnTogglePassword && passwordInput) {
        btnTogglePassword.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                iconEyeOff.style.display = 'none';
                iconEyeOn.style.display = 'inline-block';
                btnTogglePassword.setAttribute('aria-label', 'Hide password');
                btnTogglePassword.setAttribute('title', 'Hide password');
            } else {
                passwordInput.type = 'password';
                iconEyeOn.style.display = 'none';
                iconEyeOff.style.display = 'inline-block';
                btnTogglePassword.setAttribute('aria-label', 'Show password');
                btnTogglePassword.setAttribute('title', 'Show password');
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        alertBox.style.display = 'none';
        alertBox.textContent = '';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            alertBox.textContent = 'Please enter both username and password.';
            alertBox.style.display = 'block';
            return;
        }

        btnLogin.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';

        try {
            const response = await axios.post('api/auth_controller.php?action=login', {
                username: username,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.success) {
                window.location.href = response.data.data.redirect || 'admin_dashboard.html';
            } else {
                throw new Error(response.data.message || 'Login failed.');
            }
        } catch (err) {
            let msg = 'Invalid username or password.';
            if (err.response && err.response.data && err.response.data.message) {
                msg = err.response.data.message;
            }
            alertBox.textContent = msg;
            alertBox.style.display = 'block';
        } finally {
            btnLogin.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    });
});
