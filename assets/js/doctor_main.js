// assets/js/doctor_main.js
// Single-Page Application Router and Module Orchestrator for Doctor Portal
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)
// & 03 APIs and Database Operations/mysql_retrieve_specific_record (Global state persistence in sessionStorage.baseAPIUrl)

// ITE 387: Global State Persistence in sessionStorage (mysql_retrieve_specific_record.md)
if (!sessionStorage.getItem('baseAPIUrl')) {
    const apiPath = window.location.pathname.replace(/\/[^/]*$/, '') + '/api';
    sessionStorage.setItem('baseAPIUrl', apiPath);
}

import { requireSession } from './session-guard.js?v=24';
import { hideAllModals, closeSidebar } from './ui.js?v=26';
import { LiveSync } from './live-sync.js?v=1';
import doctorOverview from './modules/doctor_overview.js?v=30';
import doctorAppointments from './modules/doctor_appointments.js?v=34';
import doctorPatients from './modules/doctor_patients.js?v=35';
import doctorConsultation from './modules/doctor_consultation.js?v=34';
import settingsModule from './modules/account_settings.js?v=25';
import doctorProfile from './modules/doctor_profile.js?v=32';

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
window.navigateTo = (route) => {
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

    // Update browser title
    if (modules[moduleKey]?.title) {
        document.title = `${modules[moduleKey].title} - CPRMS`;
    }
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

const populateShell = (user) => {
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
};

const startApp = () => {
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
