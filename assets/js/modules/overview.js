// assets/js/modules/overview.js
// Administrator dashboard overview: KPI cards, quick actions, and recent patients
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_objects_and_arrays (Arrays of configuration objects mapped to UI cards) & 03 APIs and Database Operations/javascript_working_with_apis

import api from '../api.js?v=8';
import { escapeHtml, showToast } from '../ui.js?v=26';

const STATS = [
    { key: 'patients',    label: 'Registered Patients', endpoint: 'api/patient_controller.php',   tone: 'primary',   href: '#patients' },
    { key: 'doctors',     label: 'Active Doctors',      endpoint: 'api/doctor_controller.php',     tone: 'info',      href: '#doctors' },
    { key: 'staff',       label: 'Staff Accounts',      endpoint: 'api/user_controller.php',       tone: 'secondary', href: '#users' },
    { key: 'specialties', label: 'Medical Specialties', endpoint: 'api/specialty_controller.php',  tone: 'warning',   href: '#specialties' },
    { key: 'services',    label: 'Service Catalog',     endpoint: 'api/service_controller.php',    tone: 'success',   href: '#services' }
];

const QUICK_ACTIONS = [
    { label: 'Register or manage patients', href: '#patients',    icon: 'patients' },
    { label: 'Create staff accounts',       href: '#users',       icon: 'staff' },
    { label: 'Maintain doctor profiles',    href: '#doctors',     icon: 'doctors' },
    { label: 'Manage service catalog',      href: '#services',    icon: 'services' },
    { label: 'Review archived records',     href: '#archive',     icon: 'archive' }
];

const ICONS = {
    patients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    doctors: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    staff: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
    specialties: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    services: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    archive: '<polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line>'
};

function iconSvg(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function capitalize(value) {
    const str = String(value || '');
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function genderBadge(gender) {
    if (gender === 'male') return 'badge badge-male';
    if (gender === 'female') return 'badge badge-female';
    return 'badge badge-role';
}

function formatDate(value) {
    if (!value) return '&mdash;';
    const date = new Date(String(value).replace(' ', 'T'));
    if (isNaN(date.getTime())) return escapeHtml(String(value));
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default {
    container: null,

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.attachEventListeners();
        this.loadData();
    },

    attachEventListeners() {
        if (this._eventsAttached) return;
        this._eventsAttached = true;

        this.container.addEventListener('click', async (e) => {
            const refreshBtn = e.target.closest('#btn-refresh-overview');
            if (refreshBtn) {
                e.preventDefault();
                await this.refreshDashboard();
            }
        });
    },

    async refreshDashboard() {
        const btn = this.container.querySelector('#btn-refresh-overview');
        const svg = btn?.querySelector('svg');
        if (btn) btn.disabled = true;
        if (svg) svg.style.animation = 'spin 0.8s linear infinite';

        // Set stat cards into loading state
        this.container.querySelectorAll('[data-stat-value]').forEach(el => {
            el.classList.add('is-loading');
        });

        // Set recent patients tbody into loading state
        const tbody = this.container.querySelector('#overview-recent-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: 2rem;">Loading recent patients...</td></tr>';
        }

        try {
            await this.loadData();
            showToast('Refreshed clinic overview data.', 'info');
        } finally {
            const newBtn = this.container.querySelector('#btn-refresh-overview');
            const newSvg = newBtn?.querySelector('svg');
            if (newBtn) newBtn.disabled = false;
            if (newSvg) newSvg.style.animation = '';
        }
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="page-intro" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
                <div>
                    <h2 class="page-title">Clinic Overview</h2>
                    <p class="page-subtitle">A live snapshot of clinic master file records and recent patient registrations.</p>
                </div>
                <div>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-overview" title="Refresh Clinic Overview">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.3rem;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div class="stat-grid">
                ${STATS.map(stat => `
                    <a class="stat-card" href="${stat.href}" data-stat="${stat.key}">
                        <span class="stat-icon stat-icon-${stat.tone}">${iconSvg(stat.key)}</span>
                        <span class="stat-info">
                            <span class="stat-value is-loading" data-stat-value="${stat.key}">0</span>
                            <span class="stat-label">${escapeHtml(stat.label)}</span>
                        </span>
                    </a>
                `).join('')}
            </div>

            <div class="dashboard-columns">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Recent Patient Registrations</h3>
                            <p class="card-subtitle">Latest five patients added to the system</p>
                        </div>
                        <a href="#patients" class="btn btn-secondary btn-sm">View All Patients</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Gender</th>
                                    <th class="hide-sm">Contact No.</th>
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            <tbody id="overview-recent-body">
                                <tr><td colspan="4" class="text-center text-muted" style="padding: 2rem;">Loading recent patients...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Quick Actions</h3>
                            <p class="card-subtitle">Jump straight to common tasks</p>
                        </div>
                    </div>
                    <div class="quick-actions">
                        ${QUICK_ACTIONS.map(action => `
                            <a class="quick-action" href="${action.href}">
                                <span class="quick-action-icon">${iconSvg(action.icon)}</span>
                                <span>${escapeHtml(action.label)}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    async loadData() {
        this.loadRecentPatients();
        await Promise.allSettled(STATS.map(stat => this.loadStat(stat)));
    },

    async loadStat(stat) {
        const valueEl = this.container.querySelector(`[data-stat-value="${stat.key}"]`);
        try {
            const res = await api.get(stat.endpoint, { page: 1, page_size: 1, status: 'active' });
            if (!res.success) throw new Error(res.message);
            this.setStatValue(valueEl, res.data.total);
        } catch (err) {
            this.setStatValue(valueEl, '\u2014', 'Unable to load this figure right now.');
        }
    },

    setStatValue(el, value, title = '') {
        if (!el) return;
        el.classList.remove('is-loading');
        el.textContent = value;
        if (title) el.setAttribute('title', title);
    },

    async loadRecentPatients() {
        const tbody = this.container.querySelector('#overview-recent-body');
        if (!tbody) return;

        try {
            const res = await api.get('api/patient_controller.php', {
                page: 1,
                page_size: 5,
                status: 'active',
                sort_by: 'created_at',
                sort_order: 'DESC'
            });
            if (!res.success) throw new Error(res.message);
            this.renderRecentPatients(tbody, res.data.items);
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: 2rem;">Unable to load recent patients right now.</td></tr>';
        }
    },

    renderRecentPatients(tbody, items) {
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <strong>No patient records yet</strong>
                            <p>Newly registered patients will appear here.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(patient => `
            <tr>
                <td>${escapeHtml(`${patient.last_name}, ${patient.first_name}`)}</td>
                <td><span class="${genderBadge(patient.gender)}">${escapeHtml(capitalize(patient.gender))}</span></td>
                <td class="hide-sm">${escapeHtml(patient.contact_no || '\u2014')}</td>
                <td>${formatDate(patient.created_at)}</td>
            </tr>
        `).join('');
    }
};
