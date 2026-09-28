// assets/js/session-guard.js
// Client-side session guard for the static HTML page shells
// ITE 387 Lesson applied: 03 APIs and Database Operations/javascript_working_with_apis (Async/await Axios session verification)

const DASHBOARDS = {
    'Administrator': 'admin_dashboard.html',
    'Doctor': 'doctor_dashboard.html',
    'Receptionist': 'receptionist_dashboard.html'
};

export function dashboardFor(roleName) {
    return DASHBOARDS[roleName] || 'login.html';
}

export async function requireSession(allowedRoles) {
    let payload = null;

    try {
        const response = await axios.get('api/auth_controller.php?action=me', {
            headers: { 'Accept': 'application/json' }
        });
        payload = response.data && response.data.data ? response.data.data : null;
    } catch (err) {
        payload = null;
    }

    const user = payload ? payload.user : null;

    if (!user) {
        window.location.replace('login.html');
        return null;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.indexOf(user.role_name) === -1) {
        window.location.replace(dashboardFor(user.role_name));
        return null;
    }

    if (payload.csrf_token) {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) {
            meta.setAttribute('content', payload.csrf_token);
        }
    }

    return user;
}
