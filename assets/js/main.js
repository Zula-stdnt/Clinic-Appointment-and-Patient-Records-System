// assets/js/main.js
// Single-Page Application Router and Module Orchestrator
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)

import { requireSession } from './session-guard.js?v=24';
import { hideAllModals, closeSidebar } from './ui.js?v=24';
import overviewModule from './modules/overview.js?v=24';
import usersModule from './modules/users.js?v=24';
import patientsModule from './modules/patients.js?v=29';
import doctorsModule from './modules/doctors.js?v=25';
import servicesModule from './modules/services.js?v=25';
import medicationsModule from './modules/medications.js?v=1';
import specialtiesModule from './modules/specialties.js?v=24';
import archiveModule from './modules/archive.js?v=24';
import auditLogsModule from './modules/audit_logs.js?v=2';
import settingsModule from './modules/account_settings.js?v=24';
import profileModule from './modules/my_profile.js?v=24';

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

function navigateTo(moduleKey) {
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

    // Update topbar title
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
}

function populateShell(user) {
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
}

function startApp() {
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
