// assets/js/receptionist_main.js
// Single-Page Application Router and Module Orchestrator for the Receptionist Portal
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)

import { requireSession } from './session-guard.js?v=22';
import receptionistAppointments from './modules/receptionist_appointments.js?v=6';

const modules = {
    'receptionist_appointments': {
        title: 'Appointments',
        instance: receptionistAppointments
    }
};

let activeRouteKey = null;

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
        container.innerHTML = '';
        modules[moduleKey].instance.init(container);
    }
};

function populateShell(user) {
    const initialEl = document.getElementById('user-avatar-initial');
    if (initialEl) {
        initialEl.textContent = (user.full_name || 'R').trim().charAt(0).toUpperCase();
    }

    const nameEl = document.getElementById('user-name');
    if (nameEl) {
        nameEl.textContent = user.full_name || 'Receptionist';
        nameEl.setAttribute('title', user.full_name || 'Receptionist');
    }

    const roleEl = document.getElementById('user-role');
    if (roleEl) {
        roleEl.textContent = user.role_name || 'Receptionist';
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
    document.querySelectorAll('.sidebar-nav .nav-link[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleKey = link.getAttribute('data-module');
            window.navigateTo(moduleKey);
        });
    });

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

    window.addEventListener('resize', () => {
        if (!isSidebarCollapsed()) {
            closeSidebar();
        }
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
