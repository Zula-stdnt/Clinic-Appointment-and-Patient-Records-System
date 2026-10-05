// assets/js/modules/doctor_appointments.js
// Read-only view of appointments for the logged-in doctor
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (Create -> Configure -> Listen -> Append row pattern) & 03 APIs and Database Operations/javascript_working_with_apis (Async/await response validation)

import api from '../api.js?v=7';
import { create, escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=24';
import { confirmDialog } from '../components/confirm-dialog.js?v=1';

export default {
    state: {
        appointments: []
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
                    <button class="btn btn-secondary" id="btn-refresh-appointments">
                        Refresh
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table" id="appointments-table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Patient Name</th>
                                <th>Chief Complaint</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="appointments-tbody">
                            <tr><td colspan="5" class="text-center">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
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
    },

    async loadData() {
        const tbody = this.container.querySelector('#appointments-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading appointments...</td></tr>';

        try {
            const res = await api.get('api/appointment_controller.php');
            if (res.success) {
                // res.data is an object (due to PHP's (object) cast).
                // The array lives at res.data.items.
                this.state.appointments = (res.data && res.data.items) ? res.data.items : [];
                this.renderTable();
            } else {
                showToast(res.message || 'Failed to load appointments.', 'error');
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data.</td></tr>';
            }
        } catch (err) {
            console.error('Error fetching appointments', err);
            const msg = err.response?.data?.message || 'Failed to load appointments.';
            showToast(msg, 'error');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data.</td></tr>';
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
            // 1. Create row element (dom_create_and_remove_elements.md)
            const tr = create('tr');

            // Format date/time
            const d = new Date(appt.appointment_date + 'T' + appt.appointment_time);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            const statusColor = this.getStatusColor(appt.status);

            // 2. Configure inner HTML using template literals
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500;">${dateStr}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${timeStr}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">ID: PAT-${appt.patient_id.toString().padStart(4, '0')}</div>
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
                    <button class="btn btn-primary btn-sm btn-start-consult" data-id="${appt.appointment_id}" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        ${appt.status === 'completed' 
                            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> View Encounter` 
                            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Start Consult`
                        }
                    </button>
                    ${(appt.status === 'scheduled' || appt.status === 'confirmed') ? `
                    <button class="btn btn-danger btn-sm btn-cancel-appointment" data-id="${appt.appointment_id}" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Cancel
                    </button>` : ''}
                </td>
            `;

            // 3. Listen: attach event listener to dynamic button inside row before appending
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

            // 4. Append
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
