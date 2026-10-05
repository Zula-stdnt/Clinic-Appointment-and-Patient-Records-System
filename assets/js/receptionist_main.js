// assets/js/receptionist_main.js
// Single-Page Application Router and Module Orchestrator for the Receptionist Portal
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)

import { requireSession } from './session-guard.js?v=24';
import { hideAllModals, closeSidebar } from './ui.js?v=24';
import receptionistAppointments from './modules/receptionist_appointments.js?v=28';
import receptionistPatients from './modules/receptionist_patients.js?v=30';
import settingsModule from './modules/account_settings.js?v=24';
import profileModule from './modules/my_profile.js?v=24';

const modules = {
    'receptionist_appointments': {
        title: 'Appointments',
        instance: receptionistAppointments
    },
    'receptionist_patients': {
        title: 'Patient Register',
        instance: receptionistPatients
    },
    'settings': {
        title: 'Settings',
        instance: settingsModule
    },
    'profile': {
        title: 'My Profile',
        instance: profileModule
    }
};

let activeRouteKey = null;

window.navigateTo = function(route) {
    const parts = route.split('/');
    let moduleKey = parts[0];

    if (!modules[moduleKey]) {
        moduleKey = 'receptionist_appointments';
        route = moduleKey;
    }

    activeRouteKey = route;

    closeSidebar();

    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        const key = link.getAttribute('data-module');
        if (key === moduleKey) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const titleEl = document.getElementById('current-module-title');
    if (titleEl) {
        titleEl.textContent = modules[moduleKey].title;
    }

    if (window.location.hash !== `#${route}`) {
        window.history.pushState(null, '', `#${route}`);
    }

    const container = document.getElementById('module-viewport');
    if (container) {
        hideAllModals();
        container.innerHTML = '';
        modules[moduleKey].instance.init(container);
    }
};

function populateShell(user) {
    const fallbackName = user.full_name || 'Receptionist';
    const initial = fallbackName.trim().charAt(0).toUpperCase();
    const roleLabel = user.role_name || 'Receptionist';

    ['user-avatar-initial', 'user-menu-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = initial;
    });

    ['user-name', 'user-menu-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = fallbackName;
            el.setAttribute('title', fallbackName);
        }
    });

    ['user-role', 'user-menu-role'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = roleLabel;
    });

    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

function startApp() {
    document.querySelectorAll('.sidebar-nav .nav-link[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleKey = link.getAttribute('data-module');
            window.navigateTo(moduleKey);
        });
    });

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== activeRouteKey) {
            window.navigateTo(hash);
        }
    });

    const initialHash = window.location.hash.replace('#', '');
    window.navigateTo(initialHash || 'receptionist_appointments');
}

const currentUser = await requireSession(['Receptionist']);

if (currentUser) {
    populateShell(currentUser);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
}
