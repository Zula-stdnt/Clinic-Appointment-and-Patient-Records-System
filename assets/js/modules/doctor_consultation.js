// assets/js/modules/doctor_consultation.js
// Clinical Consultation Module
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms (Header-Detail state arrays & nested JSON payload) & 01 JavaScript Foundations/javascript_objects_and_arrays (Factory functions for detail items & <select> display/value mapping)

import api from '../api.js?v=7';
import { create, escapeHtml, showToast } from '../ui.js?v=22';

// Factory functions for uniform detail-row objects (javascript_objects_and_arrays.md)
const createEmptyDiagnosis = () => ({ diagnosis_name: '', icd10_code: '', notes: '' });
const createEmptyPrescription = () => ({ medication_id: '', dosage: '', frequency: '' });
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
        medications: []
    },

    async init(container, param) {
        this.container = container;

        // Reset state to prevent stale data from a previous consultation
        this.state = {
            appointmentId: param ? parseInt(param, 10) : null,
            appointment: null,
            vitals: null,
            consultation: null,
            diagnoses: [],
            prescriptions: [],
            lab_requests: [],
            medications: []
        };

        if (!this.state.appointmentId) {
            this.container.innerHTML = '<div class="alert alert-danger">Invalid appointment ID.</div>';
            return;
        }

        this.renderSkeleton();
        
        await Promise.all([
            this.loadMedications(),
            this.loadConsultationData()
        ]);

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

    async loadMedications() {
        try {
            const res = await api.get('api/medication_controller.php');
            if (res.success && res.data && res.data.items) {
                this.state.medications = res.data.items;
            }
        } catch (err) {
            console.error('Failed to load medications', err);
        }
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

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancel-consult">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="btn-save-consultation">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save & Complete Encounter
                    </button>
                </div>
            </form>
        `;

        this.renderDiagnoses();
        this.renderPrescriptions();
        this.renderLabs();
    },

    renderDiagnoses() {
        const container = this.container.querySelector('#diagnoses-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (this.state.diagnoses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No diagnoses added.</p>';
            return;
        }

        this.state.diagnoses.forEach((diag, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;';
            row.innerHTML = `
                <div style="flex: 2;">
                    <input type="text" class="form-control" placeholder="Diagnosis (e.g. Hypertension)" value="${escapeHtml(diag.diagnosis_name || '')}" data-type="diagnosis" data-index="${index}" data-field="diagnosis_name">
                </div>
                <div style="flex: 1;">
                    <input type="text" class="form-control" placeholder="ICD-10 (Optional)" value="${escapeHtml(diag.icd10_code || '')}" data-type="diagnosis" data-index="${index}" data-field="icd10_code">
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
        });
    },

    renderPrescriptions() {
        const container = this.container.querySelector('#prescriptions-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (this.state.prescriptions.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No prescriptions added.</p>';
            return;
        }

        const medOptions = this.state.medications.map(m => `<option value="${m.medication_id}">${escapeHtml(m.name)} ${m.generic_name ? '('+escapeHtml(m.generic_name)+')' : ''}</option>`).join('');

        this.state.prescriptions.forEach((rx, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start;';
            
            row.innerHTML = `
                <div style="flex: 2;">
                    <select class="form-control" data-type="prescription" data-index="${index}" data-field="medication_id">
                        <option value="" disabled ${!rx.medication_id ? 'selected' : ''}>Select Medication...</option>
                        ${medOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <input type="text" class="form-control" placeholder="Dosage (e.g. 500mg)" value="${escapeHtml(rx.dosage || '')}" data-type="prescription" data-index="${index}" data-field="dosage">
                </div>
                <div style="flex: 1;">
                    <input type="text" class="form-control" placeholder="Freq (e.g. 1 tab BID)" value="${escapeHtml(rx.frequency || '')}" data-type="prescription" data-index="${index}" data-field="frequency">
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.35rem 0.5rem; margin-top: 0.15rem;" data-remove-prescription="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            
            // Set selected value
            if (rx.medication_id) {
                const sel = row.querySelector('select');
                sel.value = rx.medication_id;
            }
            
            container.appendChild(row);
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
                <div style="flex: 1;">
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

        // Also capture <select> changes (medication dropdown)
        c.addEventListener('change', (e) => {
            if (e.target.matches('[data-type="prescription"][data-field="medication_id"]')) {
                const index = parseInt(e.target.getAttribute('data-index'), 10);
                this.state.prescriptions[index].medication_id = e.target.value;
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
                        window.navigateTo('doctor_appointments');
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
    }
};
