// assets/js/modules/receptionist_overview.js
// Receptionist Front-Desk Command Center (Dashboard)
// Features: Multi-period time horizon filtering (Today, This Week, This Month, All-Time),
// live lobby triage & waiting board, daily clinic capacity gauge (10 max limit),
// doctors on duty monitoring, and front-desk quick actions (including 1-click blank form printing).
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_objects_and_arrays & 03 APIs and Database Operations/javascript_working_with_apis

import api from '../api.js?v=8';
import { escapeHtml, showToast, formatStatusLabel } from '../ui.js?v=28';
import { printBlankForm } from '../components/print-appointment-form.js?v=4';

const MAX_DAILY_CAPACITY = 10;

const formatTime = (val) => {
    if (!val) return '--';
    const parts = String(val).split(':');
    if (parts.length < 2) return String(val);
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return String(val);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateHeader = (d) => {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (val) => {
    if (!val) return '--';
    const parsed = new Date(`${String(val).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(val);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getGreeting = (h) => {
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
};

const formatReadableDate = (val) => {
    if (!val) return '';
    const parsed = new Date(`${String(val).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(val);
    return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const getPeriodLabel = (period, now = new Date(), startDate = null, endDate = null) => {
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
    if (period === 'range') {
        if (startDate && endDate) {
            return `${formatReadableDate(startDate)} to ${formatReadableDate(endDate)}`;
        }
        if (startDate) {
            return `From ${formatReadableDate(startDate)}`;
        }
        if (endDate) {
            return `Up to ${formatReadableDate(endDate)}`;
        }
        return 'Custom Date Range';
    }
    if (period === 'all') {
        return 'All-Time Clinic Overview (All Dates)';
    }
    return 'Clinic Overview';
};

const getAppointmentsForPeriod = (allAppts, period, now = new Date(), startDate = null, endDate = null) => {
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
    if (period === 'range') {
        return allAppts
            .filter(a => {
                if (startDate && a.appointment_date < startDate) return false;
                if (endDate && a.appointment_date > endDate) return false;
                return true;
            })
            .sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
    }
    if (period === 'all') {
        return [...allAppts].sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
    }
    return [...allAppts].sort((a, b) => `${b.appointment_date} ${b.appointment_time || ''}`.localeCompare(`${a.appointment_date} ${a.appointment_time || ''}`));
};

export default {
    container: null,
    state: {
        allAppointments: [],
        allPatients: [],
        totalPatientsCount: 0,
        doctors: [],
        activePeriod: 'today', // 'today' | 'week' | 'all' | 'range'
        startDate: '',
        endDate: '',
        filter: 'all', // 'all' | 'waiting' | 'scheduled' | 'completed'
        page: 1,
        pageSize: 10,
        sortBy: 'time',
        sortOrder: 'asc'
    },

    async init(container) {
        this.container = container;
        this.state.totalPatientsCount = 0;
        this.state.activePeriod = 'today';
        this.state.startDate = '';
        this.state.endDate = '';
        this.state.filter = 'all';
        this.state.page = 1;
        this.state.pageSize = 10;
        this.state.sortBy = 'time';
        this.state.sortOrder = 'asc';
        this.renderSkeleton();
        await this.loadData();
    },

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="page-intro" id="rec-intro" style="margin-bottom: 1.25rem;">
                <div>
                    <h2 class="page-title">Front-Desk Command Center</h2>
                    <p class="page-subtitle text-muted">Loading lobby waiting room and clinic capacity...</p>
                </div>
            </div>

            <div class="stat-grid" id="rec-stat-grid">
                <div class="stat-card">
                    <span class="stat-icon stat-icon-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Today's Clinic Load</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Waiting in Lobby</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-success">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">Completed Consultations</span>
                    </span>
                </div>
                <div class="stat-card">
                    <span class="stat-icon stat-icon-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                    </span>
                    <span class="stat-info">
                        <span class="stat-value is-loading">0</span>
                        <span class="stat-label">New Patients Registered</span>
                    </span>
                </div>
            </div>

            <div class="dashboard-columns" id="rec-main-grid">
                <div class="card" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading lobby triage board...
                </div>
                <div class="card" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading capacity and doctors on duty...
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const [apptsRes, patientsRes, docsRes] = await Promise.all([
                api.get('api/appointment_controller.php').catch(() => null),
                api.get('api/patient_controller.php?all=true&sort_by=created_at&sort_order=DESC').catch(() => null),
                api.get('api/appointment_controller.php?meta=doctors').catch(() => null)
            ]);

            this.state.allAppointments = (apptsRes && apptsRes.success && apptsRes.data && apptsRes.data.items)
                ? apptsRes.data.items
                : [];

            this.state.allPatients = (patientsRes && patientsRes.success && patientsRes.data && patientsRes.data.items)
                ? patientsRes.data.items
                : [];

            this.state.totalPatientsCount = (patientsRes && patientsRes.success && patientsRes.data && patientsRes.data.total != null)
                ? Number(patientsRes.data.total)
                : this.state.allPatients.length;

            this.state.doctors = (docsRes && docsRes.success && docsRes.data && docsRes.data.items)
                ? docsRes.data.items
                : [];

            this.renderDashboard();
            this.attachEventListeners();
        } catch (err) {
            console.error('Failed to load receptionist dashboard data', err);
            showToast('Failed to load front-desk dashboard data.', 'error');
        }
    },

    renderDashboard() {
        const now = new Date();
        const greeting = getGreeting(now.getHours());
        const todayStr = formatDateYMD(now);
        const activePeriod = this.state.activePeriod;
        const periodLabel = getPeriodLabel(activePeriod, now, this.state.startDate, this.state.endDate);

        // Filter appointments for active period
        const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, activePeriod, now, this.state.startDate, this.state.endDate);

        // Daily capacity calculation (today's active, non-cancelled appointments)
        const todayAppts = this.state.allAppointments.filter(a => a.appointment_date === todayStr);
        const activeTodaySlots = todayAppts.filter(a => !['cancelled', 'no_show'].includes(a.status)).length;
        const capacityPct = Math.min(100, Math.round((activeTodaySlots / MAX_DAILY_CAPACITY) * 100));
        const remainingSlots = Math.max(0, MAX_DAILY_CAPACITY - activeTodaySlots);

        // Metric calculations for the period
        const totalAppts = periodAppts.length;
        const waitingLobby = periodAppts.filter(a => a.status === 'confirmed').length;
        const completedAppts = periodAppts.filter(a => a.status === 'completed').length;
        const upcomingScheduled = periodAppts.filter(a => a.status === 'scheduled').length;
        const cancelledAppts = periodAppts.filter(a => ['cancelled', 'no_show'].includes(a.status)).length;
        const completionRate = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;
        const cancellationRate = totalAppts > 0 ? Math.round((cancelledAppts / totalAppts) * 100) : 0;

        // New patients registered in the period
        let newPatientsCount = 0;
        if (activePeriod === 'today') {
            newPatientsCount = this.state.allPatients.filter(p => (p.created_at || '').startsWith(todayStr)).length;
        } else if (activePeriod === 'week') {
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const startStr = formatDateYMD(monday);
            const endStr = formatDateYMD(sunday);
            newPatientsCount = this.state.allPatients.filter(p => {
                const d = (p.created_at || '').slice(0, 10);
                return d >= startStr && d <= endStr;
            }).length;
        } else if (activePeriod === 'range') {
            newPatientsCount = this.state.allPatients.filter(p => {
                const d = (p.created_at || '').slice(0, 10);
                if (this.state.startDate && d < this.state.startDate) return false;
                if (this.state.endDate && d > this.state.endDate) return false;
                return true;
            }).length;
        } else {
            newPatientsCount = this.state.totalPatientsCount || this.state.allPatients.length;
        }

        // Capacity indicator badge for header
        let capacityBadgeHtml = '';
        if (activeTodaySlots >= 10) {
            capacityBadgeHtml = `
                <span class="badge badge-status-critical" style="font-size: 0.8rem; font-weight: 700; padding: 4px 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Full Capacity (${activeTodaySlots}/${MAX_DAILY_CAPACITY}) &bull; No more bookings allowed
                </span>
            `;
        } else if (activeTodaySlots >= 8) {
            capacityBadgeHtml = `
                <span class="badge badge-status-confirmed" style="font-size: 0.8rem; font-weight: 700; padding: 4px 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Approaching Daily Limit (${activeTodaySlots}/${MAX_DAILY_CAPACITY}) &bull; ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} remaining
                </span>
            `;
        } else {
            capacityBadgeHtml = `
                <span class="badge badge-status-completed" style="font-size: 0.8rem; font-weight: 600; padding: 4px 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Normal Capacity (${activeTodaySlots}/${MAX_DAILY_CAPACITY}) &bull; ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} available
                </span>
            `;
        }

        // 1. Render Intro Banner with Capacity Status & Time Horizon Switcher
        const introEl = this.container.querySelector('#rec-intro');
        if (introEl) {
            introEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; width: 100%;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                            <h2 class="page-title" style="margin: 0; font-size: 1.6rem; color: var(--text);">
                                ${greeting}, Front-Desk Team
                            </h2>
                            <span class="badge badge-info" style="font-size: 0.78rem;">Clinic Front-Desk Station</span>
                        </div>
                        <p class="page-subtitle" style="margin: 0; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span>${escapeHtml(periodLabel)}</span> &middot; 
                            ${capacityBadgeHtml}
                        </p>
                    </div>

                    <!-- Time Horizon Switcher & Refresh -->
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <div class="period-switcher" style="display: flex; align-items: center; background: var(--bg); padding: 0.25rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border); gap: 0.35rem; flex-wrap: wrap;">
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'today' ? 'btn-primary' : 'btn-secondary'}" data-period="today" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                Today
                            </button>
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'week' ? 'btn-primary' : 'btn-secondary'}" data-period="week" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                This Week
                            </button>
                            <button type="button" class="btn btn-sm btn-period-tab ${activePeriod === 'all' ? 'btn-primary' : 'btn-secondary'}" data-period="all" style="padding: 0.3rem 0.75rem; font-size: 0.8rem;">
                                All-Time
                            </button>
                            <div class="date-range-controls" style="display: inline-flex; align-items: center; gap: 0.35rem; padding-left: 0.35rem; border-left: 1px solid var(--border); flex-wrap: wrap;">
                                <label for="rec-range-start" style="margin: 0; font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">From:</label>
                                <input type="date" id="rec-range-start" class="form-control form-control-sm" value="${this.state.startDate || ''}" style="padding: 0.15rem 0.4rem; font-size: 0.78rem; height: 28px; width: auto; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);">
                                <label for="rec-range-end" style="margin: 0; font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">To:</label>
                                <input type="date" id="rec-range-end" class="form-control form-control-sm" value="${this.state.endDate || ''}" style="padding: 0.15rem 0.4rem; font-size: 0.78rem; height: 28px; width: auto; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);">
                                <button type="button" class="btn btn-sm ${activePeriod === 'range' ? 'btn-primary' : 'btn-secondary'}" id="btn-rec-apply-range" style="padding: 0.2rem 0.6rem; font-size: 0.78rem;">
                                    Filter
                                </button>
                            </div>
                        </div>

                        <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-dashboard" title="Refresh Live Front-Desk Data">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.3rem;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            Refresh
                        </button>
                    </div>
                </div>
            `;
        }

        // 2. Render Context-Aware 4-Card Stat Grid
        const statGrid = this.container.querySelector('#rec-stat-grid');
        if (statGrid) {
            if (activePeriod === 'today') {
                statGrid.innerHTML = `
                    <a class="stat-card" href="javascript:void(0)" data-filter="all" title="View all today's appointments">
                        <span class="stat-icon stat-icon-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${totalAppts}</span>
                            <span class="stat-label">Today's Clinic Load</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="waiting" title="Patients checked in, sitting in lobby" style="${waitingLobby > 0 ? 'border-color: #f97316; box-shadow: 0 0 0 1px rgba(249,115,22,0.25);' : ''}">
                        <span class="stat-icon" style="background: ${waitingLobby > 0 ? '#fff7ed' : 'var(--bg-alt)'}; color: ${waitingLobby > 0 ? '#ea580c' : 'var(--text-muted)'};">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: ${waitingLobby > 0 ? '#ea580c' : 'inherit'};">${waitingLobby}</span>
                            <span class="stat-label" style="display: flex; align-items: center; gap: 0.35rem;">
                                Waiting in Lobby
                                ${waitingLobby > 0 ? '<span class="badge" style="background:#ea580c; color:white; font-size:0.65rem; padding: 2px 6px;">READY</span>' : ''}
                            </span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="completed" title="Consultations finished today">
                        <span class="stat-icon stat-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${completedAppts}</span>
                            <span class="stat-label">Completed Consults (${completionRate}%)</span>
                        </span>
                    </a>

                    <a class="stat-card" href="#receptionist_patients" title="New patients registered today at front desk">
                        <span class="stat-icon stat-icon-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${newPatientsCount}</span>
                            <span class="stat-label">Registered Today</span>
                        </span>
                    </a>
                `;
            } else {
                const periodTitle = activePeriod === 'week' ? 'This Week' : (activePeriod === 'month' ? 'This Month' : 'All-Time');
                statGrid.innerHTML = `
                    <a class="stat-card" href="javascript:void(0)" data-filter="all" title="Total appointments in ${periodTitle}">
                        <span class="stat-icon stat-icon-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${totalAppts}</span>
                            <span class="stat-label">Total Appointments (${periodTitle})</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="completed" title="Completed consultations in ${periodTitle}">
                        <span class="stat-icon stat-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: var(--success);">${completedAppts}</span>
                            <span class="stat-label">Completed Consults (${completionRate}%)</span>
                        </span>
                    </a>

                    <a class="stat-card" href="#receptionist_patients" title="Registered patients">
                        <span class="stat-icon stat-icon-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value">${newPatientsCount}</span>
                            <span class="stat-label">Patient Registrations (${periodTitle})</span>
                        </span>
                    </a>

                    <a class="stat-card" href="javascript:void(0)" data-filter="cancelled" title="Cancelled and no-show volume">
                        <span class="stat-icon stat-icon-secondary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        </span>
                        <span class="stat-info">
                            <span class="stat-value" style="color: ${cancelledAppts > 0 ? '#b91c1c' : 'inherit'};">${cancelledAppts}</span>
                            <span class="stat-label">Cancelled / No-Show (${cancellationRate}%)</span>
                        </span>
                    </a>
                `;
            }
        }

        // 3. Render Two-Column Main Workspace
        const mainGrid = this.container.querySelector('#rec-main-grid');
        if (mainGrid) {
            const isToday = activePeriod === 'today';
            const tableTitle = isToday
                ? "Live Lobby &amp; Triage Board"
                : (activePeriod === 'week' ? "This Week's Clinic Schedule" : (activePeriod === 'month' ? "This Month's Appointment Log" : "All-Time Appointment Log"));

            const tableSubtitle = isToday
                ? "Patients confirmed by reception are waiting in the clinic lobby for their doctor"
                : `${escapeHtml(periodLabel)} &bull; ${totalAppts} encounter${totalAppts === 1 ? '' : 's'} recorded`;

            // Calculate Doctors on Duty for Today
            const docMap = {};
            todayAppts.forEach(a => {
                const docId = a.doctor_id || 0;
                if (!docMap[docId]) {
                    docMap[docId] = {
                        name: `Dr. ${a.doctor_first || 'Unknown'} ${a.doctor_last || ''}`,
                        total: 0,
                        waiting: 0,
                        completed: 0,
                        scheduled: 0
                    };
                }
                docMap[docId].total++;
                if (a.status === 'confirmed') docMap[docId].waiting++;
                else if (a.status === 'completed') docMap[docId].completed++;
                else if (a.status === 'scheduled') docMap[docId].scheduled++;
            });
            const docsOnDuty = Object.values(docMap);

            mainGrid.innerHTML = `
                <!-- Left Column: Lobby Triage Table / History Log -->
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
                                All (${totalAppts})
                            </button>
                            ${isToday ? `
                                <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'waiting' ? 'btn-primary' : 'btn-secondary'}" data-filter="waiting" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                    In Lobby (${waitingLobby})
                                </button>
                                <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'scheduled' ? 'btn-primary' : 'btn-secondary'}" data-filter="scheduled" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                    Pending Check-in (${upcomingScheduled})
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'scheduled' ? 'btn-primary' : 'btn-secondary'}" data-filter="scheduled" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                    Scheduled (${upcomingScheduled + waitingLobby})
                                </button>
                            `}
                            <button type="button" class="btn btn-sm queue-filter-btn ${this.state.filter === 'completed' ? 'btn-primary' : 'btn-secondary'}" data-filter="completed" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                                Completed (${completedAppts})
                            </button>
                        </div>
                    </div>

                    <div id="lobby-list-container">
                        ${this.renderLobbyItemsHtml(periodAppts, isToday)}
                    </div>
                </div>

                <!-- Right Column: Front-Desk Fast Actions, Capacity Gauge & Doctors on Duty -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Front-Desk Fast Actions Card -->
                    <div class="card" style="padding: 1.25rem; border-top: 4px solid var(--primary); background: var(--surface);">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text);">Front-Desk Fast Actions</h4>
                        <p style="margin: 0 0 1rem 0; font-size: 0.82rem; color: var(--text-muted);">Quick shortcuts for patient intake and registration</p>

                        <div class="quick-actions" style="padding: 0; display: flex; flex-direction: column; gap: 0.55rem;">
                            <a href="#receptionist_patients" class="quick-action" style="padding: 0.75rem 0.85rem; font-size: 0.88rem; background: var(--primary-light); color: var(--primary-dark); border-color: rgba(16,124,65,0.3);">
                                <span class="quick-action-icon" style="width: 30px; height: 30px; background: var(--primary); color: white;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                </span>
                                <div>
                                    <strong style="display: block;">Register Walk-in Patient</strong>
                                    <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">Create new patient demographic profile</span>
                                </div>
                            </a>

                            <a href="#receptionist_appointments" class="quick-action" style="padding: 0.75rem 0.85rem; font-size: 0.88rem;">
                                <span class="quick-action-icon" style="width: 30px; height: 30px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </span>
                                <div>
                                    <strong style="display: block;">Book / Manage Appointments</strong>
                                    <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">Schedule visit &amp; check-in arriving patients</span>
                                </div>
                            </a>

                            <button type="button" class="quick-action" id="btn-print-blank-form" style="width: 100%; text-align: left; padding: 0.75rem 0.85rem; font-size: 0.88rem; cursor: pointer; border: 1px solid var(--border); background: var(--surface);">
                                <span class="quick-action-icon" style="width: 30px; height: 30px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                </span>
                                <div>
                                    <strong style="display: block;">Print Blank Intake Sheet</strong>
                                    <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">Print paper registration for walk-in hand-fill</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Daily Clinic Capacity Monitor Card -->
                    <div class="card" style="padding: 1.25rem; background: var(--surface);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h4 style="margin: 0; font-size: 0.95rem; color: var(--text);">Daily Clinic Capacity</h4>
                            <span style="font-size: 0.85rem; font-weight: 700; color: ${activeTodaySlots >= 10 ? '#dc2626' : (activeTodaySlots >= 8 ? '#b45309' : 'var(--primary)')};">
                                ${activeTodaySlots} / ${MAX_DAILY_CAPACITY} (${capacityPct}%)
                            </span>
                        </div>
                        
                        <div style="width: 100%; height: 8px; background: var(--bg-alt); border-radius: 4px; overflow: hidden; margin-bottom: 0.85rem;">
                            <div style="width: ${capacityPct}%; height: 100%; background: ${activeTodaySlots >= 10 ? '#ef4444' : (activeTodaySlots >= 8 ? '#f59e0b' : 'var(--primary)')}; transition: width 0.4s ease;"></div>
                        </div>

                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                            <span>Slots Booked: <strong>${activeTodaySlots}</strong></span>
                            <span>Remaining Slots: <strong>${remainingSlots}</strong></span>
                        </div>

                        <div style="padding: 0.75rem; background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-muted);">
                            <strong>Clinic Capacity Policy:</strong> Daily maximum limit of 10 appointments ensures high quality patient care. Capacity warnings trigger at 8 and 9 slots.
                        </div>
                    </div>

                    <!-- Doctors on Duty Today Widget -->
                    <div class="card" style="padding: 1.25rem; background: var(--surface);">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--text);">Doctors on Duty Today</h4>
                        <p style="margin: 0 0 0.75rem 0; font-size: 0.78rem; color: var(--text-muted);">Physicians with scheduled appointments today</p>

                        ${docsOnDuty.length === 0 ? `
                            <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
                                No appointments scheduled with any physician today.
                            </div>
                        ` : `
                            <div style="display: flex; flex-direction: column; gap: 0.55rem;">
                                ${docsOnDuty.map(d => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.65rem; background: var(--bg); border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.82rem;">
                                        <div>
                                            <strong style="color: var(--text); display: block;">${escapeHtml(d.name)}</strong>
                                            <span style="font-size: 0.75rem; color: var(--text-muted);">${d.total} patient${d.total === 1 ? '' : 's'} scheduled</span>
                                        </div>
                                        <div style="text-align: right;">
                                            ${d.waiting > 0 ? `
                                                <span class="badge" style="background:#ea580c; color:white; font-size:0.7rem; padding: 2px 6px;">
                                                    ${d.waiting} in lobby
                                                </span>
                                            ` : (d.completed > 0 ? `
                                                <span class="badge badge-success" style="font-size:0.7rem; padding: 2px 6px;">
                                                    ${d.completed} completed
                                                </span>
                                            ` : `
                                                <span class="badge badge-secondary" style="font-size:0.7rem; padding: 2px 6px;">
                                                    ${d.scheduled} pending
                                                </span>
                                            `)}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }
    },

    renderLobbyItemsHtml(apptsList, isToday) {
        let appts = [...apptsList];

        if (this.state.filter === 'waiting') {
            appts = appts.filter(a => a.status === 'confirmed');
        } else if (this.state.filter === 'scheduled') {
            appts = appts.filter(a => a.status === 'scheduled');
        } else if (this.state.filter === 'completed') {
            appts = appts.filter(a => a.status === 'completed');
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
        } else if (this.state.sortBy === 'doctor') {
            appts.sort((a, b) => {
                const dA = `${a.doctor_last || ''} ${a.doctor_first || ''}`.toLowerCase();
                const dB = `${b.doctor_last || ''} ${b.doctor_first || ''}`.toLowerCase();
                return this.state.sortOrder === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
            });
        } else if (this.state.sortBy === 'status') {
            appts.sort((a, b) => {
                const sA = (a.status || '').toLowerCase();
                const sB = (b.status || '').toLowerCase();
                return this.state.sortOrder === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
            });
        }

        const total = appts.length;
        const pageSize = this.state.pageSize || 10;
        const totalPages = Math.ceil(total / pageSize) || 1;
        if (this.state.page > totalPages) this.state.page = totalPages;
        if (this.state.page < 1) this.state.page = 1;
        const startIndex = (this.state.page - 1) * pageSize;
        const pagedAppts = appts.slice(startIndex, startIndex + pageSize);

        if (total === 0) {
            let msg = isToday
                ? 'No appointments scheduled for today.'
                : 'No appointments found for this time period.';

            if (this.state.filter === 'waiting') {
                msg = 'No patients are currently waiting in the clinic lobby.';
            } else if (this.state.filter === 'scheduled') {
                msg = 'No upcoming patients pending check-in.';
            } else if (this.state.filter === 'completed') {
                msg = 'No consultations completed yet in this period.';
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
        const sortDocClass = this.state.sortBy === 'doctor' ? (this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : '';
        const sortStatusClass = this.state.sortBy === 'status' ? (this.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : '';

        return `
            <div class="table-responsive">
                <table class="data-table" style="margin: 0;">
                    <thead>
                        <tr>
                            <th data-sort="time" class="${sortTimeClass}" style="width: ${isToday ? '88px' : '110px'};">${isToday ? 'Time' : 'Date &amp; Time'}</th>
                            <th data-sort="patient" class="${sortPatClass}" style="min-width: 105px; max-width: 135px;">Patient</th>
                            <th data-sort="doctor" class="${sortDocClass}" style="min-width: 105px; max-width: 130px;">Doctor</th>
                            <th style="width: 85px; white-space: nowrap;">Triage Vitals</th>
                            <th style="min-width: 110px; max-width: 150px;">Chief Complaint</th>
                            <th data-sort="status" class="${sortStatusClass}" style="width: 95px; text-align: center;">Status</th>
                            <th style="width: 88px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedAppts.map(a => {
                            const patientName = `${a.patient_last || ''}, ${a.patient_first || ''}`;
                            const docName = `Dr. ${a.doctor_first || 'Physician'} ${a.doctor_last || ''}`;
                            const timeStr = formatTime(a.appointment_time);
                            const dateStr = formatShortDate(a.appointment_date);
                            const reasonStr = a.chief_complaint ? a.chief_complaint.trim() : 'General Consultation';

                            let dateTimeCell = '';
                            if (isToday) {
                                dateTimeCell = `
                                    <div style="font-weight: 600; color: var(--text); font-size: 0.86rem;">${escapeHtml(timeStr)}</div>
                                    ${a.is_overdue ? `<span class="badge badge-status-overdue" style="font-size:0.65rem; padding: 1px 4px; display: inline-block; margin-top: 2px;">Overdue</span>` : ''}
                                `;
                            } else {
                                dateTimeCell = `
                                    <div style="font-weight: 600; color: var(--text); font-size: 0.84rem;">${escapeHtml(dateStr)}</div>
                                    <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(timeStr)}</div>
                                `;
                            }

                            // Vitals stacked chips matching doctor dashboard
                            let vitalsCell = '<span class="text-muted" style="font-size: 0.78rem;">--</span>';
                            if (a.blood_pressure || a.temperature || a.oxygen_saturation) {
                                const items = [];
                                if (a.blood_pressure) items.push(`<span class="vital-badge" style="font-size: 0.72rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">BP: ${escapeHtml(a.blood_pressure)}</span>`);
                                if (a.temperature) items.push(`<span class="vital-badge" style="font-size: 0.72rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">${escapeHtml(a.temperature)}&deg;C</span>`);
                                if (a.oxygen_saturation) items.push(`<span class="vital-badge" style="font-size: 0.72rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">${escapeHtml(a.oxygen_saturation)}%</span>`);
                                vitalsCell = `<div style="display: flex; flex-direction: column; gap: 2px;">${items.join('')}</div>`;
                            }

                            let statusBadge = '';
                            let actionButton = '';

                            if (a.status === 'confirmed') {
                                statusBadge = '<span class="badge badge-status-confirmed" style="font-size: 0.72rem; padding: 2px 6px;">In Lobby</span>';
                                actionButton = `
                                    <span class="text-muted" style="font-size: 0.75rem; display: block; text-align: center;">
                                        Waiting
                                    </span>
                                `;
                            } else if (a.status === 'scheduled') {
                                statusBadge = '<span class="badge badge-status-scheduled" style="font-size: 0.72rem; padding: 2px 6px;">Scheduled</span>';
                                actionButton = `
                                    <a href="#receptionist_appointments" class="btn btn-primary btn-sm" style="width: 100%; white-space: nowrap; font-size: 0.74rem; padding: 0.22rem 0.45rem; text-align: center; display: block;">
                                        Check-In
                                    </a>
                                `;
                            } else if (a.status === 'completed') {
                                statusBadge = '<span class="badge badge-status-completed" style="font-size: 0.72rem; padding: 2px 6px;">Completed</span>';
                                actionButton = `
                                    <span class="text-muted" style="font-size: 0.75rem; display: block; text-align: center;">
                                        Finished
                                    </span>
                                `;
                            } else if (a.status === 'cancelled') {
                                statusBadge = '<span class="badge badge-status-cancelled" style="font-size: 0.72rem; padding: 2px 6px;">Cancelled</span>';
                                actionButton = '<span class="text-muted" style="font-size: 0.75rem;">&mdash;</span>';
                            } else {
                                statusBadge = '<span class="badge badge-status-noshow" style="font-size: 0.72rem; padding: 2px 6px;">No Show</span>';
                                actionButton = '<span class="text-muted" style="font-size: 0.75rem;">&mdash;</span>';
                            }

                            return `
                                <tr style="${a.status === 'confirmed' ? 'background: rgba(16, 124, 65, 0.03);' : ''}">
                                    <td style="vertical-align: middle;">
                                        ${dateTimeCell}
                                    </td>
                                    <td style="vertical-align: middle; max-width: 135px;">
                                        <strong style="color: var(--text); font-size: 0.88rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(patientName)}">${escapeHtml(patientName)}</strong>
                                    </td>
                                    <td style="vertical-align: middle; font-size: 0.84rem; color: var(--text); max-width: 130px;">
                                        <span style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(docName)}">${escapeHtml(docName)}</span>
                                    </td>
                                    <td style="vertical-align: middle; white-space: nowrap;">
                                        ${vitalsCell}
                                    </td>
                                    <td style="vertical-align: middle; font-size: 0.82rem; color: var(--text-muted); max-width: 150px;">
                                        <span title="${escapeHtml(reasonStr)}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;">
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

            <div class="pagination-wrapper" style="padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-muted);">
                    <span>Rows per page:</span>
                    <select id="rec-page-size" class="form-control form-control-sm" style="width: auto; height: 28px; padding: 0.15rem 0.5rem; font-size: 0.8rem; cursor: pointer;">
                        <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    </select>
                    <span>Showing <strong>${total > 0 ? startIndex + 1 : 0}</strong> to <strong>${Math.min(startIndex + pageSize, total)}</strong> of <strong>${total}</strong> appointments</span>
                </div>
                <div class="pagination-controls" style="display: flex; align-items: center; gap: 0.35rem;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-rec-prev" ${this.state.page <= 1 ? 'disabled' : ''} style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">Previous</button>
                    <span style="font-size: 0.8rem; color: var(--text-muted); padding: 0 0.35rem;">Page <strong>${this.state.page}</strong> of <strong>${totalPages}</strong></span>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-rec-next" ${this.state.page >= totalPages ? 'disabled' : ''} style="padding: 0.25rem 0.65rem; font-size: 0.78rem;">Next</button>
                </div>
            </div>
        `;
    },

    async refreshDashboard() {
        const btn = this.container.querySelector('#btn-refresh-dashboard');
        const svg = btn?.querySelector('svg');
        if (btn) btn.disabled = true;
        if (svg) svg.style.animation = 'spin 0.8s linear infinite';
        try {
            await this.loadData();
            showToast('Refreshed lobby status and clinic data.', 'info');
        } finally {
            const newBtn = this.container.querySelector('#btn-refresh-dashboard');
            const newSvg = newBtn?.querySelector('svg');
            if (newBtn) newBtn.disabled = false;
            if (newSvg) newSvg.style.animation = '';
        }
    },

    attachEventListeners() {
        if (this._eventsAttached) return;
        this._eventsAttached = true;
        const c = this.container;

        // Delegated click handler on container
        c.addEventListener('click', async (e) => {
            // Refresh button
            const refreshBtn = e.target.closest('#btn-refresh-dashboard');
            if (refreshBtn) {
                e.preventDefault();
                await this.refreshDashboard();
                return;
            }

            // Blank registration form print button
            const printBtn = e.target.closest('#btn-print-blank-form');
            if (printBtn) {
                e.preventDefault();
                printBlankForm();
                return;
            }

            // Time horizon period switcher (Today | This Week | All-Time)
            const periodBtn = e.target.closest('.btn-period-tab');
            if (periodBtn) {
                const targetPeriod = periodBtn.getAttribute('data-period');
                if (targetPeriod && (targetPeriod !== this.state.activePeriod || targetPeriod === 'all')) {
                    this.state.activePeriod = targetPeriod;
                    if (targetPeriod === 'all') {
                        this.state.startDate = '';
                        this.state.endDate = '';
                    }
                    this.state.filter = 'all'; // reset sub-filter
                    this.state.page = 1; // reset pagination
                    this.renderDashboard();
                }
                return;
            }

            // Custom Date Range Picker Apply Button
            if (e.target && e.target.id === 'btn-rec-apply-range') {
                const startInput = c.querySelector('#rec-range-start');
                const endInput = c.querySelector('#rec-range-end');
                const startVal = startInput ? startInput.value.trim() : '';
                const endVal = endInput ? endInput.value.trim() : '';
                if (!startVal && !endVal) {
                    showToast('Please select at least a start or end date.', 'warning');
                    return;
                }
                this.state.activePeriod = 'range';
                this.state.startDate = startVal;
                this.state.endDate = endVal;
                this.state.filter = 'all';
                this.state.page = 1;
                this.renderDashboard();
                return;
            }
        });

        // Rows per Page selector
        c.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'rec-page-size') {
                this.state.pageSize = parseInt(e.target.value, 10) || 10;
                this.state.page = 1;
                const now = new Date();
                const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                const lobbyContainer = c.querySelector('#lobby-list-container');
                if (lobbyContainer) {
                    lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
                }
            }
        });

        // Pagination Previous / Next buttons
        c.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'btn-rec-prev') {
                if (this.state.page > 1) {
                    this.state.page--;
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                    const lobbyContainer = c.querySelector('#lobby-list-container');
                    if (lobbyContainer) {
                        lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            } else if (e.target && e.target.id === 'btn-rec-next') {
                this.state.page++;
                const now = new Date();
                const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                const lobbyContainer = c.querySelector('#lobby-list-container');
                if (lobbyContainer) {
                    lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
                }
            }
        });

        // Real-time live update sync listener
        if (!this._syncBound) {
            this._syncBound = true;
            document.addEventListener('cprms:sync', () => {
                if (this.container && this.container.isConnected) {
                    this.loadData();
                }
            });
        }

        // Filter pills in lobby table header
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.queue-filter-btn');
            if (btn) {
                const targetFilter = btn.getAttribute('data-filter');
                if (targetFilter) {
                    this.state.filter = targetFilter;
                    this.state.page = 1;
                    // Update active button styling
                    c.querySelectorAll('.queue-filter-btn').forEach(b => {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                    });
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');

                    // Re-render lobby table
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                    const lobbyContainer = c.querySelector('#lobby-list-container');
                    if (lobbyContainer) {
                        lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
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
                    this.state.page = 1;
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
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                    const lobbyContainer = c.querySelector('#lobby-list-container');
                    if (lobbyContainer) {
                        lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            }
        });

        // Lobby table header sorting
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
                    this.state.page = 1;
                    const now = new Date();
                    const periodAppts = getAppointmentsForPeriod(this.state.allAppointments, this.state.activePeriod, now, this.state.startDate, this.state.endDate);
                    const lobbyContainer = c.querySelector('#lobby-list-container');
                    if (lobbyContainer) {
                        lobbyContainer.innerHTML = this.renderLobbyItemsHtml(periodAppts, this.state.activePeriod === 'today');
                    }
                }
            }
        });
    }
};
