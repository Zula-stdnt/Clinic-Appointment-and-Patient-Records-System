// assets/js/main.js
// Single-Page Application Router and Module Orchestrator

import usersModule from './modules/users.js';
import patientsModule from './modules/patients.js';
import doctorsModule from './modules/doctors.js';
import servicesModule from './modules/services.js';
import specialtiesModule from './modules/specialties.js';
import discountsModule from './modules/discounts.js';
import archiveModule from './modules/archive.js';

const modules = {
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

function navigateTo(moduleKey) {
    if (!modules[moduleKey]) {
        moduleKey = 'users'; // default module
    }

    activeModuleKey = moduleKey;

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

document.addEventListener('DOMContentLoaded', () => {
    // Bind sidebar navigation click events
    document.querySelectorAll('.sidebar-nav .nav-link[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleKey = link.getAttribute('data-module');
            navigateTo(moduleKey);
        });
    });

    // Hash change event (back/forward browser navigation)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== activeModuleKey) {
            navigateTo(hash);
        }
    });

    // Initial load from URL hash or default to 'users'
    const initialHash = window.location.hash.replace('#', '');
    navigateTo(initialHash || 'users');
});

