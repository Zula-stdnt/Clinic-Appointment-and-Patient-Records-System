// assets/js/doctor_main.js
// Single-Page Application Router and Module Orchestrator for Doctor Portal
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)

import { requireSession } from './session-guard.js?v=24';
import { hideAllModals, closeSidebar } from './ui.js?v=24';
import { LiveSync } from './live-sync.js?v=1';
import doctorOverview from './modules/doctor_overview.js?v=28';
import doctorAppointments from './modules/doctor_appointments.js?v=31';
import doctorPatients from './modules/doctor_patients.js?v=34';
import doctorConsultation from './modules/doctor_consultation.js?v=33';
import settingsModule from './modules/account_settings.js?v=24';
import doctorProfile from './modules/doctor_profile.js?v=31';

const modules = {
    'doctor_overview': {
        title: 'Dashboard',
        instance: doctorOverview
    },
    'doctor_appointments': {
        title: 'Appointments',
        instance: doctorAppointments
    },
    'doctor_patients': {
        title: 'Patient Records',
        instance: doctorPatients
    },
    'doctor_consultation': {
        title: 'Consultation',
        instance: doctorConsultation
    },
    'settings': {
        title: 'Settings',
        instance: settingsModule
    },
    'profile': {
        title: 'My Profile',
        instance: doctorProfile
    }
};

let activeRouteKey = null;

// Ensure navigateTo is exposed globally for modules (like starting a consult)
window.navigateTo = function(route) {
    const parts = route.split('/');
    let moduleKey = parts[0];
    const param = parts.slice(1).join('/');

    if (!modules[moduleKey]) {
        moduleKey = 'doctor_overview';
        route = moduleKey;
    }

    activeRouteKey = route;

    closeSidebar();

    // Update active class on sidebar items
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        const key = link.getAttribute('data-module');
        if (key === moduleKey) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update topbar title
    const titleEl = document.getElementById('current-module-title');
    if (titleEl) {
        titleEl.textContent = modules[moduleKey].title;
    }

    // Update URL hash without full reload
    if (window.location.hash !== `#${route}`) {
        window.history.pushState(null, '', `#${route}`);
    }

    // Render module content in viewport
    const container = document.getElementById('module-viewport');
    if (container) {
        hideAllModals();
        container.innerHTML = '';
        modules[moduleKey].instance.init(container, param);
    }
};

function populateShell(user) {
    const fallbackName = user.full_name || 'Doctor';
    const initial = fallbackName.trim().charAt(0).toUpperCase();
    const roleLabel = user.role_name || 'Doctor';

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
    window.navigateTo(initialHash || 'doctor_overview');

    LiveSync.start();
}

const currentUser = await requireSession(['Doctor']);

if (currentUser) {
    populateShell(currentUser);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
}
