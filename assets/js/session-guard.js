// assets/js/session-guard.js
// Client-side session guard for the static HTML page shells
// Implements Priority 2 back-button & bfcache re-entry prevention
// ITE 387 Lesson applied: 03 APIs and Database Operations/javascript_working_with_apis (Async/await Axios session verification)

const DASHBOARDS = {
    'Administrator': 'admin_dashboard.html',
    'Doctor': 'doctor_dashboard.html',
    'Receptionist': 'receptionist_dashboard.html'
};

let activeGuardedRoles = null;

export function dashboardFor(roleName) {
    return DASHBOARDS[roleName] || 'login.html';
}

export async function requireSession(allowedRoles) {
    activeGuardedRoles = allowedRoles;
    let payload = null;

    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('baseAPIUrl') && typeof window !== 'undefined' && window.location) {
        const apiPath = window.location.pathname.replace(/\/[^/]*$/, '') + '/api';
        sessionStorage.setItem('baseAPIUrl', apiPath);
    }
    const baseAPI = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('baseAPIUrl')) || 'api';

    try {
        const response = await axios.get(`${baseAPI}/auth_controller.php?action=me`, {
            headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
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

// Priority 2: Re-check session on pageshow when page is loaded from bfcache (Back/Forward cache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted && activeGuardedRoles) {
        requireSession(activeGuardedRoles);
    }
});

// Also re-verify if document becomes visible after background tab switch
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeGuardedRoles) {
        requireSession(activeGuardedRoles);
    }
});

