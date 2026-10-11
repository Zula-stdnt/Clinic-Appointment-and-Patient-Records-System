// assets/js/modules/doctor_overview.js
// Doctor Clinical Cockpit & Operations Dashboard
// Features: Multi-period time horizon filtering (Today, This Week, This Month, All-Time),
// live operational queue triage, historical consultation activity log, and productivity metrics.
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_objects_and_arrays & 03 APIs and Database Operations/javascript_working_with_apis

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';

function formatTime(val) {
    if (!val) return '--';
    const parts = String(val).split(':');
    if (parts.length < 2) return String(val);
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return String(val);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateHeader(d) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(val) {
    if (!val) return '--';
    const parsed = new Date(`${String(val).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(val);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGreeting(h) {
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
}

function getPeriodLabel(period, now = new Date()) {
    if (period === 'today') {
        return formatDateHeader(now);
    }
    if (period === 'week') {
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const opt = { month: 'short', day: 'numeric' };
        return `Week of ${monday.toLocaleDateString('en-US', opt)} – ${sunday.toLocaleDateString('en-US', { ...opt, year: 'numeric' })}`;
    }
    if (period === 'month') {
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return 'All-Time Clinical Records';
}

function getAppointmentsForPeriod(allAppts, period, now = new Date()) {
    const todayStr = formatDateYMD(now);
    if (period === 'today') {
        return allAppts
            .filter(a => a.appointment_date === todayStr)
            .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));
    }
    if (period === 'week') {
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const startStr = formatDateYMD(monday);
        const endStr = formatDateYMD(sunday);
        return allAppts
            .filter(a => a.appointment_date >= startStr && a.appointment_date <= endStr)
            .sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
    }
    if (period === 'month') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const monthPrefix = `${year}-${month}`;
        return allAppts
            .filter(a => (a.appointment_date || '').startsWith(monthPrefix))
            .sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
    }
    // all_time
    return [...allAppts].sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
}

function calculatePeriodStats(periodAppts) {
    const total = periodAppts.length;
    const completed = periodAppts.filter(a => a.status === 'completed').length;
    const waiting = periodAppts.filter(a => a.status === 'confirmed').length;
    const upcoming = periodAppts.filter(a => a.status === 'scheduled').length;
    const cancelled = periodAppts.filter(a => ['cancelled', 'no_show'].includes(a.status)).length;
    const uniquePatients = new Set(periodAppts.map(a => a.patient_id)).size;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    return {
        total,
        completed,
        waiting,
        upcoming,
        cancelled,
        uniquePatients,
        completionRate,
        cancellationRate
    };
}

export default {
    container: null,
    state: {
        profile: null,
        allAppointments: [],
        activePeriod: 'today', // 'today' | 'week' | 'month' | 'all_time'
        filter: 'all', // sub-filter in queue/table
        nextPatient: null,
        sortBy: 'time',
        sortOrder: 'asc'
    },

    async init(container) {
        this.container = container;
        this.state.activePeriod = 'today';
        this.state.filter = 'all';
        this.state.sortBy = 'time';
        this.state.sortOrder = 'asc';
        this.renderSkeleton();
        await this.loadData();
    },

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="page-intro" id="doc-intro" style="margin-bottom: 1.25rem;">
                <div>
                    <h2 class="page-title" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span>Doctor Clinical Dashboard</span>
                    </h2>
                    <p class="page-subtitle text-muted">Loading your clinical agenda and statistics...</p>
                </div>
            </div>

            <div class="stat-grid" id="doc-stat-grid">
                <div class="stat-card">
                    <span class="stat-icon stat-icon-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Total Patients</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Waiting in Clinic</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Upcoming Scheduled</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-success">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Completed Consults</span>
                    </span>
                </div>
            </div>

            <div class="dashboard-columns" id="doc-main-grid">
                <div class="card" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading patient queue...
                </div>
                <div class="card" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading quick actions...
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const [profileRes, apptsRes] = await Promise.all([
                api.get('api/doctor_profile_controller.php').catch(() => null),
                api.get('api/appointment_controller.php').catch(() => null)
            ]);

            if (profileRes && profileRes.success && profileRes.data && profileRes.data.profile) {
                this.state.profile = profileRes.data.profile;
            }

            this.state.allAppointments = (apptsRes && apptsRes.success && apptsRes.data && apptsRes.data.items)
                ? apptsRes.data.items
                : [];

            // Detect next waiting patient for today (earliest confirmed)
            const now = new Date();
            const todayStr = formatDateYMD(now);
            const todayWaiting = this.state.allAppointments
                .filter(a => a.appointment_date === todayStr && a.status === 'confirmed')
                .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));

            this.state.nextPatient = todayWaiting.length > 0 ? todayWaiting[0] : null;

            this.renderDashboard();
            this.attachEventListeners();
        } catch (err) {
            console.error('Failed to load doctor dashboard data', err);
            showToast('Failed to load clinical dashboard data.', 'error');
        }
    },

    renderDashboard() {
        const now = new Date();
        const greeting = getGreeting(now.getHours());
        const p = this.state.profile || {};
        const docName = p.first_name ? `Dr. ${p.first_name} ${p.last_name || ''}` : 'Doctor';

        let specialtiesHtml = '<span class="badge" style="background: var(--bg-alt); color: var(--text-muted); font-size: 0.78rem;">Licensed Physician</span>';
        if (p.specialty_names) {
            specialtiesHtml = p.specialty_names.split(',').map(s => 
                `<span class="badge badge-info" style="font-size: 0.78rem; margin-right: 0.35rem;">${escapeHtml(s.trim())}</span>`
            ).join('');
        }

        const activePeriod = this.state.activePeriod;
        const periodLabel = getPeriodLabel(activePeriod, now);

        // Filter appointments for current period
        const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, activePeriod, now);
        const stats = calculatePeriodStats(periodAppts);

        // Count today's waiting count for header status badge
        const todayStr = formatDateYMD(now);
        const todayWaitingCount = this.state.allAppointments.filter(a => a.appointment_date === todayStr && a.status === 'confirmed').length;

        // 1. Render Intro Banner with Multi-Period Switcher
        const introEl = this.container.querySelector('#doc-intro');
        if (introEl) {
            introEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; width: 100%;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                            <h2 class="page-title" style="margin: 0; font-size: 1.6rem; color: var(--text);">
                                ${greeting}, ${escapeHtml(docName)}
                            </h2>
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                                ${specialtiesHtml}
                            </div>
                        </div>
                        <p class="page-subtitle" style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">
                            <span>${escapeHtml(periodLabel)}</span> &middot; 
                            <span style="color: var(--success); font-weight: 600;">&bull; Clinic Session Active</span>
                            ${todayWaitingCount > 0 ? ` &middot; <span><strong>${todayWaitingCount}</strong> patient${todayWaitingCount === 1 ? '' : 's'} waiting in clinic right now</span>` : ''}
                        </p>
                    </div>

                    <!-- Time Horizon Switcher & Refresh -->
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <div class="period-switcher" style="display: flex; background: var(--bg); padding: 0.25rem; border-radius: var(--radius-md); border: 1px solid var(--border); gap: 0.2rem;">
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'today' ? 'btn-primary' : 'btn-secondary'}" data-period="today" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                Today
                            </button>
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'week' ? 'btn-primary' : 'btn-secondary'}" data-period="week" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                This Week
                            </button>
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'month' ? 'btn-primary' : 'btn-secondary'}" data-period="month" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                This Month
                            </button>
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'all_time' ? 'btn-primary' : 'btn-secondary'}" data-period="all_time" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                All-Time
                            </button>
                        </div>

                        <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-dashboard" title="Refresh Live Queue">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.3rem;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            Refresh
                        </button>
                    </div>
                </div>
            `;
        }

        // 2. Render Context-Aware Stat Grid
        const statGrid = this.container.querySelector('#doc-stat-grid');
        if (statGrid) {
            if (activePeriod === 'today') {
                statGrid.innerHTML = `
                    <a class="stat-card" href="javascript:void(0)" data-filter="all" title="View all today's appointments">
                        <span class="stat-icon stat-icon-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${stats.total}</span>
                            <span class="stat-label">Today's Patients</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="waiting" title="View patients ready in clinic" style="${stats.waiting > 0 ? 'border-color: #f97316; box-shadow: 0 0 0 1px rgba(249,115,22,0.25);' : ''}">
                        <span class="stat-icon" style="background: ${stats.waiting > 0 ? '#fff7ed' : 'var(--bg-alt)'}; color: ${stats.waiting > 0 ? '#ea580c' : 'var(--text-muted)'};">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: ${stats.waiting > 0 ? '#ea580c' : 'inherit'};">${stats.waiting}</span>
                            <span class="stat-label" style="display: flex; align-items: center; gap: 0.35rem;">
                                Waiting in Clinic
                                ${stats.waiting > 0 ? '<span class="badge" style="background:#ea580c; color:white; font-size:0.65rem; padding: 2px 6px;">READY</span>' : ''}
                            </span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="scheduled" title="View upcoming scheduled visits">
                        <span class="stat-icon stat-icon-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${stats.upcoming}</span>
                            <span class="stat-label">Upcoming Scheduled</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="completed" title="View completed consultations">
                        <span class="stat-icon stat-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${stats.completed}</span>
                            <span class="stat-label">Completed Consults (${stats.completionRate}%)</span>
                        </span>
                    </a>
                `;
            } else {
                // Historical / Aggregated Metrics (This Week, This Month, All-Time)
                const periodTitle = activePeriod === 'week' ? 'This Week' : (activePeriod === 'month' ? 'This Month' : 'All-Time');
                statGrid.innerHTML = `
                    <a class="stat-card" href="javascript:void(0)" data-filter="all" title="View all appointments in ${periodTitle}">
                        <span class="stat-icon stat-icon-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${stats.total}</span>
                            <span class="stat-label">Total Appointments (${periodTitle})</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="completed" title="View completed consultations in ${periodTitle}">
                        <span class="stat-icon stat-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: var(--success);">${stats.completed}</span>
                            <span class="stat-label">Completed Consults (${stats.completionRate}%)</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="all" title="Unique individual patients treated">
                        <span class="stat-icon stat-icon-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${stats.uniquePatients}</span>
                            <span class="stat-label">Unique Patients Treated</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="cancelled" title="Cancelled and no-show volume">
                        <span class="stat-icon stat-icon-secondary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: ${stats.cancelled > 0 ? '#b91c1c' : 'inherit'};">${stats.cancelled}</span>
                            <span class="stat-label">Cancelled / No-Show (${stats.cancellationRate}%)</span>
                        </span>
                    </a>
                `;
            }
        }

        // 3. Render Two-Column Main Workspace
        const mainGrid = this.container.querySelector('#doc-main-grid');
        if (mainGrid) {
            const isToday = activePeriod === 'today';
            const tableTitle = isToday
                ? "Today's Patient Queue &amp; Triage"
                : (activePeriod === 'week' ? "This Week's Consultation Activity" : (activePeriod === 'month' ? "This Month's Consultation Log" : "All-Time Consultation Log"));
            
            const tableSubtitle = isToday
                ? "Chronological clinic order &bull; Patients confirmed by reception are ready for consultation"
                : `${escapeHtml(periodLabel)} &bull; ${stats.total} record${stats.total === 1 ? '' : 's'} in selected period`;

            mainGrid.innerHTML = `
                <!-- Left Column: Patient Queue / Activity Log -->
                <div class="card" style="padding: 0; overflow: hidden; background: var(--surface);">
                    <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                        <div>
                            <h3 style="margin: 0 0 0.2rem 0; font-size: 1.15rem; color: var(--text); font-weight: 700;">
                                ${tableTitle}
                            </h3>
                            <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">
                                ${tableSubtitle}
                            </p>
                        </div>
                        <div class="queue-filters" style="display: flex; gap: 0.35rem; background: var(--bg); padding: 0.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                            <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                All (${stats.total})
                            </button>
                            ${isToday ? `
                                <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'waiting' ? 'btn-primary' : 'btn-secondary'}" data-filter="waiting" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                    Waiting (${stats.waiting})
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'scheduled' ? 'btn-primary' : 'btn-secondary'}" data-filter="scheduled" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                    Scheduled (${stats.upcoming + stats.waiting})
                                </button>
                            `}
                            <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'completed' ? 'btn-primary' : 'btn-secondary'}" data-filter="completed" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                Completed (${stats.completed})
                            </button>
                        </div>
                    </div>

                    <div id="queue-list-container">
                        ${this.renderQueueItemsHtml(periodAppts, isToday)}
                    </div>
                </div>

                <!-- Right Column: Quick Actions & Productivity Analytics -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Call Next Patient Card (Operational Action) -->
                    <div class="card" style="padding: 1.25rem; border-top: 4px solid var(--primary); background: var(--surface);">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Clinical Quick Actions</h4>
                        <p style="margin: 0 0 1rem 0; font-size: 0.82rem; color: var(--text-muted);">Direct shortcuts for your clinic session</p>

                        ${this.renderCallNextButtonHtml()}

                        <div class="quick-actions" style="padding: 0; margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            <a href="#doctor_patients" class="quick-action" style="padding: 0.65rem 0.85rem; font-size: 0.85rem;">
                                <span class="quick-action-icon" style="width: 28px; height: 28px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                </span>
                                <span>Patient Records &amp; Directory</span>
                            </a>
                            <a href="#doctor_appointments" class="quick-action" style="padding: 0.65rem 0.85rem; font-size: 0.85rem;">
                                <span class="quick-action-icon" style="width: 28px; height: 28px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </span>
                                <span>Full Appointment Schedule</span>
                            </a>
                            <a href="#profile" class="quick-action" style="padding: 0.65rem 0.85rem; font-size: 0.85rem;">
                                <span class="quick-action-icon" style="width: 28px; height: 28px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M6.5 19a6 6 0 0 1 11 0"></path></svg>
                                </span>
                                <span>Physician Profile &amp; Settings</span>
                            </a>
                        </div>
                    </div>

                    <!-- Period Performance & Analytics Card -->
                    <div class="card" style="padding: 1.25rem; background: var(--surface);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h4 style="margin: 0; font-size: 0.95rem; color: var(--text);">
                                ${isToday ? "Today's Clinic Progress" : "Consultation Completion Rate"}
                            </h4>
                            <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">${stats.completionRate}%</span>
                        </div>
                        
                        <div style="width: 100%; height: 8px; background: var(--bg-alt); border-radius: 4px; overflow: hidden; margin-bottom: 0.85rem;">
                            <div style="width: ${stats.completionRate}%; height: 100%; background: var(--primary); transition: width 0.4s ease;"></div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center; border-top: 1px solid var(--border); padding-top: 0.85rem;">
                            <div>
                                <span style="display: block; font-size: 1.1rem; font-weight: 700; color: var(--success);">${stats.completed}</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Completed</span>
                            </div>
                            <div>
                                <span style="display: block; font-size: 1.1rem; font-weight: 700; color: ${isToday ? '#ea580c' : 'var(--info)'};">${isToday ? stats.waiting : (stats.upcoming + stats.waiting)}</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">${isToday ? 'In Clinic' : 'Scheduled'}</span>
                            </div>
                            <div>
                                <span style="display: block; font-size: 1.1rem; font-weight: 700; color: ${stats.cancelled > 0 ? '#b91c1c' : 'var(--text-muted)'};">${stats.cancelled}</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Cancelled</span>
                            </div>
                        </div>

                        <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-muted);">
                            ${isToday ? `
                                <strong>Clinic Shift Hours:</strong> Mon &ndash; Sat &bull; 08:00 AM &ndash; 05:00 PM (12:00 &ndash; 01:00 PM Lunch break)
                            ` : `
                                <strong>Clinical Productivity:</strong> Treated <strong>${stats.uniquePatients}</strong> unique individual patients with <strong>${stats.completed}</strong> successfully documented encounters.
                            `}
                        </div>
                    </div>
                </div>
            `;
        }
    },

    renderCallNextButtonHtml() {
        const next = this.state.nextPatient;
        if (!next) {
            return `
                <button type="button" class="btn btn-secondary btn-block" style="width: 100%; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 600;" disabled>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    No Patients Waiting in Clinic Right Now
                </button>
            `;
        }

        const patientName = `${next.patient_last || ''}, ${next.patient_first || ''}`;
        const timeStr = formatTime(next.appointment_time);

        return `
            <button type="button" class="btn btn-primary btn-block btn-call-next" data-id="${next.appointment_id}" style="width: 100%; padding: 0.85rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; font-weight: 600; box-shadow: 0 4px 12px rgba(16, 124, 65, 0.25);">
                <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    <span>Call Next Patient:</span>
                    <strong style="text-decoration: underline;">${escapeHtml(patientName)}</strong>
                </div>
                <div style="font-size: 0.75rem; opacity: 0.9; font-weight: normal;">
                    Confirmed slot at ${timeStr} &bull; Start Consultation Now
                </div>
            </button>
        `;
    },

    renderQueueItemsHtml(apptsList, isToday) {
        let appts = [...apptsList];

        if (this.state.filter === 'waiting') {
            appts = appts.filter(a => a.status === 'confirmed');
        } else if (this.state.filter === 'completed') {
            appts = appts.filter(a => a.status === 'completed');
        } else if (this.state.filter === 'scheduled') {
            appts = appts.filter(a => ['scheduled', 'confirmed'].includes(a.status));
        } else if (this.state.filter === 'cancelled') {
            appts = appts.filter(a => ['cancelled', 'no_show'].includes(a.status));
        }

        // Apply in-memory column sorting
        if (this.state.sortBy === 'time') {
            appts.sort((a, b) => {
                const dA = `${a.appointment_date || ''} ${a.appointment_time || ''}`;
                const dB = `${b.appointment_date || ''} ${b.appointment_time || ''}`;
                return this.state.sortOrder === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
            });
        } else if (this.state.sortBy === 'patient') {
            appts.sort((a, b) => {
                const nA = `${a.patient_last || ''} ${a.patient_first || ''}`.toLowerCase();
                const nB = `${b.patient_last || ''} ${b.patient_first || ''}`.toLowerCase();
                return this.state.sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
            });
        } else if (this.state.sortBy === 'status') {
            appts.sort((a, b) => {
                const sA = (a.status || '').toLowerCase();
                const sB = (b.status || '').toLowerCase();
                return this.state.sortOrder === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
            });
        }

        if (appts.length === 0) {
            let msg = isToday
                ? 'No appointments scheduled for today.'
                : 'No appointment records found for this time period.';

            if (this.state.filter === 'waiting') {
                msg = 'No patients are currently waiting in the clinic.';
            } else if (this.state.filter === 'completed') {
                msg = 'No consultations have been completed in this period.';
            } else if (this.state.filter === 'scheduled') {
                msg = 'No upcoming scheduled appointments pending.';
            } else if (this.state.filter === 'cancelled') {
                msg = 'No cancelled or no-show appointments in this period.';
            }

            return `
                <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; opacity: 0.4;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <div style="font-size: 0.95rem; font-weight: 500;">${escapeHtml(msg)}</div>
                </div>
            `;
        }

        const sortTimeClass = this.state.sortBy === 'time' ? (this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : '';
        const sortPatClass = this.state.sortBy === 'patient' ? (this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : '';
        const sortStatusClass = this.state.sortBy === 'status' ? (this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : '';

        return `
            <div class="table-responsive">
                <table class="data-table" style="margin: 0;">
                    <thead>
                        <tr>
                            <th data-sort="time" class="${sortTimeClass}" style="width: ${isToday ? '115px' : '160px'};">${isToday ? 'Time' : 'Date &amp; Time'}</th>
                            <th data-sort="patient" class="${sortPatClass}">Patient</th>
                            <th>Chief Complaint</th>
                            <th data-sort="status" class="${sortStatusClass}" style="width: 140px; text-align: center;">Status</th>
                            <th style="width: 130px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${appts.map(a => {
                            const patientName = `${a.patient_last || ''}, ${a.patient_first || ''}`;
                            const timeStr = formatTime(a.appointment_time);
                            const dateStr = formatShortDate(a.appointment_date);
                            const reasonStr = a.chief_complaint ? a.chief_complaint.trim() : 'General Consultation';

                            let dateTimeCell = '';
                            if (isToday) {
                                dateTimeCell = `
                                    <div style="font-weight: 600; color: var(--text); font-size: 0.88rem;">${escapeHtml(timeStr)}</div>
                                    ${a.is_overdue ? `<span class="badge badge-status-overdue" style="font-size:0.65rem; padding: 2px 4px; display: inline-block; margin-top: 2px;">Overdue</span>` : ''}
                                `;
                            } else {
                                dateTimeCell = `
                                    <div style="font-weight: 600; color: var(--text); font-size: 0.85rem;">${escapeHtml(dateStr)}</div>
                                    <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(timeStr)}</div>
                                `;
                            }

                            let statusBadge = '';
                            let actionButton = '';

                            if (a.status === 'confirmed') {
                                statusBadge = '<span class="badge badge-status-confirmed">Waiting in Clinic</span>';
                                actionButton = `
                                    <button type="button" class="btn btn-primary btn-sm btn-consult-row" data-id="${a.appointment_id}" style="width: 100%; white-space: nowrap; font-size: 0.78rem;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>Consult
                                    </button>
                                `;
                            } else if (a.status === 'completed') {
                                statusBadge = '<span class="badge badge-status-completed">Completed</span>';
                                actionButton = `
                                    <button type="button" class="btn btn-secondary btn-sm btn-review-row" data-id="${a.appointment_id}" style="width: 100%; white-space: nowrap; font-size: 0.78rem;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>View Chart
                                    </button>
                                `;
                            } else if (a.status === 'scheduled') {
                                statusBadge = '<span class="badge badge-status-scheduled">Scheduled</span>';
                                actionButton = `
                                    <span class="text-muted" style="font-size: 0.78rem; display: block; text-align: center;" title="Patient must be confirmed at reception before consultation can begin">
                                        Check-in Pending
                                    </span>
                                `;
                            } else if (a.status === 'cancelled') {
                                statusBadge = '<span class="badge badge-status-cancelled">Cancelled</span>';
                                actionButton = '<span class="text-muted" style="font-size: 0.78rem;">&mdash;</span>';
                            } else {
                                statusBadge = '<span class="badge badge-status-noshow">No Show</span>';
                                actionButton = '<span class="text-muted" style="font-size: 0.78rem;">&mdash;</span>';
                            }

                            // Vitals pill if available
                            let vitalsPill = '';
                            if (a.blood_pressure || a.temperature) {
                                const bp = a.blood_pressure ? `BP: ${a.blood_pressure}` : '';
                                const temp = a.temperature ? `${a.temperature}&deg;C` : '';
                                const vitalsText = [bp, temp].filter(Boolean).join(' &bull; ');
                                vitalsPill = `
                                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem; display: flex; align-items: center; gap: 0.35rem;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                        <span>${vitalsText}</span>
                                    </div>
                                `;
                            }

                            return `
                                <tr style="${a.status === 'confirmed' ? 'background: rgba(16, 124, 65, 0.03);' : ''}">
                                    <td style="vertical-align: middle;">
                                        ${dateTimeCell}
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <strong style="color: var(--text); font-size: 0.92rem; display: block;">${escapeHtml(patientName)}</strong>
                                        ${vitalsPill}
                                    </td>
                                    <td style="vertical-align: middle; font-size: 0.84rem; color: var(--text-muted); max-width: 250px;">
                                        <span title="${escapeHtml(reasonStr)}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                            ${escapeHtml(reasonStr)}
                                        </span>
                                    </td>
                                    <td style="vertical-align: middle; text-align: center;">
                                        ${statusBadge}
                                    </td>
                                    <td style="vertical-align: middle; text-align: center;">
                                        ${actionButton}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    attachEventListeners() {
        const c = this.container;

        // Refresh button
        c.querySelector('#btn-refresh-dashboard')?.addEventListener('click', () => {
            this.loadData();
            showToast('Refreshed clinical records and live queue.', 'info');
        });

        // Time horizon period switcher (Today | This Week | This Month | All-Time)
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-period-tab');
            if (btn) {
                const targetPeriod = btn.getAttribute('data-period');
                if (targetPeriod && targetPeriod !== this.state.activePeriod) {
                    this.state.activePeriod = targetPeriod;
                    this.state.filter = 'all'; // reset sub-filter
                    this.renderDashboard();
                }
            }
        });

        // Filter pills in queue header
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.queue-filter-btn');
            if (btn) {
                const targetFilter = btn.getAttribute('data-filter');
                if (targetFilter) {
                    this.state.filter = targetFilter;
                    // Update button active state
                    c.querySelectorAll('.queue-filter-btn').forEach(b => {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                    });
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');

                    // Re-render queue table
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now);
                    const queueContainer = c.querySelector('#queue-list-container');
                    if (queueContainer) {
                        queueContainer.innerHTML = this.renderQueueItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            }
        });

        // Stat cards with filter shortcut
        c.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card[data-filter]');
            if (card) {
                const targetFilter = card.getAttribute('data-filter');
                if (targetFilter) {
                    this.state.filter = targetFilter;
                    c.querySelectorAll('.queue-filter-btn').forEach(b => {
                        if (b.getAttribute('data-filter') === targetFilter) {
                            b.classList.remove('btn-secondary');
                            b.classList.add('btn-primary');
                        } else {
                            b.classList.remove('btn-primary');
                            b.classList.add('btn-secondary');
                        }
                    });
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now);
                    const queueContainer = c.querySelector('#queue-list-container');
                    if (queueContainer) {
                        queueContainer.innerHTML = this.renderQueueItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            }
        });

        // Call Next Patient button
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-call-next');
            if (btn) {
                const apptId = btn.getAttribute('data-id');
                if (apptId && window.navigateTo) {
                    window.navigateTo(`doctor_consultation/${apptId}`);
                }
            }
        });

        // Start Consult Row button
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-consult-row');
            if (btn) {
                const apptId = btn.getAttribute('data-id');
                if (apptId && window.navigateTo) {
                    window.navigateTo(`doctor_consultation/${apptId}`);
                }
            }
        });

        // View/Review Chart Row button
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-review-row');
            if (btn) {
                const apptId = btn.getAttribute('data-id');
                if (apptId && window.navigateTo) {
                    window.navigateTo(`doctor_consultation/${apptId}`);
                }
            }
        });

        // Queue table header sorting
        c.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (th) {
                const sortField = th.getAttribute('data-sort');
                if (sortField) {
                    if (this.state.sortBy === sortField) {
                        this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.state.sortBy = sortField;
                        this.state.sortOrder = 'asc';
                    }
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now);
                    const queueContainer = c.querySelector('#queue-list-container');
                    if (queueContainer) {
                        queueContainer.innerHTML = this.renderQueueItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            }
        });
    }
};
