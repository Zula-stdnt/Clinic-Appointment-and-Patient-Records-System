// assets/js/modules/receptionist_appointments.js
// Front-desk booking: create patient appointments with optional triage vital signs
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms (appointment header + vital signs detail saved together) & 02 DOM and UI/dom_create_and_remove_elements (Create -> Configure -> Listen -> Append rows)

import api from '../api.js?v=8';
import { create, escapeHtml, showToast, openModal, closeModal, confirmAction, formatStatusLabel } from '../ui.js?v=24';
import { SearchSelect } from '../components/search-select.js?v=1';
import { PatientRegisterForm } from '../components/patient-register.js?v=1';
import { printAppointmentForm } from '../components/print-appointment-form.js?v=2';
import { confirmDialog } from '../components/confirm-dialog.js?v=1';

export default {
    state: {
        appointments: [],
        patients: [],
        doctors: [],
        search: '',
        status: '',
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 1,
        sortBy: 'appointment_date',
        sortOrder: 'DESC',
        activeEditId: null,
        activeEditStatus: null,
        isDirty: false,
        isWalkinDirty: false
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
        await Promise.all([
            this.loadData(),
            this.loadOptions()
        ]);
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

                <div id="appointments-capacity-alert" class="alert alert-warning" role="alert" style="display: none; margin: 1rem 1.5rem 0 1.5rem; align-items: flex-start; justify-content: space-between; border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 0.15rem; color: #b45309;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <div>
                            <strong style="color: #92400e; display: block; margin-bottom: 0.2rem; font-size: 0.9rem;">Clinic Volume Notice</strong>
                            <span id="appointments-capacity-alert-message" style="color: #78350f; font-size: 0.85rem;"></span>
                        </div>
                    </div>
                    <button type="button" class="btn-close" id="btn-close-capacity-alert" aria-label="Dismiss warning" style="background: none; border: none; font-size: 1.25rem; line-height: 1; cursor: pointer; color: #92400e; padding: 0.25rem; margin-left: 1rem;">&times;</button>
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

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="appointments-page-size" class="form-control table-page-size">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                        </select>
                        <button class="btn btn-secondary" id="btn-refresh-appointments">Refresh</button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th data-sort="appointment_date">Date &amp; Time</th>
                                <th data-sort="patient_name">Patient</th>
                                <th data-sort="doctor_name">Doctor</th>
                                <th data-sort="status">Status</th>
                                <th style="text-align: right; white-space: nowrap;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="appointments-tbody">
                            <tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading appointments...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination-wrapper" id="appointments-pagination"></div>
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
                                        <div style="display: flex; gap: 0.25rem;">
                                            <button type="button" class="btn btn-secondary btn-sm" id="btn-open-walkin" aria-haspopup="dialog" aria-controls="walkin-form-modal">+ Register Walk-in</button>
                                            <button type="button" class="btn btn-secondary btn-sm" id="btn-register-patient" style="display: none;">Register Patient</button>
                                        </div>
                                    </div>
                                    <div id="appt-patient-picker"></div>
                                    <select id="appt-patient" name="patient_id" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; opacity: 0; pointer-events: none;" tabindex="-1" aria-hidden="true">
                                        <option value="" disabled selected>Select Patient</option>
                                    </select>
                                    <div class="invalid-feedback" id="appt-patient-error"></div>
                                </div>
                                <div class="form-group doctor-combobox-wrapper" style="position: relative;">
                                    <label for="doctor-select-btn">Doctor <span class="required-star">*</span></label>
                                    <div id="appt-doctor-picker" style="display: none;"></div>
                                    <div class="doctor-combobox-input-wrapper" style="position: relative; display: flex;">
                                        <button type="button" id="doctor-select-btn" class="form-control" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="doctor-listbox" style="text-align: left; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: #fff; padding-right: 2.25rem;">
                                            <span id="doctor-select-label" class="text-muted">Select Doctor</span>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; right: 0.75rem; pointer-events: none;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>
                                    <select id="appt-doctor" name="doctor_id" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; opacity: 0; pointer-events: none;" tabindex="-1" aria-hidden="true">
                                        <option value="" disabled selected>Select Doctor</option>
                                    </select>
                                    <div id="doctor-listbox" role="listbox" aria-label="Doctor Options" tabindex="-1" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 1050; max-height: 200px; overflow-y: auto; overflow-x: hidden; background: #ffffff; border: 1px solid #ced4da; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-top: 2px;">
                                    </div>
                                    <div class="invalid-feedback" id="appt-doctor-error"></div>
                                    <div id="doctor-schedule-notice" style="display: none; margin-top: 0.35rem; font-size: 0.8rem; padding: 0.35rem 0.6rem; border-radius: 4px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; align-items: center; gap: 0.4rem;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        <span id="doctor-schedule-notice-text"></span>
                                    </div>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="appt-date">Appointment Date <span class="required-star">*</span></label>
                                    <div style="display: flex; gap: 0.25rem;">
                                        <input type="date" id="appt-date" class="form-control" style="flex: 1;">
                                        <button type="button" id="btn-picker-date" class="btn btn-outline-secondary" title="Open Calendar" aria-label="Open Calendar" style="padding: 0 0.75rem; display: flex; align-items: center; justify-content: center;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        </button>
                                    </div>
                                    <div class="invalid-feedback" id="appt-date-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="appt-time">Appointment Time <span class="required-star">*</span></label>
                                    <div style="display: flex; gap: 0.25rem;">
                                        <input type="time" id="appt-time" class="form-control" style="flex: 1;" min="08:00" max="17:00" step="900">
                                        <button type="button" id="btn-picker-time" class="btn btn-outline-secondary" title="Open Time Picker" aria-label="Open Time Picker" style="padding: 0 0.75rem; display: flex; align-items: center; justify-content: center;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        </button>
                                    </div>
                                    <div class="invalid-feedback" id="appt-time-error"></div>
                                </div>
                            </div>

                            <div id="appt-schedule-warning-banner" class="alert alert-warning" style="display: none; margin-top: -0.25rem; margin-bottom: 1rem; font-size: 0.84rem; padding: 0.55rem 0.75rem; align-items: flex-start; gap: 0.5rem;" role="alert">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <div id="appt-schedule-warning-text"></div>
                            </div>

                            <div class="form-group">
                                <label for="appt-complaint">Chief Complaint</label>
                                <textarea id="appt-complaint" class="form-control" rows="2" placeholder="Reason for the visit (e.g. persistent cough and fever)"></textarea>
                            </div>

                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                    <label for="appt-allergies" style="margin-bottom: 0;">Allergies &amp; Clinical Alerts <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <span id="appt-allergies-status-badge"></span>
                                </div>
                                <input type="text" id="appt-allergies" class="form-control" placeholder="e.g. Penicillin (anaphylaxis), Sulfa drugs, Peanuts, or leave blank">
                                <small class="text-muted" style="display: block; margin-top: 0.25rem; font-size: 0.78rem;">Patient-reported intake note. Flags as unconfirmed until verified by physician.</small>
                                <div class="invalid-feedback" id="appt-allergies-error"></div>
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
                                <button type="button" class="btn btn-secondary" id="btn-cancel-appointment" data-dismiss="modal">Cancel</button>
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

            <div class="modal" id="walkin-form-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="walkin-modal-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="walkin-modal-title">Register Walk-in Patient</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" data-close-modal aria-label="Back to appointment form"></button>
                        </div>
                        <form id="walkin-form" novalidate>
                            <div class="modal-body">
                                <div class="alert alert-warning" id="walkin-status" role="status" style="display: none; margin-bottom: 1rem;"></div>
                                <div class="form-group">
                                    <label for="walkin-first">First Name <span class="required-star">*</span></label>
                                    <input type="text" id="walkin-first" class="form-control" maxlength="80">
                                    <div class="invalid-feedback" id="walkin-first-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-middle">Middle Initial</label>
                                    <input type="text" id="walkin-middle" class="form-control" maxlength="10">
                                    <div class="invalid-feedback" id="walkin-middle-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-last">Last Name <span class="required-star">*</span></label>
                                    <input type="text" id="walkin-last" class="form-control" maxlength="80">
                                    <div class="invalid-feedback" id="walkin-last-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-gender">Gender <span class="required-star">*</span></label>
                                    <select id="walkin-gender" class="form-control">
                                        <option value="" disabled selected>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Unknown">Unknown</option>
                                    </select>
                                    <div class="invalid-feedback" id="walkin-gender-error"></div>
                                </div>
                                <div class="form-group" id="walkin-custom-gender-group" style="display: none;">
                                    <label for="walkin-custom-gender">Specify Gender <span class="required-star">*</span></label>
                                    <input type="text" id="walkin-custom-gender" class="form-control" placeholder="Please specify your gender" maxlength="50">
                                    <div class="invalid-feedback" id="walkin-custom-gender-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-dob">Date of Birth <span class="required-star">*</span></label>
                                    <input type="date" id="walkin-dob" class="form-control">
                                    <div class="invalid-feedback" id="walkin-dob-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-contact">Contact No. <span class="required-star">*</span></label>
                                    <input type="text" id="walkin-contact" class="form-control" inputmode="numeric" maxlength="11" placeholder="e.g. 09171234567">
                                    <div class="invalid-feedback" id="walkin-contact-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="walkin-address">Address</label>
                                    <textarea id="walkin-address" class="form-control" rows="2" maxlength="255"></textarea>
                                    <div class="invalid-feedback" id="walkin-address-error"></div>
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="walkin-allergies">Allergies &amp; Clinical Alerts <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="walkin-allergies" class="form-control" placeholder="e.g. Penicillin, Sulfa drugs, Peanuts, or leave blank">
                                    <div class="invalid-feedback" id="walkin-allergies-error"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="btn-cancel-walkin" data-dismiss="modal" data-close-modal>Back to Appointment</button>
                                <button type="submit" id="btn-save-walkin" class="btn btn-primary">Register & Select</button>
                            </div>
                        </form>
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
                    meta: p.contact_no ? p.contact_no : (p.date_of_birth ? `DOB: ${p.date_of_birth}` : ''),
                    allergies_alerts: p.allergies_alerts || '',
                    allergies_confirmed_by_doctor: p.allergies_confirmed_by_doctor ? 1 : 0
                }));
            },
            onChange: (item) => {
                const patSelect = this.container.querySelector('#appt-patient');
                if (patSelect && item) {
                    if (!Array.from(patSelect.options).some(o => o.value == item.value)) {
                        const opt = create('option');
                        opt.value = item.value;
                        opt.textContent = item.label;
                        patSelect.appendChild(opt);
                    }
                    patSelect.value = item.value;
                    patSelect.classList.remove('is-invalid');
                }
                this.updateAllergyFromSelectedPatient(item);
            }
        }).mount(this.container.querySelector('#appt-patient-picker'));

        // Listen for direct selection changes on native select
        const patSelect = this.container.querySelector('#appt-patient');
        if (patSelect) {
            patSelect.addEventListener('change', () => {
                const selectedId = patSelect.value;
                const found = Array.isArray(this.state.patients)
                    ? this.state.patients.find(p => String(p.patient_id) === String(selectedId))
                    : null;
                this.updateAllergyFromSelectedPatient(found);
            });
        }

        // Live status feedback when receptionist modifies the intake note
        const allergiesInput = this.container.querySelector('#appt-allergies');
        if (allergiesInput) {
            allergiesInput.addEventListener('input', () => {
                const val = allergiesInput.value.trim();
                this.renderAllergyBadge(val, 0);
            });
        }

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

    renderAllergyBadge(allergies, isConfirmed) {
        const badgeEl = this.container.querySelector('#appt-allergies-status-badge');
        if (!badgeEl) return;
        const text = (allergies || '').trim();
        if (text) {
            if (isConfirmed) {
                badgeEl.innerHTML = `
                    <span class="badge badge-status-completed" style="font-size: 0.75rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Doctor Confirmed
                    </span>
                `;
            } else {
                badgeEl.innerHTML = `
                    <span class="badge badge-status-confirmed" style="font-size: 0.75rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Unconfirmed Intake Note
                    </span>
                `;
            }
        } else {
            badgeEl.innerHTML = `
                <span class="badge badge-status-scheduled" style="font-size: 0.75rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                    No Allergy Recorded
                </span>
            `;
        }
    },

    updateAllergyFromSelectedPatient(patient) {
        const allergiesInput = this.container.querySelector('#appt-allergies');
        if (!patient) {
            if (allergiesInput) allergiesInput.value = '';
            this.renderAllergyBadge('', 0);
            return;
        }
        const allergies = patient.allergies_alerts || '';
        const isConfirmed = !!patient.allergies_confirmed_by_doctor;
        if (allergiesInput) {
            allergiesInput.value = allergies;
        }
        this.renderAllergyBadge(allergies, isConfirmed);
    },

    setupRegisterForm() {
        this.registerForm = new PatientRegisterForm({
            container: this.container,
            modalId: 'register-patient-modal',
            successMessage: 'Patient registered and selected for this appointment.',
            onRegistered: (patient) => {
                const label = this.formatPatientName(patient);
                if (this.patientPicker) {
                    this.patientPicker.reload();
                    this.patientPicker.setValue(patient.patient_id, label);
                    this.patientPicker.setInvalid(false);
                }
                const patSelect = this.container.querySelector('#appt-patient');
                if (patSelect) {
                    if (!Array.from(patSelect.options).some(o => o.value == patient.patient_id)) {
                        const opt = create('option');
                        opt.value = patient.patient_id;
                        opt.textContent = label;
                        patSelect.appendChild(opt);
                    }
                    patSelect.value = patient.patient_id;
                    patSelect.classList.remove('is-invalid');
                }
                const errEl = this.container.querySelector('#appt-patient-error');
                if (errEl) errEl.textContent = '';
                this.updateAllergyFromSelectedPatient(patient);
            }
        });
    },

    formatPatientName(person) {
        const mi = person.middle_initial ? ` ${person.middle_initial}.` : '';
        return `${person.last_name}, ${person.first_name}${mi}`;
    },

    attachEventListeners() {
        let searchTimer = null;
        const searchInput = this.container.querySelector('#appointments-search');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this.state.search = e.target.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        this.container.querySelector('#appointments-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#appointments-page-size')?.addEventListener('change', (e) => {
            this.state.pageSize = parseInt(e.target.value, 10);
            this.state.page = 1;
            this.loadData();
        });

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

        this.container.querySelector('#btn-new-appointment').addEventListener('click', () => {
            this.openBookModal();
        });

        this.container.querySelector('#btn-cancel-appointment').addEventListener('click', () => {
            closeModal(this.container.querySelector('#appointment-form-modal'));
        });

        this.container.querySelector('#btn-refresh-appointments').addEventListener('click', () => {
            this.loadData();
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

        this.container.querySelector('#btn-close-capacity-alert')?.addEventListener('click', () => {
            const alertBox = this.container.querySelector('#appointments-capacity-alert');
            if (alertBox) alertBox.style.display = 'none';
        });

        this.container.querySelector('#appointment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAppointment();
        });
        const regBtn = this.container.querySelector('#btn-register-patient');
        if (regBtn) {
            regBtn.addEventListener('click', () => {
                if (this.registerForm) this.registerForm.open();
            });
        }

        this.container.querySelector('#btn-print-appointment-now')?.addEventListener('click', () => {
            closeModal('print-prompt-modal');
            if (this.pendingPrintId) {
                printAppointmentForm(this.pendingPrintId);
            }
        });

        const apptForm = this.container.querySelector('#appointment-form');
        apptForm.addEventListener('input', () => { this.state.isDirty = true; });
        apptForm.addEventListener('change', () => { this.state.isDirty = true; });

        const apptDateInput = this.container.querySelector('#appt-date');
        const apptTimeInput = this.container.querySelector('#appt-time');
        if (apptDateInput) {
            ['input', 'change', 'blur'].forEach(evt => {
                apptDateInput.addEventListener(evt, () => this.validateAppointmentScheduleLive());
            });
        }
        if (apptTimeInput) {
            ['input', 'change', 'blur'].forEach(evt => {
                apptTimeInput.addEventListener(evt, () => this.validateAppointmentScheduleLive());
            });
        }

        const apptModal = this.container.querySelector('#appointment-form-modal');
        apptModal.addEventListener('beforeModalClose', (e) => {
            if (this.state.isDirty && !this.bypassingDirtyCheck) {
                e.preventDefault();
                confirmAction({
                    title: 'Discard Changes?',
                    message: 'You have unsaved changes. Are you sure you want to discard them?',
                    btnText: 'Discard',
                    btnClass: 'btn btn-danger',
                    onConfirm: () => {
                        this.state.isDirty = false;
                        closeModal(apptModal, true);
                    }
                });
            }
        });

        this.container.querySelector('#appointments-tbody').addEventListener('click', (e) => {
            const printBtn = e.target.closest('.btn-print-appointment');
            if (printBtn) {
                printAppointmentForm(printBtn.getAttribute('data-id'));
                return;
            }

            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id, 10);
            
            if (action === 'edit') {
                const appt = this.state.appointments.find(a => a.appointment_id === id);
                if (appt) this.openBookModal(appt);
            } else if (action === 'confirm') {
                this.updateStatus(id, 'confirmed');
            } else if (action === 'cancel') {
                this.updateStatus(id, 'cancelled');
            } else if (action === 'noshow') {
                this.updateStatus(id, 'no_show');
            }
        });

        const walkinGenderSelect = this.container.querySelector('#walkin-gender');
        const walkinCustomGenderGroup = this.container.querySelector('#walkin-custom-gender-group');
        if (walkinGenderSelect && walkinCustomGenderGroup) {
            walkinGenderSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Other') {
                    walkinCustomGenderGroup.style.display = 'block';
                } else {
                    walkinCustomGenderGroup.style.display = 'none';
                    this.container.querySelector('#walkin-custom-gender').value = '';
                }
            });
        }

        // Walk-in listeners.
        // The walk-in step is NOT a nested modal: ui.js tracks a single active modal, so opening it
        // swaps the appointment modal out (closeModal only toggles .active, so the draft fields are kept)
        // and every close path (Back/x buttons, Escape, backdrop click) swaps the appointment modal back in.
        const walkinModal = this.container.querySelector('#walkin-form-modal');
        this.container.querySelector('#btn-open-walkin').addEventListener('click', () => {
            this.openWalkinModal();
        });
        this.container.querySelector('#walkin-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveWalkinPatient();
        });

        const walkinForm = this.container.querySelector('#walkin-form');
        walkinForm.addEventListener('input', () => { this.state.isWalkinDirty = true; });
        walkinForm.addEventListener('change', () => { this.state.isWalkinDirty = true; });

        walkinModal.addEventListener('beforeModalClose', (e) => {
            if (this.state.isWalkinDirty && !this.bypassingWalkinDirtyCheck) {
                e.preventDefault();
                confirmAction({
                    title: 'Discard Patient Data?',
                    message: 'You have unsaved patient information. Are you sure you want to discard it?',
                    btnText: 'Discard',
                    btnClass: 'btn btn-danger',
                    onConfirm: () => {
                        this.state.isWalkinDirty = false;
                        closeModal(walkinModal, true);
                    }
                });
            }
        });

        // While a registration request is pending, keep the walk-in step open so the outcome is
        // always reported in context. Capture phase runs before ui.js's modal/document handlers.
        walkinModal.addEventListener('keydown', (e) => {
            if (this.walkinPending && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
        walkinModal.addEventListener('click', (e) => {
            if (!this.walkinPending) return;
            if (e.target === walkinModal || e.target.closest('[data-close-modal]')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        // Return to the appointment form whenever the walk-in modal stops being active,
        // regardless of which shared close path in ui.js closed it.
        this.walkinObserver = new MutationObserver(() => {
            if (this.walkinReturnPending && !walkinModal.classList.contains('active')) {
                this.walkinReturnPending = false;
                this.returnToAppointmentForm();
            }
        });
        this.walkinObserver.observe(walkinModal, { attributes: true, attributeFilter: ['class'] });

        this.initDoctorCombobox();
        this.initPickerAffordances();
    },

    initPickerAffordances() {
        const triggerPicker = (input) => {
            if (!input) return;
            try {
                if (typeof input.showPicker === 'function') {
                    input.showPicker();
                } else {
                    input.focus();
                    input.click();
                }
            } catch (err) {
                input.focus();
                input.click();
            }
        };

        this.container.querySelector('#btn-picker-date')?.addEventListener('click', () => {
            triggerPicker(this.container.querySelector('#appt-date'));
        });

        this.container.querySelector('#btn-picker-time')?.addEventListener('click', () => {
            triggerPicker(this.container.querySelector('#appt-time'));
        });
    },

    initDoctorCombobox() {
        const btn = this.container.querySelector('#doctor-select-btn');
        const select = this.container.querySelector('#appt-doctor');
        const listbox = this.container.querySelector('#doctor-listbox');

        if (!btn || !select || !listbox) return;

        this.highlightedDoctorIndex = -1;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleDoctorListbox();
        });

        btn.addEventListener('keydown', (e) => {
            this.handleDoctorComboboxKeydown(e);
        });

        select.addEventListener('change', () => {
            this.syncDoctorComboboxFromSelect();
        });

        document.addEventListener('click', (e) => {
            if (!this.container || !this.container.contains(e.target)) return;
            if (!e.target.closest('.doctor-combobox-wrapper')) {
                this.closeDoctorListbox();
            }
        });
    },

    syncDoctorComboboxFromSelect() {
        const select = this.container.querySelector('#appt-doctor');
        const labelSpan = this.container.querySelector('#doctor-select-label');
        const btn = this.container.querySelector('#doctor-select-btn');
        const schedNotice = this.container.querySelector('#doctor-schedule-notice');
        const schedNoticeText = this.container.querySelector('#doctor-schedule-notice-text');
        if (!select || !labelSpan) return;
        const selectedId = select.value;
        if (!selectedId) {
            labelSpan.textContent = 'Select Doctor';
            labelSpan.classList.add('text-muted');
            if (schedNotice) schedNotice.style.display = 'none';
            return;
        }
        const doc = this.state.doctors.find(d => String(d.doctor_id) === String(selectedId));
        if (doc) {
            const name = `${doc.last_name}, ${doc.first_name}${doc.middle_initial ? ' ' + doc.middle_initial + '.' : ''}`;
            labelSpan.textContent = `Dr. ${name}`;
            labelSpan.classList.remove('text-muted');
            if (schedNotice && schedNoticeText) {
                schedNoticeText.textContent = `Duty Schedule: ${doc.schedule_summary || 'Mon-Sat (08:00 - 17:00)'}`;
                schedNotice.style.display = 'flex';
            }
        } else {
            const opt = select.selectedOptions[0];
            labelSpan.textContent = opt ? opt.textContent : 'Select Doctor';
            if (opt && opt.value) {
                labelSpan.classList.remove('text-muted');
            } else {
                labelSpan.classList.add('text-muted');
            }
            if (schedNotice) schedNotice.style.display = 'none';
        }
        if (btn) btn.classList.remove('is-invalid');
    },

    renderDoctorListbox() {
        const listbox = this.container.querySelector('#doctor-listbox');
        if (!listbox) return;

        listbox.innerHTML = '';
        if (!this.state.doctors || this.state.doctors.length === 0) {
            const empty = document.createElement('div');
            empty.style.padding = '0.65rem 0.75rem';
            empty.style.fontSize = '0.85rem';
            empty.style.color = '#64748b';
            empty.style.textAlign = 'center';
            empty.textContent = 'No doctors available';
            listbox.appendChild(empty);
            return;
        }

        const currentSelectedId = String(this.container.querySelector('#appt-doctor')?.value || '');

        this.state.doctors.forEach((d) => {
            const name = `${d.last_name}, ${d.first_name}${d.middle_initial ? ' ' + d.middle_initial + '.' : ''}`;
            const item = document.createElement('div');
            item.className = 'doctor-combobox-option';
            item.id = `doctor-option-${d.doctor_id}`;
            item.setAttribute('role', 'option');
            item.dataset.id = d.doctor_id;
            item.dataset.name = `Dr. ${name}`;
            const isSelected = String(d.doctor_id) === currentSelectedId;
            item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

            item.style.padding = '0.5rem 0.75rem';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #f1f5f9';
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.gap = '0.15rem';
            if (isSelected) {
                item.style.backgroundColor = '#eef2ff';
            }

            const nameDiv = document.createElement('div');
            nameDiv.style.fontWeight = '500';
            nameDiv.style.fontSize = '0.88rem';
            nameDiv.style.color = '#1e293b';
            nameDiv.textContent = `Dr. ${name}`;

            const specDiv = document.createElement('div');
            specDiv.style.fontSize = '0.78rem';
            specDiv.style.color = '#64748b';
            specDiv.style.whiteSpace = 'nowrap';
            specDiv.style.overflow = 'hidden';
            specDiv.style.textOverflow = 'ellipsis';
            specDiv.style.maxWidth = '100%';
            specDiv.title = d.specialty_names || 'General Medicine';
            specDiv.textContent = d.specialty_names || 'General Medicine';

            const schedDiv = document.createElement('div');
            schedDiv.style.fontSize = '0.74rem';
            schedDiv.style.color = '#0284c7';
            schedDiv.style.fontWeight = '500';
            schedDiv.textContent = `🗓️ ${d.schedule_summary || 'Mon-Sat (08:00 - 17:00)'}`;

            item.appendChild(nameDiv);
            item.appendChild(specDiv);
            item.appendChild(schedDiv);

            item.addEventListener('mouseenter', () => {
                this.highlightDoctorOption(item);
            });

            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            item.addEventListener('click', () => {
                this.selectDoctor(d.doctor_id, `Dr. ${name}`);
            });

            listbox.appendChild(item);
        });

        this.highlightedDoctorIndex = -1;
    },

    selectDoctor(doctorId, label) {
        const select = this.container.querySelector('#appt-doctor');
        const labelSpan = this.container.querySelector('#doctor-select-label');
        const btn = this.container.querySelector('#doctor-select-btn');
        if (select) {
            select.value = doctorId;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (labelSpan) {
            labelSpan.textContent = label;
            labelSpan.classList.remove('text-muted');
        }
        if (btn) {
            btn.classList.remove('is-invalid');
        }
        const err = this.container.querySelector('#appt-doctor-error');
        if (err) err.textContent = '';
        this.closeDoctorListbox();
        this.validateAppointmentScheduleLive();
        this.state.isDirty = true;
    },

    openDoctorListbox() {
        const listbox = this.container.querySelector('#doctor-listbox');
        const btn = this.container.querySelector('#doctor-select-btn');
        if (!listbox || !btn) return;
        this.renderDoctorListbox();
        listbox.style.display = 'block';
        btn.setAttribute('aria-expanded', 'true');
        const currentSelectedId = String(this.container.querySelector('#appt-doctor')?.value || '');
        const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
        const selectedOpt = options.find(opt => opt.dataset.id === currentSelectedId);
        if (selectedOpt) {
            this.highlightDoctorOption(selectedOpt);
        } else if (options.length > 0) {
            this.highlightDoctorOption(options[0]);
        }
    },

    closeDoctorListbox() {
        const listbox = this.container.querySelector('#doctor-listbox');
        const btn = this.container.querySelector('#doctor-select-btn');
        if (!listbox || !btn) return;
        listbox.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        btn.removeAttribute('aria-activedescendant');
        this.highlightedDoctorIndex = -1;
    },

    toggleDoctorListbox() {
        const listbox = this.container.querySelector('#doctor-listbox');
        if (listbox && listbox.style.display === 'block') {
            this.closeDoctorListbox();
        } else {
            this.openDoctorListbox();
        }
    },

    highlightDoctorOption(item) {
        const listbox = this.container.querySelector('#doctor-listbox');
        if (!listbox) return;
        const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
        options.forEach(opt => {
            if (opt !== item && opt.getAttribute('aria-selected') !== 'true') {
                opt.style.backgroundColor = '';
            }
        });
        if (item) {
            item.style.backgroundColor = '#eef2ff';
            item.scrollIntoView({ block: 'nearest' });
            const btn = this.container.querySelector('#doctor-select-btn');
            if (btn) btn.setAttribute('aria-activedescendant', item.id);
            this.highlightedDoctorIndex = options.indexOf(item);
        }
    },

    handleDoctorComboboxKeydown(e) {
        const listbox = this.container.querySelector('#doctor-listbox');
        if (!listbox) return;
        const isOpen = listbox.style.display === 'block';

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                this.openDoctorListbox();
                return;
            }
            const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
            if (options.length === 0) return;
            let nextIndex = this.highlightedDoctorIndex + 1;
            if (nextIndex >= options.length) nextIndex = 0;
            this.highlightDoctorOption(options[nextIndex]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                this.openDoctorListbox();
                return;
            }
            const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
            if (options.length === 0) return;
            let prevIndex = this.highlightedDoctorIndex - 1;
            if (prevIndex < 0) prevIndex = options.length - 1;
            this.highlightDoctorOption(options[prevIndex]);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isOpen) {
                const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
                if (this.highlightedDoctorIndex >= 0 && this.highlightedDoctorIndex < options.length) {
                    const opt = options[this.highlightedDoctorIndex];
                    this.selectDoctor(opt.dataset.id, opt.dataset.name);
                } else {
                    this.closeDoctorListbox();
                }
            } else {
                this.openDoctorListbox();
            }
        } else if (e.key === 'Escape') {
            if (isOpen) {
                e.preventDefault();
                this.closeDoctorListbox();
            }
        } else if (e.key === 'Tab') {
            this.closeDoctorListbox();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (!isOpen) {
                this.openDoctorListbox();
            }
            const char = e.key.toLowerCase();
            const options = Array.from(listbox.querySelectorAll('.doctor-combobox-option'));
            const match = options.find(opt => {
                const text = (opt.dataset.name || '').replace(/^dr\.\s*/i, '').toLowerCase();
                return text.startsWith(char);
            });
            if (match) {
                this.highlightDoctorOption(match);
            }
        }
    },

    async loadOptions() {
        try {
            const [pRes, dRes] = await Promise.all([
                api.get('api/appointment_controller.php', { meta: 'patients' }),
                api.get('api/appointment_controller.php', { meta: 'doctors' })
            ]);

            if (pRes.success) {
                this.state.patients = (pRes.data && pRes.data.items) ? pRes.data.items : [];
            }
            if (dRes.success) {
                this.state.doctors = (dRes.data && dRes.data.items) ? dRes.data.items : [];
            }

            this.renderSelect(this.container.querySelector('#appt-patient'), this.state.patients, (p) => this.patientOption(p), 'Select Patient');

            this.renderSelect(this.container.querySelector('#appt-doctor'), this.state.doctors, (d) => {
                const name = `${d.last_name}, ${d.first_name}${d.middle_initial ? ' ' + d.middle_initial + '.' : ''}`;
                const specialty = d.specialty_names ? ` — ${d.specialty_names}` : '';
                return { value: d.doctor_id, label: `Dr. ${name}${specialty}` };
            }, 'Select Doctor');

            this.renderDoctorListbox();
            this.syncDoctorComboboxFromSelect();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to load patients and doctors.', 'error');
        }
    },

    renderSelect(select, items, toOption, placeholder) {
        if (!select) return;
        const previous = select.value;
        select.innerHTML = `<option value="" disabled selected>${escapeHtml(placeholder)}</option>`;
        items.forEach(item => {
            const opt = toOption(item);
            const option = create('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading appointments...</td></tr>';

        try {
            const params = {
                page: this.state.page,
                page_size: this.state.pageSize,
                sort_by: this.state.sortBy,
                sort_order: this.state.sortOrder
            };
            if (this.state.search) params.search = this.state.search;
            if (this.state.status) params.status = this.state.status;

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
                throw new Error(res.message || 'Failed to load appointments.');
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(err.response?.data?.message || err.message || 'Failed to load appointments.')}</td></tr>`;
        }
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#appointments-pagination');
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
                <button class="btn btn-secondary btn-sm" id="appointments-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="appointments-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#appointments-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#appointments-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    renderTable() {
        const tbody = this.container.querySelector('#appointments-tbody');
        const items = this.state.appointments;
        tbody.innerHTML = '';

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
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

            const badgeClass = this.getStatusBadgeClass(appt.status);

            const isTerminal = ['completed', 'cancelled', 'no_show'].includes(appt.status);
            const printBtnHtml = `
                <button type="button" class="btn btn-secondary btn-sm btn-icon btn-print-appointment" data-id="${appt.appointment_id}" title="Print Patient Registration &amp; Appointment Form" aria-label="Print appointment form">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                </button>
            `;
            let actionButtons = `<div class="actions-cell">${printBtnHtml}</div>`;
            if (!isTerminal) {
                actionButtons = `
                    <div class="actions-cell">
                        ${printBtnHtml}
                        <button type="button" class="btn btn-sm btn-icon btn-outline-primary" data-action="edit" data-id="${appt.appointment_id}" title="Edit Appointment" aria-label="Edit appointment">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        ${appt.status === 'scheduled' ? `
                        <button type="button" class="btn btn-sm btn-icon btn-outline-success" data-action="confirm" data-id="${appt.appointment_id}" title="Confirm Appointment" aria-label="Confirm appointment">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>` : ''}
                        <button type="button" class="btn btn-sm btn-icon btn-outline-danger" data-action="cancel" data-id="${appt.appointment_id}" data-patient="${escapeHtml(appt.patient_last + ', ' + appt.patient_first)}" title="Cancel Appointment" aria-label="Cancel appointment">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <button type="button" class="btn btn-sm btn-icon btn-outline-warning" data-action="noshow" data-id="${appt.appointment_id}" title="Mark as No Show" aria-label="Mark as no show">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        </button>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td style="vertical-align: middle;">
                    <div style="font-weight: 500;">${escapeHtml(dateStr)}</div>
                    <div class="text-muted" style="font-size: 0.85rem;">${escapeHtml(timeStr)}</div>
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: 500;">${escapeHtml(appt.patient_last + ', ' + appt.patient_first)}</div>
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: 500;">Dr. ${escapeHtml(appt.doctor_last + ', ' + appt.doctor_first)}</div>
                </td>
                <td style="vertical-align: middle;">
                    <span class="badge ${badgeClass}">
                        ${escapeHtml(formatStatusLabel(appt.status))}
                    </span>
                    ${appt.cancel_requested ? `
                    <div style="margin-top: 0.35rem;">
                        <span class="badge badge-status-critical" style="font-size: 0.72rem; font-weight: 600; cursor: help;" title="Doctor Cancel Requested: ${escapeHtml(appt.cancel_request_reason || 'Doctor requested cancellation')}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Cancel Requested
                        </span>
                    </div>` : ''}
                    ${appt.is_overdue && !isTerminal ? `
                    <div style="margin-top: 0.35rem;">
                        <span class="badge badge-status-overdue" style="font-size: 0.72rem; font-weight: 600; cursor: help;" title="${appt.minutes_overdue ? appt.minutes_overdue + ' mins past schedule (+15m grace)' : 'Past scheduled appointment time'}">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Overdue (${appt.minutes_overdue || ''}m)
                        </span>
                    </div>` : ''}
                </td>
                <td style="text-align: right; white-space: nowrap; vertical-align: middle;">${actionButtons}</td>
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

    getStatusBadgeClass(status) {
        switch (status) {
            case 'scheduled': return 'badge-status-scheduled';
            case 'confirmed': return 'badge-status-confirmed';
            case 'completed': return 'badge-status-completed';
            case 'cancelled': return 'badge-status-cancelled';
            case 'no_show':   return 'badge-status-noshow';
            default:          return 'badge-status-secondary';
        }
    },

    cancelAppointment(appointmentId, patientName) {
        confirmDialog({
            title: 'Cancel Appointment',
            message: `Cancel the appointment for "${patientName || 'this patient'}"? They will be removed from the doctor's schedule and the time slot becomes available for rebooking.`,
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

    async openBookModal(appt = null) {
        this.state.isDirty = false;
        this.bypassingDirtyCheck = false;
        this.bypassingWalkinDirtyCheck = false;
        this.clearFormErrors();
        const form = this.container.querySelector('#appointment-form');
        form.reset();
        if (this.patientPicker) this.patientPicker.clear();
        if (this.doctorPicker) this.doctorPicker.clear();

        const title = this.container.querySelector('#appointment-form-modal .modal-title');
        
        // Ensure patients and doctors options are loaded
        if (!Array.isArray(this.state.patients) || !Array.isArray(this.state.doctors) || this.state.patients.length === 0 || this.state.doctors.length === 0) {
            await this.loadOptions();
        }

        if (appt) {
            this.state.activeEditId = appt.appointment_id;
            this.state.activeEditStatus = appt.status;
            title.textContent = 'Edit Patient Appointment';
            
            const patSelect = this.container.querySelector('#appt-patient');
            if (patSelect) {
                if (!Array.from(patSelect.options).some(o => o.value == appt.patient_id)) {
                    const opt = create('option');
                    opt.value = appt.patient_id;
                    const suffix = appt.patient_archived ? ' (Archived)' : '';
                    opt.textContent = `${appt.patient_last}, ${appt.patient_first}${suffix}`;
                    patSelect.appendChild(opt);
                }
                patSelect.value = appt.patient_id;
            }
            
            const docSelect = this.container.querySelector('#appt-doctor');
            if (docSelect) {
                if (!Array.from(docSelect.options).some(o => o.value == appt.doctor_id)) {
                    const opt = create('option');
                    opt.value = appt.doctor_id;
                    const suffix = appt.doctor_archived ? ' (Archived)' : '';
                    opt.textContent = `Dr. ${appt.doctor_last}, ${appt.doctor_first}${suffix}`;
                    docSelect.appendChild(opt);
                }
                docSelect.value = appt.doctor_id;
            }
            this.syncDoctorComboboxFromSelect();
            
            this.container.querySelector('#appt-date').value = appt.appointment_date;
            this.container.querySelector('#appt-time').value = appt.appointment_time;
            this.container.querySelector('#appt-complaint').value = appt.chief_complaint || '';
            const allergiesInput = this.container.querySelector('#appt-allergies');
            if (allergiesInput) allergiesInput.value = appt.allergies_alerts || '';
            this.renderAllergyBadge(appt.allergies_alerts || '', appt.allergies_confirmed_by_doctor);
            this.container.querySelector('#appt-bp').value = appt.blood_pressure || '';
            this.container.querySelector('#appt-temp').value = appt.temperature || '';
            this.container.querySelector('#appt-o2').value = appt.oxygen_saturation || '';
            
            if (this.patientPicker) {
                this.patientPicker.setValue(appt.patient_id, `${appt.patient_last}, ${appt.patient_first}`);
            }
            if (this.doctorPicker) {
                this.doctorPicker.setValue(appt.doctor_id, `Dr. ${appt.doctor_last}, ${appt.doctor_first}`);
            }
            
            const submitBtn = this.container.querySelector('#btn-save-appointment');
            submitBtn.textContent = 'Update Appointment';
            
            const walkinBtn = this.container.querySelector('#btn-open-walkin');
            if (walkinBtn) {
                walkinBtn.style.display = 'none';
            }
        } else {
            this.state.activeEditId = null;
            this.state.activeEditStatus = null;
            title.textContent = 'New Patient Appointment';
            
            const allergiesInput = this.container.querySelector('#appt-allergies');
            if (allergiesInput) allergiesInput.value = '';
            this.renderAllergyBadge('', 0);

            const walkinBtn = this.container.querySelector('#btn-open-walkin');
            if (walkinBtn) {
                walkinBtn.style.display = '';
                walkinBtn.textContent = '+ Register Walk-in';
            }
            
            const dateInput = this.container.querySelector('#appt-date');
            const now = new Date();
            const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
            if (dateInput) dateInput.min = localToday.toISOString().slice(0, 10);

            const patSelect = this.container.querySelector('#appt-patient');
            if (patSelect) patSelect.value = '';
            if (this.patientPicker) this.patientPicker.clear();

            const docSelect = this.container.querySelector('#appt-doctor');
            if (docSelect) docSelect.value = '';
            if (this.doctorPicker) this.doctorPicker.clear();
            this.syncDoctorComboboxFromSelect();
            
            const submitBtn = this.container.querySelector('#btn-save-appointment');
            submitBtn.textContent = 'Schedule Appointment';
        }

        const dateInputEl = this.container.querySelector('#appt-date');
        const timeInputEl = this.container.querySelector('#appt-time');
        const now = new Date();
        const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        if (dateInputEl) {
            dateInputEl.min = localTodayStr;
        }
        if (timeInputEl) {
            timeInputEl.min = '08:00';
            timeInputEl.max = '17:00';
            timeInputEl.step = '900';
        }
        this.clearFormErrors();
        this.validateAppointmentScheduleLive();

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
        const docBtn = this.container.querySelector('#doctor-select-btn') || this.container.querySelector('#doctor-search-input');
        if (docBtn) docBtn.classList.remove('is-invalid');
        const patErr = this.container.querySelector('#appt-patient-error');
        if (patErr) patErr.textContent = '';
        const docErr = this.container.querySelector('#appt-doctor-error');
        if (docErr) docErr.textContent = '';
        const banner = this.container.querySelector('#appt-schedule-warning-banner');
        if (banner) banner.style.display = 'none';
        const bannerText = this.container.querySelector('#appt-schedule-warning-text');
        if (bannerText) bannerText.innerHTML = '';
    },

    showFormErrors(errors) {
        const patientFeedback = this.container.querySelector('#appt-patient-error');
        if (errors.patient_id) {
            if (this.patientPicker) this.patientPicker.setInvalid(true);
            const patSelect = this.container.querySelector('#appt-patient');
            if (patSelect) patSelect.classList.add('is-invalid');
            if (patientFeedback) patientFeedback.textContent = errors.patient_id;
        }

        const doctorFeedback = this.container.querySelector('#appt-doctor-error');
        if (errors.doctor_id) {
            if (this.doctorPicker) this.doctorPicker.setInvalid(true);
            const docBtn = this.container.querySelector('#doctor-select-btn') || this.container.querySelector('#doctor-search-input');
            if (docBtn) docBtn.classList.add('is-invalid');
            const docSelect = this.container.querySelector('#appt-doctor');
            if (docSelect) docSelect.classList.add('is-invalid');
            if (doctorFeedback) doctorFeedback.textContent = errors.doctor_id;
        }

        const fieldMap = {
            appointment_date: ['#appt-date', '#appt-date-error'],
            appointment_time: ['#appt-time', '#appt-time-error'],
            allergies_alerts: ['#appt-allergies', '#appt-allergies-error'],
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
            if (key === 'doctor_id') {
                const docBtn = this.container.querySelector('#doctor-select-btn') || this.container.querySelector('#doctor-search-input');
                if (docBtn) docBtn.classList.add('is-invalid');
            }
            if (feedback) feedback.textContent = message;
        });
    },

    validateAppointmentScheduleLive() {
        const docSelect = this.container.querySelector('#appt-doctor');
        const dateInput = this.container.querySelector('#appt-date');
        const timeInput = this.container.querySelector('#appt-time');
        const dateErr = this.container.querySelector('#appt-date-error');
        const timeErr = this.container.querySelector('#appt-time-error');
        const warningBanner = this.container.querySelector('#appt-schedule-warning-banner');
        const warningText = this.container.querySelector('#appt-schedule-warning-text');

        if (!dateInput || !timeInput) return true;

        let hasError = false;
        let dateMsg = '';
        let timeMsg = '';
        let bannerMsg = '';

        const selectedDocId = (docSelect && docSelect.value) || (this.doctorPicker && this.doctorPicker.getValue());
        const selectedDoc = selectedDocId ? this.state.doctors.find(d => String(d.doctor_id) === String(selectedDocId)) : null;

        const dateVal = (dateInput.value || '').trim();
        const timeVal = (timeInput.value || '').trim();

        const now = new Date();
        const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);

        // 1. Live Date Validation
        if (dateVal) {
            if (dateVal < localTodayStr) {
                dateMsg = 'Past dates cannot be selected. Please choose today or an upcoming date.';
                hasError = true;
            } else {
                const parts = dateVal.split('-');
                if (parts.length === 3) {
                    const parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    const jsDow = parsedDate.getDay(); // 0 = Sunday, 1 = Monday, ...
                    const isoDow = jsDow === 0 ? 7 : jsDow;
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const dayName = dayNames[jsDow];

                    if (jsDow === 0) {
                        dateMsg = 'The clinic is closed on Sundays. Please choose Monday through Saturday.';
                        hasError = true;
                    } else if (selectedDoc && Array.isArray(selectedDoc.schedules) && selectedDoc.schedules.length > 0) {
                        const matchingSchedule = selectedDoc.schedules.find(s => parseInt(s.day_of_week, 10) === isoDow && (s.is_active === undefined || s.is_active == 1));
                        if (!matchingSchedule) {
                            const docName = `Dr. ${selectedDoc.last_name}`;
                            dateMsg = `${docName} is not on duty on ${dayName}. Available duty days: ${selectedDoc.schedule_summary || 'other days'}.`;
                            bannerMsg = `<strong>Schedule Notice:</strong> ${docName} does not take appointments on ${dayName}s. Duty schedule: <strong>${selectedDoc.schedule_summary || 'None'}</strong>. Please select an on-duty date.`;
                            hasError = true;
                        }
                    }
                }
            }
        }

        // 2. Live Time Validation
        if (timeVal) {
            if (timeVal < '08:00' || timeVal > '17:00') {
                timeMsg = 'Appointments can only be scheduled between clinic hours (08:00 and 17:00).';
                hasError = true;
            } else {
                const hour = parseInt(timeVal.split(':')[0], 10);
                if (hour === 12) {
                    timeMsg = 'The clinic is closed for lunch break between 12:00 and 12:59.';
                    hasError = true;
                } else if (selectedDoc && dateVal && Array.isArray(selectedDoc.schedules) && selectedDoc.schedules.length > 0) {
                    const parts = dateVal.split('-');
                    if (parts.length === 3) {
                        const parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        const jsDow = parsedDate.getDay();
                        const isoDow = jsDow === 0 ? 7 : jsDow;
                        const matchingSchedule = selectedDoc.schedules.find(s => parseInt(s.day_of_week, 10) === isoDow && (s.is_active === undefined || s.is_active == 1));
                        if (matchingSchedule) {
                            const startTime = matchingSchedule.start_time.slice(0, 5);
                            const endTime = matchingSchedule.end_time.slice(0, 5);
                            if (timeVal < startTime || timeVal > endTime) {
                                timeMsg = `Time ${timeVal} is outside Dr. ${selectedDoc.last_name}'s scheduled hours (${startTime} - ${endTime}).`;
                                hasError = true;
                            }
                        }
                    }
                }
            }
        }

        // Render live feedback
        if (dateMsg) {
            dateInput.classList.add('is-invalid');
            if (dateErr) dateErr.textContent = dateMsg;
        } else {
            dateInput.classList.remove('is-invalid');
            if (dateErr) dateErr.textContent = '';
        }

        if (timeMsg) {
            timeInput.classList.add('is-invalid');
            if (timeErr) timeErr.textContent = timeMsg;
        } else {
            timeInput.classList.remove('is-invalid');
            if (timeErr) timeErr.textContent = '';
        }

        if (warningBanner && warningText) {
            if (bannerMsg) {
                warningText.innerHTML = bannerMsg;
                warningBanner.style.display = 'flex';
            } else {
                warningBanner.style.display = 'none';
                warningText.innerHTML = '';
            }
        }

        return !hasError;
    },

    validateForm(payload) {
        const errors = {};
        if (!payload.patient_id) errors.patient_id = 'Please choose a patient.';
        if (!payload.doctor_id) errors.doctor_id = 'Please choose a doctor.';

        const now = new Date();
        const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);

        if (!payload.appointment_date) {
            errors.appointment_date = 'Please pick a date.';
        } else if (payload.appointment_date < localTodayStr) {
            errors.appointment_date = 'Past dates cannot be selected. Please choose today or an upcoming date.';
        } else {
            const parts = payload.appointment_date.split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const jsDow = d.getDay();
                const isoDow = jsDow === 0 ? 7 : jsDow;
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                if (jsDow === 0) {
                    errors.appointment_date = 'The clinic is closed on Sundays. Please choose Monday through Saturday.';
                } else if (payload.doctor_id) {
                    const doc = this.state.doctors.find(docItem => String(docItem.doctor_id) === String(payload.doctor_id));
                    if (doc && Array.isArray(doc.schedules) && doc.schedules.length > 0) {
                        const sched = doc.schedules.find(s => parseInt(s.day_of_week, 10) === isoDow && (s.is_active === undefined || s.is_active == 1));
                        if (!sched) {
                            errors.appointment_date = `Dr. ${doc.last_name} is not on duty on ${dayNames[jsDow]}. Available duty days: ${doc.schedule_summary || 'other days'}.`;
                        }
                    }
                }
            }
        }

        if (!payload.appointment_time) {
            errors.appointment_time = 'Please pick a time.';
        } else {
            const timeStr = payload.appointment_time;
            if (timeStr < '08:00' || timeStr > '17:00') {
                errors.appointment_time = 'Appointments can only be scheduled between 08:00 and 17:00.';
            } else {
                const hour = parseInt(timeStr.split(':')[0], 10);
                if (hour === 12) {
                    errors.appointment_time = 'The clinic is closed for lunch between 12:00 and 12:59.';
                } else if (payload.doctor_id && payload.appointment_date) {
                    const doc = this.state.doctors.find(docItem => String(docItem.doctor_id) === String(payload.doctor_id));
                    if (doc && Array.isArray(doc.schedules) && doc.schedules.length > 0) {
                        const parts = payload.appointment_date.split('-');
                        if (parts.length === 3) {
                            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                            const isoDow = d.getDay() === 0 ? 7 : d.getDay();
                            const sched = doc.schedules.find(s => parseInt(s.day_of_week, 10) === isoDow && (s.is_active === undefined || s.is_active == 1));
                            if (sched) {
                                const startH = sched.start_time.slice(0, 5);
                                const endH = sched.end_time.slice(0, 5);
                                if (timeStr < startH || timeStr > endH) {
                                    errors.appointment_time = `Appointment time is outside Dr. ${doc.last_name}'s hours (${startH} - ${endH}).`;
                                }
                            }
                        }
                    }
                }
            }
        }

        this.clearFormErrors();
        if (Object.keys(errors).length > 0) {
            this.showFormErrors(errors);
            this.validateAppointmentScheduleLive();
            return false;
        }
        return true;
    },

    async saveAppointment() {
        const patSelect = this.container.querySelector('#appt-patient');
        const docSelect = this.container.querySelector('#appt-doctor');
        const patientVal = (patSelect && patSelect.value) || (this.patientPicker && this.patientPicker.getValue()) || '0';
        const doctorVal = (docSelect && docSelect.value) || (this.doctorPicker && this.doctorPicker.getValue()) || '0';
        const allergiesInput = this.container.querySelector('#appt-allergies');

        const payload = {
            patient_id: parseInt(patientVal, 10),
            doctor_id: parseInt(doctorVal, 10),
            appointment_date: this.container.querySelector('#appt-date').value,
            appointment_time: this.container.querySelector('#appt-time').value,
            chief_complaint: this.container.querySelector('#appt-complaint').value.trim(),
            allergies_alerts: allergiesInput ? allergiesInput.value.trim() : null,
            blood_pressure: this.container.querySelector('#appt-bp').value.trim(),
            temperature: this.container.querySelector('#appt-temp').value.trim(),
            oxygen_saturation: this.container.querySelector('#appt-o2').value.trim()
        };

        if (this.state.activeEditId) {
            payload.status = this.state.activeEditStatus;
        }

        if (!this.validateForm(payload) || !this.validateAppointmentScheduleLive()) return;

        const saveBtn = this.container.querySelector('#btn-save-appointment');
        saveBtn.disabled = true;

        try {
            let res;
            if (this.state.activeEditId) {
                res = await api.put(`api/appointment_controller.php?id=${this.state.activeEditId}`, payload);
            } else {
                res = await api.post('api/appointment_controller.php', payload);
            }
            
            if (res.success) {
                const newAppointmentId = res.data ? res.data.appointment_id : null;
                let patientLabel = '';
                if (patSelect && patSelect.selectedIndex >= 0 && patSelect.value) {
                    patientLabel = patSelect.options[patSelect.selectedIndex]?.textContent || '';
                } else if (this.patientPicker) {
                    patientLabel = this.patientPicker.getLabel() || '';
                }
                this.state.isDirty = false;
                showToast(this.state.activeEditId ? 'Appointment updated successfully.' : 'Appointment scheduled successfully.', 'success');
                
                const alertBox = this.container.querySelector('#appointments-capacity-alert');
                const alertMsg = this.container.querySelector('#appointments-capacity-alert-message');
                if (res.data && res.data.warning) {
                    if (alertBox && alertMsg) {
                        alertMsg.textContent = res.data.warning;
                        alertBox.style.display = 'flex';
                    }
                } else {
                    if (alertBox) alertBox.style.display = 'none';
                }

                this.container.querySelector('#appointment-form').reset();
                if (this.patientPicker) this.patientPicker.clear();
                if (this.doctorPicker) this.doctorPicker.clear();
                this.clearFormErrors();
                const docSelect = this.container.querySelector('#appt-doctor');
                if (docSelect) docSelect.value = '';
                this.syncDoctorComboboxFromSelect();
                closeModal('appointment-form-modal');
                await this.loadData();

                if (newAppointmentId && !this.state.activeEditId) {
                    this.pendingPrintId = newAppointmentId;
                    const promptEl = this.container.querySelector('#print-prompt-patient');
                    if (promptEl) promptEl.textContent = patientLabel || 'this patient';
                    openModal('print-prompt-modal');
                }
            } else {
                this.showFormErrors(res.errors || {});
                showToast(res.message || (this.state.activeEditId ? 'Failed to update appointment.' : 'Failed to schedule appointment.'), 'error');
            }
        } catch (err) {
            const data = err.response?.data || {};
            this.showFormErrors(data.errors || {});
            showToast(data.message || (this.state.activeEditId ? 'Failed to update appointment.' : 'Failed to schedule appointment.'), 'error');
        } finally {
            saveBtn.disabled = false;
        }
    },
    
    updateStatus(id, newStatus) {
        const statusMap = {
            confirmed: 'confirm',
            cancelled: 'cancel',
            no_show: 'mark as No Show'
        };
        const actionText = statusMap[newStatus];
        
        confirmAction({
            title: `Confirm Status Change`,
            message: `Are you sure you want to ${actionText} this appointment?`,
            btnText: actionText.charAt(0).toUpperCase() + actionText.slice(1),
            btnClass: newStatus === 'cancelled' || newStatus === 'no_show' ? 'btn btn-danger' : 'btn btn-success',
            onConfirm: async () => {
                const appt = this.state.appointments.find(a => a.appointment_id === id);
                if (!appt) return;
                
                const payload = {
                    patient_id: appt.patient_id,
                    doctor_id: appt.doctor_id,
                    appointment_date: appt.appointment_date,
                    appointment_time: appt.appointment_time,
                    chief_complaint: appt.chief_complaint || '',
                    blood_pressure: appt.blood_pressure || '',
                    temperature: appt.temperature || '',
                    oxygen_saturation: appt.oxygen_saturation || '',
                    status: newStatus
                };

                try {
                    const res = await api.put(`api/appointment_controller.php?id=${id}`, payload);
                    if (res.success) {
                        showToast('Status updated successfully.', 'success');
                        await this.loadData();
                    } else {
                        showToast(res.message || 'Failed to update status.', 'error');
                    }
                } catch (err) {
                    showToast(err.response?.data?.message || 'Failed to update status.', 'error');
                }
            }
        });
    },

    patientOption(p) {
        const name = `${p.last_name}, ${p.first_name}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;
        return { value: p.patient_id, label: name };
    },

    async openWalkinModal() {
        if (this.walkinPending) return;
        this.resetWalkinForm();
        this.state.isWalkinDirty = false;
        
        const title = this.container.querySelector('#walkin-modal-title');
        const saveBtn = this.container.querySelector('#btn-save-walkin');

        if (this.state.activeEditId) {
            title.textContent = 'Edit Patient Details';
            saveBtn.textContent = 'Save Changes';
            this.setWalkinStatus('Loading patient details...');
            try {
                const res = await api.get(`api/appointment_patient_controller.php?appointment_id=${this.state.activeEditId}`);
                if (res.success && res.data) {
                    this.container.querySelector('#walkin-first').value = res.data.first_name || '';
                    this.container.querySelector('#walkin-middle').value = res.data.middle_initial || '';
                    this.container.querySelector('#walkin-last').value = res.data.last_name || '';
                    
                    const genderSelect = this.container.querySelector('#walkin-gender');
                    const standardGenders = ['Male', 'Female', 'Unknown'];
                    if (res.data.gender && !standardGenders.includes(res.data.gender)) {
                        genderSelect.value = 'Other';
                        this.container.querySelector('#walkin-custom-gender-group').style.display = 'block';
                        this.container.querySelector('#walkin-custom-gender').value = res.data.gender;
                    } else {
                        genderSelect.value = res.data.gender || '';
                    }
                    
                    this.container.querySelector('#walkin-dob').value = res.data.date_of_birth || '';
                    this.container.querySelector('#walkin-contact').value = res.data.contact_no || '';
                    this.container.querySelector('#walkin-address').value = res.data.address || '';
                    const walkinAllergies = this.container.querySelector('#walkin-allergies');
                    if (walkinAllergies) walkinAllergies.value = res.data.allergies_alerts || '';
                }
            } catch (err) {
                this.setWalkinStatus('Failed to load patient details. You may not have permission.');
            } finally {
                if (this.container.querySelector('#walkin-status').textContent === 'Loading patient details...') {
                    this.setWalkinStatus('');
                }
            }
        } else {
            title.textContent = 'Register Walk-in Patient';
            saveBtn.textContent = 'Register & Select';
            const walkinAllergies = this.container.querySelector('#walkin-allergies');
            if (walkinAllergies) walkinAllergies.value = '';
        }

        // Swap modals instead of nesting them. closeModal() only removes .active, so every
        // appointment field the Receptionist already filled in stays exactly as it was.
        this.walkinReturnPending = true;
        this.walkinRegisteredId = null;
        this.bypassingDirtyCheck = true;
        closeModal(this.container.querySelector('#appointment-form-modal'), true);
        openModal(this.container.querySelector('#walkin-form-modal'));
        this.bypassingDirtyCheck = false;
        this.container.querySelector('#walkin-first').focus();
    },

    returnToAppointmentForm() {
        openModal('appointment-form-modal');
        const target = this.walkinRegisteredId
            ? this.container.querySelector('#appt-patient')
            : this.container.querySelector('#btn-open-walkin');
        if (target) target.focus();
    },

    resetWalkinForm() {
        this.container.querySelector('#walkin-form').reset();
        this.clearWalkinErrors();
        this.setWalkinStatus('');
        this.walkinUncertain = false;
        this.container.querySelector('#walkin-custom-gender-group').style.display = 'none';
        this.container.querySelector('#walkin-custom-gender').value = '';
        const walkinAllergies = this.container.querySelector('#walkin-allergies');
        if (walkinAllergies) walkinAllergies.value = '';
        this.container.querySelector('#btn-save-walkin').textContent = 'Register & Select';
    },

    clearWalkinErrors() {
        this.container.querySelectorAll('#walkin-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
        this.container.querySelectorAll('#walkin-form .invalid-feedback').forEach(el => { el.textContent = ''; });
    },

    setWalkinStatus(message) {
        const box = this.container.querySelector('#walkin-status');
        box.textContent = message;
        box.style.display = message ? 'block' : 'none';
    },

    showWalkinErrors(errors) {
        const idMap = {
            first_name: 'first', middle_initial: 'middle', last_name: 'last', gender: 'gender',
            date_of_birth: 'dob', contact_no: 'contact', address: 'address', custom_gender: 'custom-gender',
            allergies_alerts: 'allergies'
        };
        let firstInvalid = null;
        Object.entries(errors || {}).forEach(([key, msg]) => {
            const id = idMap[key];
            if (!id) return;
            const el = this.container.querySelector(`#walkin-${id}`);
            const errEl = this.container.querySelector(`#walkin-${id}-error`);
            if (el) {
                el.classList.add('is-invalid');
                if (!firstInvalid) firstInvalid = el;
            }
            if (errEl) errEl.textContent = msg;
        });
        if (firstInvalid) firstInvalid.focus();
    },

    setWalkinPending(pending) {
        this.walkinPending = pending;
        const saveBtn = this.container.querySelector('#btn-save-walkin');
        saveBtn.disabled = pending;
        if (pending) saveBtn.textContent = 'Registering...';
        this.container.querySelectorAll('#walkin-form-modal [data-close-modal]').forEach(btn => {
            btn.disabled = pending;
        });
    },

    async saveWalkinPatient() {
        // Guard against double clicks / repeated Enter while a request is in flight.
        if (this.walkinPending) return;

        const form = this.container.querySelector('#walkin-form');
        let gender = form.querySelector('#walkin-gender').value;
        const customGender = form.querySelector('#walkin-custom-gender').value.trim();

        if (gender === 'Other') {
            if (!customGender) {
                this.showWalkinErrors({ custom_gender: 'Please specify the custom gender.' });
                return;
            }
            gender = customGender;
        }

        const allergiesInput = form.querySelector('#walkin-allergies');
        const payload = {
            first_name: form.querySelector('#walkin-first').value.trim(),
            middle_initial: form.querySelector('#walkin-middle').value.trim(),
            last_name: form.querySelector('#walkin-last').value.trim(),
            gender: gender,
            date_of_birth: form.querySelector('#walkin-dob').value,
            contact_no: form.querySelector('#walkin-contact').value.trim(),
            address: form.querySelector('#walkin-address').value.trim(),
            allergies_alerts: allergiesInput ? allergiesInput.value.trim() : null
        };

        this.clearWalkinErrors();
        this.setWalkinStatus('');
        this.setWalkinPending(true);
        let outcome = 'failed';

        try {
            if (this.state.activeEditId) {
                const res = await api.put(`api/appointment_patient_controller.php?appointment_id=${this.state.activeEditId}`, payload, { timeout: 15000 });
                if (res && res.success) {
                    outcome = 'updated';
                    const updatedId = res.data.patient_id;
                    
                    // Update patient in select options
                    const pIndex = this.state.patients.findIndex(p => Number(p.patient_id) === Number(updatedId));
                    if (pIndex !== -1) {
                        this.state.patients[pIndex].first_name = payload.first_name;
                        this.state.patients[pIndex].middle_initial = payload.middle_initial;
                        this.state.patients[pIndex].last_name = payload.last_name;
                        this.state.patients[pIndex].allergies_alerts = payload.allergies_alerts;
                        this.state.patients[pIndex].allergies_confirmed_by_doctor = 0;
                    }
                    
                    const patSelect = this.container.querySelector('#appt-patient');
                    this.renderSelect(patSelect, this.state.patients, (p) => this.patientOption(p), 'Select Patient');
                    patSelect.value = String(updatedId);

                    const apptAllergiesInput = this.container.querySelector('#appt-allergies');
                    if (apptAllergiesInput) apptAllergiesInput.value = payload.allergies_alerts || '';
                    this.renderAllergyBadge(payload.allergies_alerts || '', 0);
                    
                    showToast(`Patient details updated successfully.`, 'success');
                    this.state.isWalkinDirty = false;
                } else {
                    outcome = 'uncertain';
                }
            } else {
                const res = await api.post('api/walkin_patient_controller.php', payload, { timeout: 15000 });
                const newId = res && res.success && res.data ? parseInt(res.data.patient_id, 10) : 0;
                if (newId > 0) {
                    outcome = 'created';
                    this.walkinRegisteredId = newId;

                    // Add only this newly created patient (returned by ID) to the appointment options.
                    if (!this.state.patients.some(p => Number(p.patient_id) === newId)) {
                        this.state.patients.push({
                            patient_id: newId,
                            first_name: payload.first_name,
                            middle_initial: payload.middle_initial,
                            last_name: payload.last_name,
                            allergies_alerts: payload.allergies_alerts,
                            allergies_confirmed_by_doctor: 0
                        });
                    }
                    const patSelect = this.container.querySelector('#appt-patient');
                    this.renderSelect(patSelect, this.state.patients, (p) => this.patientOption(p), 'Select Patient');
                    patSelect.value = String(newId);
                    patSelect.classList.remove('is-invalid');
                    if (this.patientPicker) {
                        this.patientPicker.setValue(newId, `${payload.last_name}, ${payload.first_name}`);
                        this.patientPicker.setInvalid(false);
                    }
                    const patErr = this.container.querySelector('#appt-patient-error');
                    if (patErr) patErr.textContent = '';

                    const apptAllergiesInput = this.container.querySelector('#appt-allergies');
                    if (apptAllergiesInput) apptAllergiesInput.value = payload.allergies_alerts || '';
                    this.renderAllergyBadge(payload.allergies_alerts || '', 0);

                    showToast('Walk-in patient registered and selected. Review the appointment, then schedule it.', 'success');
                    this.state.isWalkinDirty = false;
                } else {
                    // A 2xx without a patient ID: the server answered but we cannot tell what happened.
                    outcome = 'uncertain';
                }
            }
        } catch (err) {
            if (!err.response) {
                // Network failure/timeout: the request may or may not have reached the server.
                outcome = 'uncertain';
            } else {
                const data = err.response.data || {};
                this.showWalkinErrors(data.errors || {});
                showToast(data.message || 'Failed to register patient.', 'danger');
            }
        } finally {
            this.setWalkinPending(false);
        }

        const saveBtn = this.container.querySelector('#btn-save-walkin');
        if (outcome === 'created') {
            saveBtn.textContent = 'Register & Select';
            // Closing triggers the observer, which reopens the appointment form with the draft intact.
            closeModal('walkin-form-modal');
        } else if (outcome === 'updated') {
            saveBtn.textContent = 'Save Changes';
            closeModal('walkin-form-modal');
        } else if (outcome === 'uncertain') {
            this.walkinUncertain = true;
            saveBtn.textContent = 'Retry Request';
            this.setWalkinStatus(
                'The connection failed before the server confirmed the request. ' +
                'Please verify with an Administrator if you are unsure before proceeding.'
            );
            showToast('Request outcome unknown. Proceed with caution.', 'warning');
        } else {
            saveBtn.textContent = this.walkinUncertain ? 'Retry Request' : (this.state.activeEditId ? 'Save Changes' : 'Register & Select');
        }
    },

    destroy() {
        if (this.patientPicker) {
            this.patientPicker.destroy();
            this.patientPicker = null;
        }
        if (this.doctorPicker) {
            this.doctorPicker.destroy();
            this.doctorPicker = null;
        }
    }
};
