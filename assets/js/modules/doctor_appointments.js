// assets/js/modules/doctor_appointments.js
// Read-only view of appointments for the logged-in doctor with bounded pagination and status gating
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (Create -> Configure -> Listen -> Append row pattern) & 03 APIs and Database Operations/javascript_working_with_apis (Async/await response validation)

import api from '../api.js?v=8';
import { create, escapeHtml, showToast, openModal, closeModal, formatStatusLabel } from '../ui.js?v=26';
import { confirmDialog } from '../components/confirm-dialog.js?v=1';

export default {
    state: {
        appointments: [],
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 1,
        search: '',
        status: '',
        dateFilter: 'upcoming',
        sortBy: 'appointment_date',
        sortOrder: 'DESC',
        targetCancelAppointmentId: null
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
                </div>

                <div class="toolbar" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; flex: 1;">
                        <div class="search-input-wrapper" style="min-width: 240px;">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="doctor-search" class="form-control" placeholder="Search patient or chief complaint...">
                        </div>
                        <select id="doctor-status-filter" class="form-control" style="width: auto;">
                            <option value="">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No Show</option>
                        </select>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">View:</span>
                            <select id="doctor-date-filter" class="form-control" style="width: auto;">
                                <option value="upcoming" selected>Upcoming</option>
                                <option value="today">Today</option>
                                <option value="past">Past</option>
                                <option value="">All</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                            <select id="doctor-page-size" class="form-control table-page-size">
                                <option value="5">5</option>
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" id="btn-refresh-appointments" title="Refresh Appointments">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.25rem;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            Refresh
                        </button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table" id="appointments-table">
                        <thead>
                            <tr>
                                <th data-sort="appointment_date">Date &amp; Time</th>
                                <th data-sort="patient_name">Patient Name</th>
                                <th>Triage Vitals</th>
                                <th data-sort="chief_complaint">Chief Complaint</th>
                                <th data-sort="status">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="appointments-tbody">
                            <tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Loading appointments...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination-wrapper" id="doctor-appointments-pagination"></div>
            </div>

            <div class="modal" id="doctor-cancel-request-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="doc-cancel-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="doc-cancel-title">Request Appointment Cancellation</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-top: 0; font-size: 0.875rem; color: var(--text-muted);">
                                Front desk receptionists manage patient rescheduling and cancellations. Please submit a reason for this cancellation request.
                            </p>
                            <div class="form-group">
                                <label for="doc-cancel-reason" style="font-weight: 500;">Clinical Reason for Cancellation *</label>
                                <textarea id="doc-cancel-reason" class="form-control" rows="3" placeholder="e.g. Physician emergency call, Patient referred to specialist, etc."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="btn-submit-cancel-request">Submit Request</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        const refreshBtn = this.container.querySelector('#btn-refresh-appointments');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const svg = refreshBtn.querySelector('svg');
                refreshBtn.disabled = true;
                if (svg) svg.style.animation = 'spin 0.8s linear infinite';
                try {
                    await this.loadData();
                    showToast('Refreshed appointments.', 'info');
                } finally {
                    refreshBtn.disabled = false;
                    if (svg) svg.style.animation = '';
                }
            });
        }

        // Real-time live update sync listener
        if (!this._syncBound) {
            this._syncBound = true;
            document.addEventListener('cprms:sync', () => {
                if (this.container && this.container.isConnected) {
                    this.loadData();
                }
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

        let timer = null;
        const searchInput = this.container.querySelector('#doctor-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.state.search = searchInput.value.trim();
                    this.state.page = 1;
                    this.loadData();
                }, 300);
            });
        }

        const dateFilter = this.container.querySelector('#doctor-date-filter');
        if (dateFilter) {
            dateFilter.value = this.state.dateFilter || 'upcoming';
            dateFilter.addEventListener('change', (e) => {
                this.state.dateFilter = e.target.value;
                this.state.page = 1;
                this.loadData();
            });
        }

        const statusFilter = this.container.querySelector('#doctor-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.state.status = e.target.value;
                this.state.page = 1;
                this.loadData();
            });
        }

        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.getAttribute('data-sort');
                if (this.state.sortBy === sortField) {
                    this.state.sortOrder = this.state.sortOrder === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    this.state.sortBy = sortField;
                    this.state.sortOrder = 'ASC';
                }
                this.state.page = 1;
                this.loadData();
            });
        });

        const btnSubmitCancel = this.container.querySelector('#btn-submit-cancel-request');
        if (btnSubmitCancel) {
            btnSubmitCancel.addEventListener('click', async () => {
                const reasonInput = this.container.querySelector('#doc-cancel-reason');
                const reason = reasonInput ? reasonInput.value.trim() : '';

                if (!reason || reason.length < 5) {
                    showToast('Please provide a reason with at least 5 characters.', 'warning');
                    return;
                }

                if (!this.state.targetCancelAppointmentId) {
                    showToast('No appointment selected.', 'error');
                    return;
                }

                btnSubmitCancel.disabled = true;
                btnSubmitCancel.textContent = 'Submitting...';

                try {
                    const res = await api.post('api/appointment_controller.php?action=request_cancel', {
                        appointment_id: this.state.targetCancelAppointmentId,
                        reason: reason
                    });

                    if (res.success) {
                        showToast('Cancellation request submitted to Reception.', 'success');
                        closeModal('doctor-cancel-request-modal');
                        if (reasonInput) reasonInput.value = '';
                        this.state.targetCancelAppointmentId = null;
                        await this.loadData();
                    } else {
                        showToast(res.message || 'Failed to submit cancellation request.', 'error');
                    }
                } catch (err) {
                    console.error('Error requesting cancellation', err);
                    showToast(err.response?.data?.message || err.message || 'Failed to submit cancellation request.', 'error');
                } finally {
                    btnSubmitCancel.disabled = false;
                    btnSubmitCancel.textContent = 'Submit Request';
                }
            });
        }
    },

    updateSortHeaders() {
        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.getAttribute('data-sort') === this.state.sortBy) {
                th.classList.add(this.state.sortOrder === 'ASC' ? 'sort-asc' : 'sort-desc');
            }
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#appointments-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Loading appointments...</td></tr>';

        try {
            const params = {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                date_filter: this.state.dateFilter,
                sort_by: this.state.sortBy,
                sort_order: this.state.sortOrder
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
                this.updateSortHeaders();
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
                    <td colspan="6" class="text-center text-muted py-4">
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

            const badgeClass = this.getStatusBadgeClass(appt.status);

            let actionContent = '';
            if (appt.status === 'confirmed') {
                actionContent = `
                    <button class="btn btn-primary btn-sm btn-icon btn-start-consult" data-id="${appt.appointment_id}" title="Start Patient Consultation" aria-label="Start Patient Consultation">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                `;
            } else if (appt.status === 'scheduled') {
                actionContent = `
                    <span class="badge badge-status-scheduled" style="font-size: 0.72rem;">Check-in Pending</span>
                `;
            } else if (appt.status === 'completed') {
                actionContent = `
                    <button class="btn btn-outline-secondary btn-sm btn-icon btn-start-consult" data-id="${appt.appointment_id}" title="View Completed Encounter" aria-label="View Completed Encounter">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                `;
            } else {
                actionContent = `<span class="text-muted" style="font-size: 0.85rem;">N/A</span>`;
            }

            // Triage vitals cell
            let vitalsHtml = '<span class="text-muted" style="font-size: 0.8rem;">--</span>';
            if (appt.blood_pressure || appt.temperature || appt.oxygen_saturation) {
                const items = [];
                if (appt.blood_pressure) items.push(`<span class="vital-badge" style="font-size: 0.74rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">BP: ${escapeHtml(appt.blood_pressure)}</span>`);
                if (appt.temperature) items.push(`<span class="vital-badge" style="font-size: 0.74rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">${escapeHtml(appt.temperature)}&deg;C</span>`);
                if (appt.oxygen_saturation) items.push(`<span class="vital-badge" style="font-size: 0.74rem; background: var(--bg-alt); padding: 1px 5px; border-radius: var(--radius-sm); border: 1px solid var(--border);">${escapeHtml(appt.oxygen_saturation)}%</span>`);
                vitalsHtml = `<div style="display: flex; flex-direction: column; gap: 3px;">${items.join('')}</div>`;
            }

            const complaint = (appt.chief_complaint || '').trim();
            let complaintHtml = '<span class="text-muted">None</span>';
            if (complaint) {
                if (complaint.length > 45) {
                    const shortText = complaint.slice(0, 45);
                    complaintHtml = `
                        <div class="chief-complaint-wrapper" style="max-width: 240px; font-size: 0.875rem;">
                            <span class="cc-short">${escapeHtml(shortText)}...</span>
                            <span class="cc-full" style="display: none; white-space: normal; word-break: break-word;">${escapeHtml(complaint)}</span>
                            <button type="button" class="btn btn-link btn-sm cc-toggle" style="padding: 0 0.25rem; font-size: 0.75rem; text-decoration: underline; vertical-align: baseline;">More</button>
                        </div>
                    `;
                } else {
                    complaintHtml = `<span style="font-size: 0.875rem;">${escapeHtml(complaint)}</span>`;
                }
            }

            tr.innerHTML = `
                <td style="vertical-align: middle;">
                    <div style="font-weight: 500;">${escapeHtml(dateStr)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${escapeHtml(timeStr)}</div>
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: 500;">${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</div>
                </td>
                <td style="vertical-align: middle; white-space: nowrap;">
                    ${vitalsHtml}
                </td>
                <td style="vertical-align: middle;">
                    ${complaintHtml}
                </td>
                <td style="vertical-align: middle;">
                    <span class="badge ${badgeClass}">
                        ${escapeHtml(formatStatusLabel(appt.status))}
                    </span>
                    ${appt.cancel_requested ? `
                    <div style="margin-top: 0.3rem;">
                        <span class="badge badge-status-critical" style="font-size: 0.72rem; font-weight: 600;" title="${escapeHtml(appt.cancel_request_reason || 'Cancellation requested')}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Cancel Requested
                        </span>
                    </div>` : ''}
                </td>
                <td style="text-align: right; vertical-align: middle;">
                    <div class="actions-cell" style="display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center;">
                        ${actionContent}
                        ${(appt.status === 'scheduled' || appt.status === 'confirmed') ? (
                            appt.cancel_requested ? `
                            <span class="text-muted" style="font-size: 0.8rem; font-style: italic;">Request Pending</span>
                            ` : `
                            <button class="btn btn-outline-danger btn-sm btn-icon btn-request-cancel" data-id="${appt.appointment_id}" title="Request Appointment Cancellation" aria-label="Request Appointment Cancellation" style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border-radius: var(--radius-sm); flex-shrink: 0;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                            `
                        ) : ''}
                    </div>
                </td>
            `;

            const ccToggleBtn = tr.querySelector('.cc-toggle');
            if (ccToggleBtn) {
                ccToggleBtn.addEventListener('click', () => {
                    const wrapper = ccToggleBtn.closest('.chief-complaint-wrapper');
                    const shortSpan = wrapper.querySelector('.cc-short');
                    const fullSpan = wrapper.querySelector('.cc-full');
                    const isExpanded = fullSpan.style.display !== 'none';
                    if (isExpanded) {
                        fullSpan.style.display = 'none';
                        shortSpan.style.display = '';
                        ccToggleBtn.textContent = 'More';
                    } else {
                        fullSpan.style.display = '';
                        shortSpan.style.display = 'none';
                        ccToggleBtn.textContent = 'Less';
                    }
                });
            }

            const consultBtn = tr.querySelector('.btn-start-consult');
            if (consultBtn) {
                consultBtn.addEventListener('click', () => {
                    window.navigateTo(`doctor_consultation/${appt.appointment_id}`);
                });
            }

            const requestCancelBtn = tr.querySelector('.btn-request-cancel');
            if (requestCancelBtn) {
                requestCancelBtn.addEventListener('click', () => {
                    this.state.targetCancelAppointmentId = appt.appointment_id;
                    const reasonInput = this.container.querySelector('#doc-cancel-reason');
                    if (reasonInput) reasonInput.value = '';
                    openModal('doctor-cancel-request-modal');
                });
            }

            frag.appendChild(tr);
        });

        tbody.appendChild(frag);
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

    getStatusBadgeClass(status) {
        switch (status) {
            case 'scheduled': return 'badge-status-scheduled';
            case 'confirmed': return 'badge-status-confirmed';
            case 'completed': return 'badge-status-completed';
            case 'cancelled': return 'badge-status-cancelled';
            case 'no_show':   return 'badge-status-noshow';
            default:          return 'badge-status-secondary';
        }
    }
};
