// assets/js/modules/doctor_consultation.js
// Clinical Consultation Module
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms (Header-Detail state arrays & nested JSON payload) & 01 JavaScript Foundations/javascript_objects_and_arrays (Factory functions for detail items & <select> display/value mapping)

import api from '../api.js?v=7';
import { create, escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=24';
import { SearchSelect } from '../components/search-select.js?v=1';
import { TimePicker } from '../components/time-picker.js?v=2';
import { printPrescription } from '../components/print-prescription.js?v=2';
import { printLabRequest } from '../components/print-lab-request.js?v=1';

// Factory functions for uniform detail-row objects (javascript_objects_and_arrays.md)
const createEmptyDiagnosis = () => ({ diagnosis_name: '', icd10_code: '', icd10_description: '', notes: '' });
const createEmptyPrescription = () => ({ medication_id: '', dosage: '', frequency: '', time_to_take: '' });
const createEmptyLabRequest = () => ({ test_name: '' });

export default {
    state: {
        appointmentId: null,
        appointment: null,
        vitals: null,
        consultation: null,
        diagnoses: [],
        prescriptions: [],
        lab_requests: [],
        medicationPickers: [],
        icd10Pickers: [],
        timePickers: []
    },

    async init(container, param) {
        this.container = container;

        // Dispose pickers from a previous consultation; their menus live in <body>
        this.disposePickers();

        // Reset state to prevent stale data from a previous consultation
        this.state = {
            appointmentId: param ? parseInt(param, 10) : null,
            appointment: null,
            vitals: null,
            consultation: null,
            diagnoses: [],
            prescriptions: [],
            lab_requests: [],
            medicationPickers: [],
            icd10Pickers: [],
            labPickers: [],
            timePickers: []
        };

        if (!this.state.appointmentId) {
            this.container.innerHTML = '<div class="alert alert-danger">Invalid appointment ID.</div>';
            return;
        }

        this.renderSkeleton();

        await this.loadConsultationData();

        this.renderUI();
        this.attachEventListeners();
    },

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="card" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                Loading consultation data...
            </div>
        `;
    },

    disposePickers() {
        ['medicationPickers', 'icd10Pickers', 'timePickers'].forEach(key => {
            if (this.state && Array.isArray(this.state[key])) {
                this.state[key].forEach(picker => picker.destroy());
                this.state[key] = [];
            }
        });
    },

    async loadConsultationData() {
        try {
            const res = await api.get(`api/consultation_controller.php?appointment_id=${this.state.appointmentId}`);
            if (res.success && res.data) {
                this.state.appointment = res.data.appointment;
                this.state.vitals = res.data.vitals;
                this.state.consultation = res.data.consultation;
                
                this.state.diagnoses = res.data.diagnoses || [];
                this.state.prescriptions = res.data.prescriptions || [];
                this.state.lab_requests = res.data.lab_requests || [];
                
                // If it's a new consultation, push one empty row for each to guide the user
                if (!this.state.consultation) {
                    this.state.diagnoses.push(createEmptyDiagnosis());
                    this.state.prescriptions.push(createEmptyPrescription());
                    this.state.lab_requests.push(createEmptyLabRequest());
                }
            } else {
                showToast(res.message || 'Failed to load consultation data', 'error');
            }
        } catch (err) {
            console.error('Failed to load consultation', err);
            const msg = err.response?.data?.message || 'Error loading consultation details';
            showToast(msg, 'error');
        }
    },

    renderUI() {
        if (!this.state.appointment) {
            this.container.innerHTML = '<div class="alert alert-danger">Could not load appointment details.</div>';
            return;
        }

        const appt = this.state.appointment;
        const vitals = this.state.vitals;
        const cons = this.state.consultation;

        let vitalsHtml = '<p style="color: var(--text-muted); margin: 0;">No vitals recorded for this appointment.</p>';
        if (vitals) {
            vitalsHtml = `
                <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                    <div><strong>BP:</strong> ${escapeHtml(vitals.blood_pressure || '--')} mmHg</div>
                    <div><strong>Temp:</strong> ${escapeHtml(vitals.temperature || '--')} &deg;C</div>
                    <div><strong>SpO2:</strong> ${escapeHtml(vitals.oxygen_saturation || '--')} %</div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem; background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.5rem;">${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</h2>
                        <div style="color: var(--text-muted); margin-top: 0.25rem;">Age: ${appt.age} | Gender: ${escapeHtml(appt.gender || 'Unknown')} | PAT-${appt.patient_id.toString().padStart(4, '0')}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">Chief Complaint</div>
                        <div style="color: var(--danger);">${escapeHtml(appt.chief_complaint || 'None provided')}</div>
                    </div>
                </div>
                <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border);">
                <div>
                    <h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--text);">Triage Vitals</h3>
                    ${vitalsHtml}
                </div>
            </div>

            <form id="consultation-form">
                <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 1rem;">Clinical Notes</h3>
                    <div class="form-group" style="margin-bottom: 0;">
                        <textarea id="cons-notes" class="form-control" rows="5" placeholder="Subjective, Objective, Assessment, Plan (SOAP) narrative...">${escapeHtml(cons?.notes || '')}</textarea>
                    </div>
                </div>

                <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.1rem; margin: 0;">Diagnosis</h3>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-diagnosis">
                            + Add Diagnosis
                        </button>
                    </div>
                    <div id="diagnoses-container"></div>
                </div>

                <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.1rem; margin: 0;">Prescriptions</h3>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-prescription">
                            + Add Rx
                        </button>
                    </div>
                    <div id="prescriptions-container"></div>
                </div>

                <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.1rem; margin: 0;">Lab Requests</h3>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-lab">
                            + Add Lab
                        </button>
                    </div>
                    <div id="labs-container"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary" id="btn-cancel-consult">Cancel</button>
                        ${cons ? `
                        <button type="button" class="btn btn-secondary" id="btn-print-rx">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.35rem;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print Prescription
                        </button>
                        <button type="button" class="btn btn-secondary" id="btn-print-lab" ${(this.state.consultation && this.state.lab_requests.length) ? '' : 'disabled'}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.35rem;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print Lab Request
                        </button>` : ''}
                    </div>
                    <button type="submit" class="btn btn-primary" id="btn-save-consultation">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save &amp; Complete Encounter
                    </button>
                </div>
            </form>

            <div class="modal" id="after-visit-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="after-visit-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="after-visit-title">Encounter Saved</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-top: 0;">The consultation for <strong>${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</strong> has been saved and the appointment marked as completed.</p>
                            <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 0;">Hand the printed prescription and/or laboratory request to the patient. Laboratory requests must be presented to the laboratory or diagnostic area before the procedure.</p>
                        </div>
                        <div class="modal-footer" style="justify-content: flex-start; gap: 0.5rem;">
                            <button type="button" class="btn btn-primary" id="btn-after-print-rx">Print Prescription</button>
                            <button type="button" class="btn btn-secondary" id="btn-after-print-lab">Print Lab Request</button>
                            <button type="button" class="btn btn-secondary" id="btn-after-done" style="margin-left: auto;">Done</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderDiagnoses();
        this.renderPrescriptions();
        this.renderLabs();
    },

    renderDiagnoses() {
        const container = this.container.querySelector('#diagnoses-container');
        if (!container) return;

        this.state.icd10Pickers.forEach(picker => picker.destroy());
        this.state.icd10Pickers = [];
        container.innerHTML = '';
        
        if (this.state.diagnoses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No diagnoses added.</p>';
            return;
        }

        // ICD-10 catalog type-ahead: selecting a code auto-fills the diagnosis name
        const remoteIcd10 = async (query) => {
            const res = await api.get('api/icd10_controller.php', { search: query });
            const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
            return items.map(c => ({
                value: c.code,
                label: `${c.code} — ${c.description}`,
                description: c.description
            }));
        };

        this.state.diagnoses.forEach((diag, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;';
            row.innerHTML = `
                <div style="flex: 2;">
                    <div class="dx-icd-picker"></div>
                </div>
                <div style="flex: 2;">
                    <input type="text" class="form-control" placeholder="Diagnosis (e.g. Hypertension)" value="${escapeHtml(diag.diagnosis_name || '')}" data-type="diagnosis" data-index="${index}" data-field="diagnosis_name">
                </div>
                <div style="flex: 2;">
                    <input type="text" class="form-control" placeholder="Notes (Optional)" value="${escapeHtml(diag.notes || '')}" data-type="diagnosis" data-index="${index}" data-field="notes">
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.35rem 0.5rem; margin-top: 0.15rem;" data-remove-diagnosis="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            container.appendChild(row);

            const picker = new SearchSelect({
                placeholder: 'Search ICD-10 code or diagnosis...',
                emptyText: 'No matching ICD-10 code found.',
                remote: remoteIcd10,
                value: diag.icd10_code || '',
                label: diag.icd10_code ? `${diag.icd10_code} — ${diag.icd10_description || diag.diagnosis_name || ''}` : '',
                onChange: (item) => {
                    const current = this.state.diagnoses[index];
                    if (!current) return;
                    if (item) {
                        current.icd10_code = item.value;
                        current.icd10_description = item.description || '';
                        if (item.description) {
                            current.diagnosis_name = item.description;
                            const nameInput = row.querySelector('[data-field="diagnosis_name"]');
                            if (nameInput) nameInput.value = item.description;
                        }
                    } else {
                        current.icd10_code = '';
                        current.icd10_description = '';
                    }
                }
            }).mount(row.querySelector('.dx-icd-picker'));

            this.state.icd10Pickers.push(picker);
        });
    },

    renderPrescriptions() {
        const container = this.container.querySelector('#prescriptions-container');
        if (!container) return;

        // Dispose pickers from the previous render so their document listeners are released
        this.state.medicationPickers.forEach(picker => picker.destroy());
        this.state.medicationPickers = [];
        this.state.timePickers.forEach(picker => picker.destroy());
        this.state.timePickers = [];

        container.innerHTML = '';

        if (this.state.prescriptions.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No prescriptions added.</p>';
            return;
        }

        // Type-ahead medication lookup: matches name, generic name, or manufacturer
        const remoteMedications = async (query) => {
            const res = await api.get('api/medication_controller.php', { search: query });
            const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
            return items.map(m => ({
                value: m.medication_id,
                label: `${m.name}${m.generic_name ? ` (${m.generic_name})` : ''}`,
                meta: m.manufacturer || ''
            }));
        };

        this.state.prescriptions.forEach((rx, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;';

            row.innerHTML = `
                <div style="flex: 2;">
                    <div class="rx-medication-picker"></div>
                </div>
                <div style="flex: 1;">
                    <input type="text" class="form-control" placeholder="Dosage (e.g. 500mg)" value="${escapeHtml(rx.dosage || '')}" data-type="prescription" data-index="${index}" data-field="dosage">
                </div>
                <div style="flex: 1;">
                    <input type="text" class="form-control" placeholder="Freq (e.g. 1 tab BID)" value="${escapeHtml(rx.frequency || '')}" data-type="prescription" data-index="${index}" data-field="frequency">
                </div>
                <div style="flex: 1.4;">
                    <div class="rx-time-picker"></div>
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.35rem 0.5rem; margin-top: 0.15rem;" data-remove-prescription="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;

            container.appendChild(row);

            const picker = new SearchSelect({
                placeholder: 'Type to search medication...',
                emptyText: 'No matching medication found.',
                remote: remoteMedications,
                value: rx.medication_id || '',
                label: rx.medication_id ? (rx.medication_name || `Medication #${rx.medication_id}`) : '',
                onChange: (item) => {
                    this.state.prescriptions[index].medication_id = item ? item.value : '';
                }
            }).mount(row.querySelector('.rx-medication-picker'));

            this.state.medicationPickers.push(picker);

            const timePicker = new TimePicker({
                placeholder: 'Set time...',
                value: rx.time_to_take || '',
                onChange: (value) => {
                    const current = this.state.prescriptions[index];
                    if (current) current.time_to_take = value;
                }
            }).mount(row.querySelector('.rx-time-picker'));

            this.state.timePickers.push(timePicker);
        });
    },

    renderLabs() {
        const container = this.container.querySelector('#labs-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.state.lab_requests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No lab requests added.</p>';
            return;
        }

        this.state.lab_requests.forEach((lab, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;';
            row.innerHTML = `
                <div style="flex: 2;">
                    <input type="text" class="form-control" placeholder="Test Name (e.g. Complete Blood Count)" value="${escapeHtml(lab.test_name || '')}" data-type="lab" data-index="${index}" data-field="test_name">
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.35rem 0.5rem; margin-top: 0.15rem;" data-remove-lab="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            container.appendChild(row);
        });
    },

    attachEventListeners() {
        const c = this.container;
        
        // Cancel button
        c.querySelector('#btn-cancel-consult')?.addEventListener('click', () => {
            window.navigateTo('doctor_appointments');
        });

        // Reprint actions for an already-saved consultation
        c.querySelector('#btn-print-rx')?.addEventListener('click', () => printPrescription(this.state.appointmentId));
        c.querySelector('#btn-print-lab')?.addEventListener('click', () => printLabRequest(this.state.appointmentId));

        // Add buttons using factory functions (javascript_objects_and_arrays.md)
        c.querySelector('#btn-add-diagnosis')?.addEventListener('click', () => {
            this.state.diagnoses.push(createEmptyDiagnosis());
            this.renderDiagnoses();
        });

        c.querySelector('#btn-add-prescription')?.addEventListener('click', () => {
            this.state.prescriptions.push(createEmptyPrescription());
            this.renderPrescriptions();
        });

        c.querySelector('#btn-add-lab')?.addEventListener('click', () => {
            this.state.lab_requests.push(createEmptyLabRequest());
            this.renderLabs();
        });

        // Event delegation for input changes to sync state
        c.addEventListener('input', (e) => {
            if (e.target.matches('[data-type]')) {
                const type = e.target.getAttribute('data-type');
                const index = parseInt(e.target.getAttribute('data-index'), 10);
                const field = e.target.getAttribute('data-field');
                
                if (type === 'diagnosis') {
                    this.state.diagnoses[index][field] = e.target.value;
                } else if (type === 'prescription') {
                    this.state.prescriptions[index][field] = e.target.value;
                } else if (type === 'lab') {
                    this.state.lab_requests[index][field] = e.target.value;
                }
            }
        });

        // Event delegation for remove buttons
        c.addEventListener('click', (e) => {
            const btnDiag = e.target.closest('[data-remove-diagnosis]');
            if (btnDiag) {
                const idx = parseInt(btnDiag.getAttribute('data-remove-diagnosis'), 10);
                this.state.diagnoses.splice(idx, 1);
                this.renderDiagnoses();
            }

            const btnRx = e.target.closest('[data-remove-prescription]');
            if (btnRx) {
                const idx = parseInt(btnRx.getAttribute('data-remove-prescription'), 10);
                this.state.prescriptions.splice(idx, 1);
                this.renderPrescriptions();
            }

            const btnLab = e.target.closest('[data-remove-lab]');
            if (btnLab) {
                const idx = parseInt(btnLab.getAttribute('data-remove-lab'), 10);
                this.state.lab_requests.splice(idx, 1);
                this.renderLabs();
            }
        });

        // Submit form
        const form = c.querySelector('#consultation-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSave = c.querySelector('#btn-save-consultation');
                btnSave.disabled = true;
                btnSave.textContent = 'Saving...';

                const payload = {
                    appointment_id: this.state.appointmentId,
                    notes: c.querySelector('#cons-notes').value.trim(),
                    diagnoses: this.state.diagnoses.filter(d => d.diagnosis_name.trim() !== ''),
                    prescriptions: this.state.prescriptions.filter(p => p.medication_id !== '' && p.dosage.trim() !== '' && p.frequency.trim() !== ''),
                    lab_requests: this.state.lab_requests.filter(l => l.test_name.trim() !== '')
                };

                try {
                    const res = await api.post('api/consultation_controller.php', payload);
                    if (res.success) {
                        showToast('Encounter saved successfully.', 'success');
                        this.showAfterVisitActions();
                    } else {
                        showToast(res.message || 'Failed to save encounter.', 'error');
                        btnSave.disabled = false;
                        btnSave.textContent = 'Save & Complete Encounter';
                    }
                } catch (err) {
                    console.error('Error saving consultation', err);
                    const msg = err.response?.data?.message || 'An unexpected error occurred.';
                    showToast(msg, 'error');
                    btnSave.disabled = false;
                    btnSave.textContent = 'Save & Complete Encounter';
                }
            });
        }
    },

    showAfterVisitActions() {
        const modal = this.container.querySelector('#after-visit-modal');
        if (!modal) {
            window.navigateTo('doctor_appointments');
            return;
        }

        const hasRx = this.state.prescriptions.some(p => p.medication_id && String(p.dosage).trim() !== '' && String(p.frequency).trim() !== '');
        const hasLabs = this.state.lab_requests.some(l => String(l.test_name).trim() !== '');

        const rxBtn = modal.querySelector('#btn-after-print-rx');
        const labBtn = modal.querySelector('#btn-after-print-lab');
        const doneBtn = modal.querySelector('#btn-after-done');

        rxBtn.disabled = !hasRx;
        labBtn.disabled = !hasLabs;
        rxBtn.onclick = () => printPrescription(this.state.appointmentId);
        labBtn.onclick = () => printLabRequest(this.state.appointmentId);
        doneBtn.onclick = () => {
            closeModal('after-visit-modal');
            window.navigateTo('doctor_appointments');
        };

        openModal('after-visit-modal');
    }
};
