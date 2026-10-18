// assets/js/main.js
// Single-Page Application Router and Module Orchestrator
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
import overviewModule from './modules/overview.js?v=26';
import usersModule from './modules/users.js?v=25';
import patientsModule from './modules/patients.js?v=30';
import doctorsModule from './modules/doctors.js?v=26';
import servicesModule from './modules/services.js?v=26';
import medicationsModule from './modules/medications.js?v=2';
import specialtiesModule from './modules/specialties.js?v=25';
import archiveModule from './modules/archive.js?v=25';
import auditLogsModule from './modules/audit_logs.js?v=4';
import settingsModule from './modules/account_settings.js?v=25';
import profileModule from './modules/my_profile.js?v=25';

const modules = {
    'overview': {
        title: 'Dashboard',
        instance: overviewModule
    },
    'users': {
        title: 'Manage Users',
        instance: usersModule
    },
    'patients': {
        title: 'Manage Patients',
        instance: patientsModule
    },
    'doctors': {
        title: 'Manage Doctors',
        instance: doctorsModule
    },
    'services': {
        title: 'Manage Services',
        instance: servicesModule
    },
    'medications': {
        title: 'Manage Medications',
        instance: medicationsModule
    },
    'specialties': {
        title: 'Manage Specialties',
        instance: specialtiesModule
    },
    'archive': {
        title: 'Manage Archive',
        instance: archiveModule
    },
    'audit_logs': {
        title: 'Compliance & Audit Logs',
        instance: auditLogsModule
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

let activeModuleKey = null;

const navigateTo = (moduleKey) => {
    if (!modules[moduleKey]) {
        moduleKey = 'overview'; // default module
    }

    activeModuleKey = moduleKey;

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
    if (window.location.hash !== `#${moduleKey}`) {
        window.history.pushState(null, '', `#${moduleKey}`);
    }

    // Render module content in viewport
    const container = document.getElementById('module-viewport');
    if (container) {
        hideAllModals();
        container.innerHTML = '';
        modules[moduleKey].instance.init(container);
    }
};

const populateShell = (user) => {
    const fallbackName = user.full_name || 'Administrator';
    const initial = fallbackName.trim().charAt(0).toUpperCase();
    const roleLabel = user.role_name || 'Administrator';

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
    // Bind sidebar navigation click events
    document.querySelectorAll('.sidebar-nav .nav-link[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleKey = link.getAttribute('data-module');
            navigateTo(moduleKey);
        });
    });

    // Hash change event (back/forward browser navigation and dropdown links)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== activeModuleKey) {
            navigateTo(hash);
        }
    });

    // Initial load from URL hash or default to the dashboard overview
    const initialHash = window.location.hash.replace('#', '');
    navigateTo(initialHash || 'overview');

    LiveSync.start();
}

const currentUser = await requireSession(['Administrator']);

if (currentUser) {
    populateShell(currentUser);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
}
