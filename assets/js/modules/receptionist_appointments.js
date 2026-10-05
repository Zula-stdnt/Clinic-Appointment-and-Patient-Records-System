// assets/js/modules/receptionist_appointments.js
// Front-desk booking: create patient appointments with optional triage vital signs
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms (appointment header + vital signs detail saved together) & 02 DOM and UI/dom_create_and_remove_elements (Create -> Configure -> Listen -> Append rows)

import api from '../api.js?v=7';
import { create, escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=24';
import { SearchSelect } from '../components/search-select.js?v=1';
import { PatientRegisterForm } from '../components/patient-register.js?v=1';
import { printAppointmentForm } from '../components/print-appointment-form.js?v=2';

export default {
    state: {
        appointments: [],
        search: '',
        status: ''
    },

    async init(container) {
        this.container = container;

        // Dispose pickers from a previous visit; their option menus live in <body>
        if (this.patientPicker) this.patientPicker.destroy();
        if (this.doctorPicker) this.doctorPicker.destroy();

        this.renderStructure();
        this.setupPickers();
        this.setupRegisterForm();
        this.attachEventListeners();
        await this.loadData();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Appointments</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Book patient visits and record triage vital signs at the front desk.</p>
                    </div>
                    <button id="btn-new-appointment" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Appointment
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="appointments-search" class="form-control" placeholder="Search patient, doctor, complaint...">
                        </div>

                        <select id="appointments-status-filter" class="form-control" style="width: auto; min-width: 160px;">
                            <option value="">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No Show</option>
                        </select>
                    </div>

                    <button class="btn btn-secondary" id="btn-refresh-appointments">Refresh</button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Patient</th>
                                <th>Doctor</th>
                                <th>Chief Complaint</th>
                                <th>Triage Vitals</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="appointments-tbody">
                            <tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading appointments...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="modal" id="appointment-form-modal" tabindex="-1" aria-labelledby="appointment-form-title" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <form id="appointment-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="appointment-form-title">New Patient Appointment</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                        <div class="modal-body">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem;">
                                        <label for="appt-patient-input" style="margin-bottom: 0;">Patient <span class="required-star">*</span></label>
                                        <button type="button" class="btn btn-secondary btn-sm" id="btn-register-patient">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            Register Patient
                                        </button>
                                    </div>
                                    <div id="appt-patient-picker"></div>
                                    <div class="invalid-feedback" id="appt-patient-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="appt-doctor-input">Doctor <span class="required-star">*</span></label>
                                    <div id="appt-doctor-picker"></div>
                                    <div class="invalid-feedback" id="appt-doctor-error"></div>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="appt-date">Appointment Date <span class="required-star">*</span></label>
                                    <input type="date" id="appt-date" class="form-control">
                                    <div class="invalid-feedback" id="appt-date-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="appt-time">Appointment Time <span class="required-star">*</span></label>
                                    <input type="time" id="appt-time" class="form-control">
                                    <div class="invalid-feedback" id="appt-time-error"></div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="appt-complaint">Chief Complaint</label>
                                <textarea id="appt-complaint" class="form-control" rows="2" placeholder="Reason for the visit (e.g. persistent cough and fever)"></textarea>
                            </div>

                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="display: block; margin-bottom: 0.5rem;">Triage Vital Signs <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <label for="appt-bp" style="font-size: 0.85rem;">Blood Pressure</label>
                                        <input type="text" id="appt-bp" class="form-control" maxlength="20" placeholder="e.g. 120/80">
                                        <div class="invalid-feedback" id="appt-bp-error"></div>
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <label for="appt-temp" style="font-size: 0.85rem;">Temperature (&deg;C)</label>
                                        <input type="number" id="appt-temp" class="form-control" step="0.1" min="30" max="45" placeholder="e.g. 36.8">
                                        <div class="invalid-feedback" id="appt-temp-error"></div>
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <label for="appt-o2" style="font-size: 0.85rem;">Oxygen Saturation (%)</label>
                                        <input type="number" id="appt-o2" class="form-control" step="1" min="0" max="100" placeholder="e.g. 98">
                                        <div class="invalid-feedback" id="appt-o2-error"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-appointment" class="btn btn-primary">Schedule Appointment</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div class="modal" id="print-prompt-modal" tabindex="-1" aria-labelledby="print-prompt-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="print-prompt-title">Appointment Scheduled</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 0.5rem;">Appointment scheduled successfully.</p>
                            <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 0;">
                                Print the combined Patient Registration &amp; Appointment Form for
                                <strong id="print-prompt-patient">this patient</strong>?
                            </p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Not Now</button>
                            <button type="button" class="btn btn-primary" id="btn-print-appointment-now">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print Form
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setupPickers() {
        // Type-ahead lookups: only the first 50 matches are fetched per keystroke,
        // so neither the patient nor the doctor list has to be scrolled.
        this.patientPicker = new SearchSelect({
            inputId: 'appt-patient-input',
            placeholder: 'Type a patient name or contact no...',
            emptyText: 'No matching patients. Use "Register Patient" if they are new.',
            remote: async (query) => {
                const res = await api.get('api/appointment_controller.php', { meta: 'patients', search: query });
                const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
                return items.map(p => ({
                    value: p.patient_id,
                    label: this.formatPatientName(p),
                    meta: `PAT-${String(p.patient_id).padStart(4, '0')}`
                }));
            }
        }).mount(this.container.querySelector('#appt-patient-picker'));

        this.doctorPicker = new SearchSelect({
            inputId: 'appt-doctor-input',
            placeholder: 'Type a doctor name or specialty...',
            emptyText: 'No matching doctors found.',
            remote: async (query) => {
                const res = await api.get('api/appointment_controller.php', { meta: 'doctors', search: query });
                const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
                return items.map(d => ({
                    value: d.doctor_id,
                    label: `Dr. ${this.formatPatientName(d)}`,
                    meta: d.specialty_names || 'General practice'
                }));
            }
        }).mount(this.container.querySelector('#appt-doctor-picker'));
    },

    setupRegisterForm() {
        this.registerForm = new PatientRegisterForm({
            container: this.container,
            modalId: 'register-patient-modal',
            successMessage: 'Patient registered and selected for this appointment.',
            onRegistered: (patient) => {
                const label = this.formatPatientName(patient);
                this.patientPicker.reload();
                this.patientPicker.setValue(patient.patient_id, label);
                this.patientPicker.setInvalid(false);
                this.container.querySelector('#appt-patient-error').textContent = '';
            }
        });
    },

    formatPatientName(person) {
        const mi = person.middle_initial ? ` ${person.middle_initial}.` : '';
        return `${person.last_name}, ${person.first_name}${mi}`;
    },

    attachEventListeners() {
        const searchInput = this.container.querySelector('#appointments-search');
        searchInput.addEventListener('input', (e) => {
            this.state.search = e.target.value.trim().toLowerCase();
            this.renderTable();
        });

        this.container.querySelector('#appointments-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.renderTable();
        });

        this.container.querySelector('#btn-new-appointment').addEventListener('click', () => {
            this.openBookModal();
        });

        this.container.querySelector('#btn-refresh-appointments').addEventListener('click', () => {
            this.loadData();
        });

        this.container.querySelector('#appointment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAppointment();
        });

        this.container.querySelector('#btn-register-patient').addEventListener('click', () => {
            this.registerForm.open();
        });

        this.container.querySelector('#appointments-tbody').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-print-appointment');
            if (btn) {
                printAppointmentForm(btn.getAttribute('data-id'));
            }
        });

        this.container.querySelector('#btn-print-appointment-now').addEventListener('click', () => {
            closeModal('print-prompt-modal');
            if (this.pendingPrintId) {
                printAppointmentForm(this.pendingPrintId);
            }
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#appointments-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading appointments...</td></tr>';

        try {
            const res = await api.get('api/appointment_controller.php');
            if (res.success) {
                this.state.appointments = (res.data && res.data.items) ? res.data.items : [];
                this.renderTable();
            } else {
                throw new Error(res.message || 'Failed to load appointments.');
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(err.response?.data?.message || err.message || 'Failed to load appointments.')}</td></tr>`;
        }
    },

    getFilteredAppointments() {
        return this.state.appointments.filter(appt => {
            const statusOk = !this.state.status || appt.status === this.state.status;
            if (!statusOk) return false;

            if (!this.state.search) return true;

            const haystack = [
                appt.patient_first,
                appt.patient_last,
                appt.doctor_first,
                appt.doctor_last,
                appt.chief_complaint,
                appt.status
            ].filter(Boolean).join(' ').toLowerCase();

            return haystack.includes(this.state.search);
        });
    },

    renderTable() {
        const tbody = this.container.querySelector('#appointments-tbody');
        const items = this.getFilteredAppointments();
        tbody.innerHTML = '';

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <strong>No appointments found</strong>
                            <p>Book a new appointment or adjust your search and filters.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const frag = document.createDocumentFragment();

        items.forEach(appt => {
            const tr = create('tr');

            const d = new Date(appt.appointment_date + 'T' + appt.appointment_time);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            const statusColor = this.getStatusColor(appt.status);
            const vitals = this.formatVitals(appt);

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500;">${escapeHtml(dateStr)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${escapeHtml(timeStr)}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(appt.patient_last + ', ' + appt.patient_first)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">ID: PAT-${String(appt.patient_id).padStart(4, '0')}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">Dr. ${escapeHtml(appt.doctor_last + ', ' + appt.doctor_first)}</div>
                </td>
                <td>
                    <span style="display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(appt.chief_complaint || 'None')}">
                        ${escapeHtml(appt.chief_complaint || 'None')}
                    </span>
                </td>
                <td style="font-size: 0.85rem;">${vitals}</td>
                <td>
                    <span class="badge" style="background-color: ${statusColor.bg}; color: ${statusColor.text};">
                        ${escapeHtml((appt.status || '').toUpperCase())}
                    </span>
                </td>
                <td style="text-align: right;">
                    <button type="button" class="btn btn-secondary btn-sm btn-print-appointment" data-id="${appt.appointment_id}" title="Print Patient Registration &amp; Appointment Form">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print Form
                    </button>
                </td>
            `;

            frag.appendChild(tr);
        });

        tbody.appendChild(frag);
    },

    formatVitals(appt) {
        const parts = [];
        if (appt.blood_pressure) {
            parts.push(`BP ${escapeHtml(appt.blood_pressure)}`);
        }
        if (appt.temperature !== null && appt.temperature !== undefined && appt.temperature !== '') {
            parts.push(`${Number(appt.temperature).toFixed(1)} &deg;C`);
        }
        if (appt.oxygen_saturation !== null && appt.oxygen_saturation !== undefined && appt.oxygen_saturation !== '') {
            parts.push(`SpO2 ${Number(appt.oxygen_saturation).toFixed(0)}%`);
        }
        return parts.length ? parts.join(' &middot; ') : '<span class="text-muted">Not recorded</span>';
    },

    getStatusColor(status) {
        switch (status) {
            case 'scheduled': return { bg: '#eef2ff', text: '#4f46e5' };
            case 'confirmed': return { bg: '#dcfce7', text: '#16a34a' };
            case 'completed': return { bg: '#f1f5f9', text: '#475569' };
            case 'cancelled': return { bg: '#fee2e2', text: '#ef4444' };
            case 'no_show':   return { bg: '#ffedd5', text: '#ea580c' };
            default:          return { bg: '#f3f4f6', text: '#374151' };
        }
    },

    openBookModal() {
        this.clearFormErrors();
        const form = this.container.querySelector('#appointment-form');
        form.reset();
        this.patientPicker.clear();
        this.doctorPicker.clear();

        const dateInput = this.container.querySelector('#appt-date');
        const now = new Date();
        const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        dateInput.min = localToday.toISOString().slice(0, 10);

        openModal('appointment-form-modal');
    },

    clearFormErrors() {
        this.container.querySelectorAll('#appointment-form .invalid-feedback').forEach(el => {
            el.textContent = '';
        });
        this.container.querySelectorAll('#appointment-form .form-control').forEach(el => {
            el.classList.remove('is-invalid');
        });
        if (this.patientPicker) this.patientPicker.setInvalid(false);
        if (this.doctorPicker) this.doctorPicker.setInvalid(false);
    },

    showFormErrors(errors) {
        const patientFeedback = this.container.querySelector('#appt-patient-error');
        if (errors.patient_id) {
            this.patientPicker.setInvalid(true);
            patientFeedback.textContent = errors.patient_id;
        }

        const doctorFeedback = this.container.querySelector('#appt-doctor-error');
        if (errors.doctor_id) {
            this.doctorPicker.setInvalid(true);
            doctorFeedback.textContent = errors.doctor_id;
        }

        const fieldMap = {
            appointment_date: ['#appt-date', '#appt-date-error'],
            appointment_time: ['#appt-time', '#appt-time-error'],
            blood_pressure: ['#appt-bp', '#appt-bp-error'],
            temperature: ['#appt-temp', '#appt-temp-error'],
            oxygen_saturation: ['#appt-o2', '#appt-o2-error']
        };

        Object.entries(errors || {}).forEach(([key, message]) => {
            const entry = fieldMap[key];
            if (!entry) return;
            const input = this.container.querySelector(entry[0]);
            const feedback = this.container.querySelector(entry[1]);
            if (input) input.classList.add('is-invalid');
            if (feedback) feedback.textContent = message;
        });
    },

    validateForm(payload) {
        const errors = {};
        if (!payload.patient_id) errors.patient_id = 'Please choose a patient.';
        if (!payload.doctor_id) errors.doctor_id = 'Please choose a doctor.';
        if (!payload.appointment_date) errors.appointment_date = 'Please pick a date.';
        if (!payload.appointment_time) errors.appointment_time = 'Please pick a time.';

        this.clearFormErrors();
        if (Object.keys(errors).length > 0) {
            this.showFormErrors(errors);
            return false;
        }
        return true;
    },

    async saveAppointment() {
        const payload = {
            patient_id: parseInt(this.patientPicker.getValue() || '0', 10),
            doctor_id: parseInt(this.doctorPicker.getValue() || '0', 10),
            appointment_date: this.container.querySelector('#appt-date').value,
            appointment_time: this.container.querySelector('#appt-time').value,
            chief_complaint: this.container.querySelector('#appt-complaint').value.trim(),
            blood_pressure: this.container.querySelector('#appt-bp').value.trim(),
            temperature: this.container.querySelector('#appt-temp').value.trim(),
            oxygen_saturation: this.container.querySelector('#appt-o2').value.trim()
        };

        if (!this.validateForm(payload)) return;

        const saveBtn = this.container.querySelector('#btn-save-appointment');
        saveBtn.disabled = true;

        try {
            const res = await api.post('api/appointment_controller.php', payload);
            if (res.success) {
                const newAppointmentId = res.data ? res.data.appointment_id : null;
                const patientLabel = this.patientPicker.getLabel();

                this.container.querySelector('#appointment-form').reset();
                this.patientPicker.clear();
                this.doctorPicker.clear();
                this.clearFormErrors();
                closeModal('appointment-form-modal');
                await this.loadData();

                if (newAppointmentId) {
                    this.pendingPrintId = newAppointmentId;
                    this.container.querySelector('#print-prompt-patient').textContent = patientLabel || 'this patient';
                    openModal('print-prompt-modal');
                } else {
                    showToast('Appointment scheduled successfully.', 'success');
                }
            } else {
                this.showFormErrors(res.errors || {});
                showToast(res.message || 'Failed to schedule appointment.', 'error');
            }
        } catch (err) {
            const data = err.response?.data || {};
            this.showFormErrors(data.errors || {});
            showToast(data.message || 'Failed to schedule appointment.', 'error');
        } finally {
            saveBtn.disabled = false;
        }
    }
};
