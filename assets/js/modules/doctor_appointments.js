// assets/js/modules/doctor_appointments.js
// Read-only view of appointments for the logged-in doctor with bounded pagination and status gating
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (Create -> Configure -> Listen -> Append row pattern) & 03 APIs and Database Operations/javascript_working_with_apis (Async/await response validation)

import api from '../api.js?v=8';
import { create, escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=24';
import { confirmDialog } from '../components/confirm-dialog.js?v=1';

export default {
    state: {
        appointments: [],
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 1
    },

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.attachEventListeners();
        await this.loadData();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">My Appointments</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">View scheduled appointments and start consultations.</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                            <select id="doctor-page-size" class="form-control" style="width: auto; padding: 0.35rem 0.65rem;">
                                <option value="5">5</option>
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" id="btn-refresh-appointments">
                            Refresh
                        </button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table" id="appointments-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Patient Name</th>
                                <th>Chief Complaint</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="appointments-tbody">
                            <tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Loading appointments...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination-wrapper" id="doctor-appointments-pagination"></div>
            </div>
        `;
    },

    attachEventListeners() {
        const refreshBtn = this.container.querySelector('#btn-refresh-appointments');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData();
            });
        }

        const pageSizeSelect = this.container.querySelector('#doctor-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.state.pageSize = parseInt(e.target.value, 10);
                this.state.page = 1;
                this.loadData();
            });
        }
    },

    async loadData() {
        const tbody = this.container.querySelector('#appointments-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Loading appointments...</td></tr>';

        try {
            const params = {
                page: this.state.page,
                page_size: this.state.pageSize,
                sort: 'upcoming'
            };

            const res = await api.get('api/appointment_controller.php', params);
            if (res.success) {
                this.state.appointments = (res.data && res.data.items) ? res.data.items : [];
                this.state.total = res.data.total ?? this.state.appointments.length;
                this.state.page = res.data.page ?? 1;
                this.state.pageSize = res.data.page_size ?? 10;
                this.state.pages = res.data.pages ?? 1;
                this.renderTable();
                this.renderPagination(res.data);
            } else {
                showToast(res.message || 'Failed to load appointments.', 'error');
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(res.message || 'Error loading data.')}</td></tr>`;
                this.renderPagination({ total: 0, page: 1, page_size: this.state.pageSize, pages: 1 });
            }
        } catch (err) {
            console.error('Error fetching appointments', err);
            const msg = err.response?.data?.message || err.message || 'Failed to load appointments.';
            showToast(msg, 'error');
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(msg)}</td></tr>`;
            this.renderPagination({ total: 0, page: 1, page_size: this.state.pageSize, pages: 1 });
        }
    },

    renderTable() {
        const tbody = this.container.querySelector('#appointments-tbody');
        tbody.innerHTML = '';

        if (!this.state.appointments || this.state.appointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>No appointments scheduled.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const frag = document.createDocumentFragment();

        this.state.appointments.forEach(appt => {
            const tr = create('tr');

            // Format date/time
            const d = new Date(appt.appointment_date + 'T' + appt.appointment_time);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            const statusColor = this.getStatusColor(appt.status);

            let actionContent = '';
            if (appt.status === 'confirmed') {
                actionContent = `
                    <button class="btn btn-primary btn-sm btn-start-consult" data-id="${appt.appointment_id}" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Start Consult
                    </button>
                `;
            } else if (appt.status === 'scheduled') {
                actionContent = `
                    <span class="badge" style="background-color: #fef3c7; color: #92400e; font-size: 0.8rem; font-weight: 500;">Awaiting Confirmation</span>
                `;
            } else if (appt.status === 'completed') {
                actionContent = `
                    <button class="btn btn-outline-secondary btn-sm btn-start-consult" data-id="${appt.appointment_id}" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> View Encounter
                    </button>
                `;
            } else {
                actionContent = `<span class="text-muted" style="font-size: 0.85rem;">N/A</span>`;
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500;">${escapeHtml(dateStr)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${escapeHtml(timeStr)}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</div>
                </td>
                <td>
                    <span style="display: block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(appt.chief_complaint || 'None')}">
                        ${escapeHtml(appt.chief_complaint || 'None')}
                    </span>
                </td>
                <td>
                    <span class="badge" style="background-color: ${statusColor.bg}; color: ${statusColor.text};">
                        ${escapeHtml((appt.status || '').toUpperCase())}
                    </span>
                </td>
                <td class="actions-cell">
                    ${actionContent}
                    ${(appt.status === 'scheduled' || appt.status === 'confirmed') ? `
                    <button class="btn btn-danger btn-sm btn-icon btn-cancel-appointment" data-id="${appt.appointment_id}" title="Cancel Appointment" aria-label="Cancel appointment">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>` : ''}
                </td>
            `;

            const consultBtn = tr.querySelector('.btn-start-consult');
            if (consultBtn) {
                consultBtn.addEventListener('click', () => {
                    window.navigateTo(`doctor_consultation/${appt.appointment_id}`);
                });
            }

            const cancelBtn = tr.querySelector('.btn-cancel-appointment');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.cancelAppointment(appt.appointment_id, `${appt.patient_first} ${appt.patient_last}`);
                });
            }

            frag.appendChild(tr);
        });

        tbody.appendChild(frag);
    },

    cancelAppointment(appointmentId, patientName) {
        confirmDialog({
            title: 'Cancel Appointment',
            message: `Cancel the appointment for "${patientName || 'this patient'}"? The time slot becomes available for rebooking.`,
            btnText: 'Cancel Appointment',
            btnClass: 'btn btn-danger',
            cancelText: 'Keep Appointment',
            onConfirm: async () => {
                try {
                    const res = await api.put(`api/appointment_controller.php?action=cancel&id=${appointmentId}`);
                    showToast(res.message, 'warning');
                    await this.loadData();
                } catch (err) {
                    showToast(err.response?.data?.message || err.message || 'Failed to cancel the appointment.', 'error');
                }
            }
        });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#doctor-appointments-pagination');
        if (!pagContainer) return;
        const total = data.total ?? this.state.total;
        const page = data.page ?? this.state.page;
        const pageSize = data.page_size ?? this.state.pageSize;
        const pages = data.pages ?? this.state.pages;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> appointments</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="doctor-appointments-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="doctor-appointments-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#doctor-appointments-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#doctor-appointments-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    getStatusColor(status) {
        switch (status) {
            case 'scheduled': return { bg: '#eef2ff', text: '#4f46e5' }; // Indigo
            case 'confirmed': return { bg: '#dcfce7', text: '#16a34a' }; // Green
            case 'completed': return { bg: '#f1f5f9', text: '#475569' }; // Slate
            case 'cancelled': return { bg: '#fee2e2', text: '#ef4444' }; // Red
            case 'no_show':   return { bg: '#ffedd5', text: '#ea580c' }; // Orange
            default:          return { bg: '#f3f4f6', text: '#374151' }; // Gray
        }
    }
};
