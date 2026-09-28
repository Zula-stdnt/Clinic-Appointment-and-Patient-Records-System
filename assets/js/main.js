// assets/js/main.js
// Single-Page Application Router and Module Orchestrator

import { requireSession } from './session-guard.js?v=13';
import overviewModule from './modules/overview.js?v=13';
import usersModule from './modules/users.js?v=13';
import patientsModule from './modules/patients.js?v=13';
import doctorsModule from './modules/doctors.js?v=13';
import servicesModule from './modules/services.js?v=13';
import specialtiesModule from './modules/specialties.js?v=13';
import discountsModule from './modules/discounts.js?v=13';
import archiveModule from './modules/archive.js?v=13';

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
    'specialties': {
        title: 'Manage Specialties',
        instance: specialtiesModule
    },
    'discounts': {
        title: 'Manage Discounts',
        instance: discountsModule
    },
    'archive': {
        title: 'Manage Archive',
        instance: archiveModule
    }
};

let activeModuleKey = null;

// Off-canvas sidebar controls (active below 1024px; harmless on desktop)
function isSidebarCollapsed() {
    return window.matchMedia('(max-width: 1024px)').matches;
}

function openSidebar() {
    document.body.classList.add('sidebar-open');
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
    if (!document.body.classList.contains('sidebar-open')) return;
    document.body.classList.remove('sidebar-open');
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
    if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function navigateTo(moduleKey) {
    if (!modules[moduleKey]) {
        moduleKey = 'overview'; // default module
    }

    activeModuleKey = moduleKey;

    // Close the off-canvas sidebar after navigating on small screens
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
        container.innerHTML = '';
        modules[moduleKey].instance.init(container);
    }
}

function populateShell(user) {
    const initialEl = document.getElementById('user-avatar-initial');
    if (initialEl) {
        initialEl.textContent = (user.full_name || 'A').trim().charAt(0).toUpperCase();
    }

    const nameEl = document.getElementById('user-name');
    if (nameEl) {
        nameEl.textContent = user.full_name || 'Administrator';
        nameEl.setAttribute('title', user.full_name || 'Administrator');
    }

    const roleEl = document.getElementById('user-role');
    if (roleEl) {
        roleEl.textContent = user.role_name || 'Administrator';
    }

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

    // Off-canvas sidebar: hamburger toggle, backdrop dismiss, and Escape key
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });

    // Reset the sidebar state when resizing back to the desktop layout
    window.addEventListener('resize', () => {
        if (!isSidebarCollapsed()) {
            closeSidebar();
        }
    });

    // Hash change event (back/forward browser navigation)
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

