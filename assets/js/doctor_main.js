// assets/js/doctor_main.js
// Single-Page Application Router and Module Orchestrator for Doctor Portal
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (ES module orchestration) & javascript_fundamentals (DOMContentLoaded initialization)

import { requireSession } from './session-guard.js?v=22';
import doctorOverview from './modules/doctor_overview.js?v=22';
import doctorAppointments from './modules/doctor_appointments.js?v=22';
import doctorPatients from './modules/doctor_patients.js?v=22';
import doctorProfile from './modules/doctor_profile.js?v=22';
import doctorConsultation from './modules/doctor_consultation.js?v=22';

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
    'doctor_profile': {
        title: 'My Profile',
        instance: doctorProfile
    },
    'doctor_consultation': {
        title: 'Consultation',
        instance: doctorConsultation
    }
};

let activeRouteKey = null;

// Off-canvas sidebar controls
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
        container.innerHTML = '';
        modules[moduleKey].instance.init(container, param);
    }
};

function populateShell(user) {
    const initialEl = document.getElementById('user-avatar-initial');
    if (initialEl) {
        initialEl.textContent = (user.full_name || 'D').trim().charAt(0).toUpperCase();
    }

    const nameEl = document.getElementById('user-name');
    if (nameEl) {
        nameEl.textContent = user.full_name || 'Doctor';
        nameEl.setAttribute('title', user.full_name || 'Doctor');
    }

    const roleEl = document.getElementById('user-role');
    if (roleEl) {
        roleEl.textContent = user.role_name || 'Doctor';
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
    window.navigateTo(initialHash || 'doctor_overview');
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
