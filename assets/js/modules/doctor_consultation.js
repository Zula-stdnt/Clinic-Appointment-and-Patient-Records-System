// assets/js/modules/doctor_consultation.js
// Clinical Consultation Module with SOAP Clinical Notes and Structured Prescriptions
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms & 01 JavaScript Foundations/javascript_objects_and_arrays

import api from '../api.js?v=8';
import { create, escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=26';
import { SearchSelect } from '../components/search-select.js?v=1';
import { printPrescription } from '../components/print-prescription.js?v=2';
import { printLabRequest } from '../components/print-lab-request.js?v=1';

// Standard clinical route options
const CLINICAL_ROUTES = [
    { value: 'Oral (PO)', label: 'Oral (PO)' },
    { value: 'Sublingual (SL)', label: 'Sublingual (SL)' },
    { value: 'Topical', label: 'Topical' },
    { value: 'Inhalation', label: 'Inhalation' },
    { value: 'Intramuscular (IM)', label: 'Intramuscular (IM)' },
    { value: 'Intravenous (IV)', label: 'Intravenous (IV)' },
    { value: 'Subcutaneous (SC)', label: 'Subcutaneous (SC)' },
    { value: 'Ophthalmic (Eye)', label: 'Ophthalmic (Eye)' },
    { value: 'Otic (Ear)', label: 'Otic (Ear)' },
    { value: 'Nasal', label: 'Nasal' },
    { value: 'Rectal (PR)', label: 'Rectal (PR)' },
    { value: 'Other', label: 'Other' }
];

// Quick frequency presets for datalist autocomplete
const FREQUENCY_PRESETS = [
    'Once daily (OD)',
    'Twice daily (BID)',
    'Three times daily (TID)',
    'Four times daily (QID)',
    'Every 4 hours (Q4H)',
    'Every 6 hours (Q6H)',
    'Every 8 hours (Q8H)',
    'Every 12 hours (Q12H)',
    'At bedtime (QHS)',
    'As needed (PRN)',
    'Before meals (AC)',
    'After meals (PC)'
];

// Common laboratory and diagnostic tests for datalist autocomplete
const COMMON_LAB_PRESETS = [
    'Complete Blood Count (CBC) with Platelet',
    'Fasting Blood Sugar (FBS)',
    'Random Blood Sugar (RBS)',
    'Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)',
    'Serum Creatinine & BUN',
    'Liver Function Test (SGPT/ALT, SGOT/AST)',
    'Urinalysis (Routine)',
    'Fecalysis (Routine)',
    'Chest X-Ray (PA View)',
    'Electrocardiogram (ECG 12-Lead)',
    'HbA1c (Glycated Hemoglobin)',
    'Serum Uric Acid',
    'Thyroid Panel (TSH, FT3, FT4)'
];

// Factory functions for uniform detail-row objects
const createEmptyDiagnosis = () => ({ diagnosis_name: '', icd10_code: '', icd10_description: '', notes: '' });
const createEmptyPrescription = () => ({
    medication_id: '',
    medication_name: '',
    strength: '',
    dosage: '',
    route: 'Oral (PO)',
    frequency: '',
    duration: '',
    instructions: '',
    time_to_take: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: ''
});
const createEmptyLabRequest = () => ({ test_name: '' });

// SOAP Parser & Compiler functions
function parseSoapNotes(rawNotes) {
    const res = { subjective: '', objective: '', assessment: '', plan: '' };
    if (!rawNotes || typeof rawNotes !== 'string') return res;
    const text = rawNotes.trim();
    const regex = /(?:^|\n)\s*(?:\[?(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\]?):?\s*([\s\S]*?)(?=(?:\n\s*(?:\[?(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\]?):?)|$)/gi;
    let match;
    let foundAny = false;
    while ((match = regex.exec(text)) !== null) {
        const key = match[1].toLowerCase();
        if (key in res) {
            let val = match[2].trim();
            if (val.toLowerCase() === 'none recorded.') val = '';
            res[key] = val;
            foundAny = true;
        }
    }
    if (!foundAny) {
        // Legacy plain text note without headers: place into Subjective
        res.subjective = text;
    }
    return res;
}

function compileSoapNotes(soap) {
    if (!soap) return '';
    const s = (soap.subjective || '').trim();
    const o = (soap.objective || '').trim();
    const a = (soap.assessment || '').trim();
    const p = (soap.plan || '').trim();
    if (!s && !o && !a && !p) return '';
    return [
        'SUBJECTIVE:',
        s || 'None recorded.',
        '',
        'OBJECTIVE:',
        o || 'None recorded.',
        '',
        'ASSESSMENT:',
        a || 'None recorded.',
        '',
        'PLAN:',
        p || 'None recorded.'
    ].join('\n');
}

export default {
    state: {
        appointmentId: null,
        appointment: null,
        vitals: null,
        consultation: null,
        soap: {
            subjective: '',
            objective: '',
            assessment: '',
            plan: ''
        },
        diagnoses: [],
        prescriptions: [],
        lab_requests: [],
        addenda: [],
        medicationPickers: [],
        icd10Pickers: []
    },

    async init(container, param) {
        this.container = container;

        // Dispose pickers from a previous consultation
        this.disposePickers();

        // Reset state
        this.state = {
            appointmentId: param ? parseInt(param, 10) : null,
            appointment: null,
            vitals: null,
            consultation: null,
            soap: {
                subjective: '',
                objective: '',
                assessment: '',
                plan: ''
            },
            diagnoses: [],
            prescriptions: [],
            lab_requests: [],
            addenda: [],
            medicationPickers: [],
            icd10Pickers: []
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
            <div class="card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                <div style="font-weight: 500; font-size: 1rem;">Loading consultation data...</div>
            </div>
        `;
    },

    disposePickers() {
        ['medicationPickers', 'icd10Pickers'].forEach(key => {
            if (this.state && Array.isArray(this.state[key])) {
                this.state[key].forEach(picker => picker && picker.destroy && picker.destroy());
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
                this.state.addenda = res.data.addenda || [];
                
                // Load SOAP notes
                if (this.state.consultation) {
                    if (this.state.consultation.soap) {
                        this.state.soap = {
                            subjective: this.state.consultation.soap.subjective || '',
                            objective: this.state.consultation.soap.objective || '',
                            assessment: this.state.consultation.soap.assessment || '',
                            plan: this.state.consultation.soap.plan || ''
                        };
                    } else {
                        this.state.soap = parseSoapNotes(this.state.consultation.notes || '');
                    }
                } else {
                    this.state.soap = { subjective: '', objective: '', assessment: '', plan: '' };
                    // For new encounters, seed one empty row to guide the clinician
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

    renderAddendaHtml() {
        if (!this.state.addenda || this.state.addenda.length === 0) {
            return '<p style="color: var(--text-muted); margin: 0; font-size: 0.9rem;">No addenda recorded for this encounter.</p>';
        }
        return this.state.addenda.map(a => `
            <div style="background: var(--bg-alt, #f8fafc); border-left: 3px solid var(--primary, #107c41); padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.35rem;">
                    <span style="font-weight: 600; color: var(--text);">${escapeHtml(a.author_name || 'Clinician')}</span>
                    <span>${escapeHtml(a.created_at || '')}</span>
                </div>
                <div style="font-size: 0.9rem; white-space: pre-wrap; color: var(--text);">${escapeHtml(a.notes || '')}</div>
            </div>
        `).join('');
    },

    renderUI() {
        if (!this.state.appointment) {
            this.container.innerHTML = '<div class="alert alert-danger">Could not load appointment details.</div>';
            return;
        }

        const appt = this.state.appointment;
        const vitals = this.state.vitals;
        const cons = this.state.consultation;
        const soap = this.state.soap || { subjective: '', objective: '', assessment: '', plan: '' };

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

        const isReadOnly = !['scheduled', 'confirmed'].includes(appt.status);

        const allergyBannerHtml = appt.allergies_alerts ? `
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.75rem 1rem; margin-bottom: 1.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div style="color: #991b1b; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    ALLERGY ALERT: ${escapeHtml(appt.allergies_alerts)}
                </div>
                <div>
                    ${appt.allergies_confirmed_by_doctor ? '<span class="badge badge-status-completed" style="white-space: nowrap;">Doctor Confirmed</span>' : '<span class="badge badge-status-confirmed" style="white-space: nowrap;">Unconfirmed Intake Note</span>'}
                </div>
            </div>
        ` : `
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; margin-bottom: 1.25rem; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;">
                <div style="color: #92400e; font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    No allergy info recorded for this patient. Please verify with patient during intake.
                </div>
            </div>
        `;

        this.container.innerHTML = `
            ${allergyBannerHtml}

            <!-- Patient Demographic & Intake Summary Card -->
            <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem; background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.5rem;">${escapeHtml(appt.patient_first)} ${escapeHtml(appt.patient_last)}</h2>
                        <div style="color: var(--text-muted); margin-top: 0.25rem;">Age: ${appt.age} | Gender: ${escapeHtml(appt.gender || 'Unknown')}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">Chief Complaint</div>
                        <div style="color: var(--danger); font-weight: 500;">${escapeHtml(appt.chief_complaint || 'None provided')}</div>
                    </div>
                </div>
                <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border);">
                <div>
                    <h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--text);">Triage Vitals</h3>
                    ${vitalsHtml}
                </div>
            </div>

            <!-- Datalists for rapid autocomplete -->
            <datalist id="rx-frequency-list">
                ${FREQUENCY_PRESETS.map(f => `<option value="${escapeHtml(f)}"></option>`).join('')}
            </datalist>
            <datalist id="common-labs-list">
                ${COMMON_LAB_PRESETS.map(l => `<option value="${escapeHtml(l)}"></option>`).join('')}
            </datalist>

            <form id="consultation-form">
                <fieldset ${isReadOnly ? 'disabled' : ''} style="border: none; padding: 0; margin: 0;">
                    
                    <!-- 1. Allergies & Medical Alerts -->
                    <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <h3 style="font-size: 1.15rem; margin: 0;">Allergies &amp; Clinical Alerts</h3>
                            ${!isReadOnly ? `
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn btn-secondary btn-sm" id="btn-set-nkda" style="font-size: 0.8rem;">Set NKDA</button>
                                </div>
                            ` : ''}
                        </div>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">Document known drug/food allergies or update records. Completing encounter confirms the allergy profile.</p>
                        <div class="form-group" style="margin-bottom: 0;">
                            <input type="text" id="cons-allergies" class="form-control" placeholder="e.g. Penicillin (anaphylaxis), Sulfa drugs (rash) or 'No Known Drug Allergies (NKDA)'" value="${escapeHtml(appt.allergies_alerts || '')}">
                        </div>
                    </div>

                    <!-- 2. Clinical Notes in SOAP Format -->
                    <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <h3 style="font-size: 1.15rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    Clinical Notes (SOAP Format)
                                </h3>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">Standard clinical documentation of patient symptoms, examination findings, assessment, and care plan.</p>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <!-- S: Subjective -->
                            <div style="background: var(--bg-alt, #f8fafc); border: 1px solid var(--border); border-left: 4px solid #0284c7; border-radius: 6px; padding: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                    <label for="soap-subjective" style="font-weight: 700; color: #0369a1; font-size: 0.95rem; margin: 0;">
                                        S &middot; Subjective
                                    </label>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">Chief complaint, HPI, symptoms, onset, pain scale</span>
                                </div>
                                <textarea id="soap-subjective" class="form-control" rows="3" placeholder="Patient-reported symptoms, history of present illness, symptom duration, aggravating/relieving factors...">${escapeHtml(soap.subjective || '')}</textarea>
                            </div>

                            <!-- O: Objective -->
                            <div style="background: var(--bg-alt, #f8fafc); border: 1px solid var(--border); border-left: 4px solid #16a34a; border-radius: 6px; padding: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                    <label for="soap-objective" style="font-weight: 700; color: #15803d; font-size: 0.95rem; margin: 0;">
                                        O &middot; Objective
                                    </label>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">Physical exam findings, vitals inspection, systemic observations</span>
                                </div>
                                <textarea id="soap-objective" class="form-control" rows="3" placeholder="Physical examination observations, vital signs check, HEENT, chest, abdomen, extremities findings...">${escapeHtml(soap.objective || '')}</textarea>
                            </div>

                            <!-- A: Assessment -->
                            <div style="background: var(--bg-alt, #f8fafc); border: 1px solid var(--border); border-left: 4px solid #d97706; border-radius: 6px; padding: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                    <label for="soap-assessment" style="font-weight: 700; color: #b45309; font-size: 0.95rem; margin: 0;">
                                        A &middot; Assessment
                                    </label>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">Clinical impression, differential/working diagnosis synthesis, progress</span>
                                </div>
                                <textarea id="soap-assessment" class="form-control" rows="3" placeholder="Clinical synthesis, diagnosis analysis, disease severity, differential diagnoses...">${escapeHtml(soap.assessment || '')}</textarea>
                            </div>

                            <!-- P: Plan -->
                            <div style="background: var(--bg-alt, #f8fafc); border: 1px solid var(--border); border-left: 4px solid var(--primary, #107c41); border-radius: 6px; padding: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <label for="soap-plan" style="font-weight: 700; color: var(--primary, #107c41); font-size: 0.95rem; margin: 0;">
                                            P &middot; Plan
                                        </label>
                                        <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">Treatment strategy, lifestyle advice, counseling, follow-up timeline</span>
                                    </div>
                                    ${!isReadOnly ? `
                                    <button type="button" class="btn btn-secondary btn-sm" id="btn-sync-rx-plan" style="font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem;" title="Automatically sync active prescriptions into Plan without retyping">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                        ⚡ Summarize Prescriptions in Plan
                                    </button>
                                    ` : ''}
                                </div>
                                <textarea id="soap-plan" class="form-control" rows="4" placeholder="Treatment plan, patient counseling, dietary/activity advice, return precautions, follow-up date...">${escapeHtml(soap.plan || '')}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Diagnosis Section (ICD-10 Catalog) -->
                    <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <div>
                                <h3 style="font-size: 1.15rem; margin: 0;">Diagnosis</h3>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">Select standardized ICD-10 codes or enter clinical diagnoses.</p>
                            </div>
                            ${!isReadOnly ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-add-diagnosis">+ Add Diagnosis</button>` : ''}
                        </div>
                        <div id="diagnoses-container"></div>
                    </div>

                    <!-- 4. Structured Prescriptions (Rx) Section -->
                    <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <h3 style="font-size: 1.15rem; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                                    <span style="font-family: Georgia, serif; font-size: 1.35rem; font-weight: bold; color: var(--primary);">Rx</span>
                                    Prescriptions
                                </h3>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">Prescribe medications with complete structured clinical dosing, route, frequency, and duration.</p>
                            </div>
                            ${!isReadOnly ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-add-prescription">+ Add Medication</button>` : ''}
                        </div>
                        <div id="prescriptions-container"></div>
                    </div>

                    <!-- 5. Dedicated Laboratory & Diagnostic Requests Section -->
                    <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <h3 style="font-size: 1.15rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M10 2v7.31L4.89 16.5A2 2 0 0 0 6.61 19.5h10.78a2 2 0 0 0 1.72-3L14 9.31V2"></path><line x1="8.5" y1="2" x2="15.5" y2="2"></line><line x1="7" y1="14.5" x2="17" y2="14.5"></line></svg>
                                    Laboratory &amp; Diagnostic Requests
                                </h3>
                                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">Order diagnostic lab tests, clinical pathology, or radiological procedures for the patient.</p>
                            </div>
                            ${!isReadOnly ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-add-lab">+ Add Lab Request</button>` : ''}
                        </div>
                        <div id="labs-container"></div>
                    </div>
                </fieldset>

                <!-- 6. Clinical Addenda (for locked completed visits) -->
                ${isReadOnly && cons ? `
                <div class="card" style="margin-bottom: 1.25rem; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <h3 style="font-size: 1.1rem; margin: 0;">Clinical Addenda</h3>
                            <small style="color: var(--text-muted);">Immutable clinical notes amendments recorded chronologically.</small>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-open-addendum">+ Add Dated Addendum</button>
                    </div>
                    <div id="addenda-container">
                        ${this.renderAddendaHtml()}
                    </div>
                </div>
                ` : ''}

                <!-- Action Toolbar -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary" id="btn-cancel-consult">${isReadOnly ? 'Back to Appointments' : 'Cancel'}</button>
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
                    ${!isReadOnly ? `
                    <button type="submit" class="btn btn-primary" id="btn-save-consultation">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save &amp; Complete Encounter
                    </button>
                    ` : ''}
                </div>
            </form>

            <!-- Modals -->
            <div class="modal" id="addendum-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="addendum-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="addendum-title">Add Dated Clinical Addendum</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-top: 0; font-size: 0.875rem; color: var(--text-muted);">
                                Addenda permanently append dated corrections, follow-up remarks, or late-received test interpretations to this completed encounter.
                            </p>
                            <div class="form-group">
                                <label for="addendum-notes" style="font-weight: 500;">Addendum Note *</label>
                                <textarea id="addendum-notes" class="form-control" rows="4" placeholder="Enter clinical addendum..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="btn-save-addendum">Submit Addendum</button>
                        </div>
                    </div>
                </div>
            </div>

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

        this.state.icd10Pickers.forEach(picker => picker && picker.destroy && picker.destroy());
        this.state.icd10Pickers = [];
        container.innerHTML = '';
        
        if (this.state.diagnoses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No diagnoses added.</p>';
            return;
        }

        const remoteIcd10 = async (query) => {
            const res = await api.get('api/icd10_controller.php', { search: query });
            const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
            return items.map(c => ({
                value: c.code,
                label: `${c.code} — ${c.description}`,
                description: c.description
            }));
        };

        const isReadOnly = !['scheduled', 'confirmed'].includes(this.state.appointment?.status);

        this.state.diagnoses.forEach((diag, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: flex-start; flex-wrap: wrap;';
            row.innerHTML = `
                <div style="flex: 2; min-width: 220px;">
                    <div class="dx-icd-picker"></div>
                </div>
                <div style="flex: 2; min-width: 200px;">
                    <input type="text" class="form-control" placeholder="Diagnosis (e.g. Essential Hypertension)" value="${escapeHtml(diag.diagnosis_name || '')}" data-type="diagnosis" data-index="${index}" data-field="diagnosis_name">
                </div>
                <div style="flex: 2; min-width: 180px;">
                    <input type="text" class="form-control" placeholder="Clinical notes (Optional)" value="${escapeHtml(diag.notes || '')}" data-type="diagnosis" data-index="${index}" data-field="notes">
                </div>
                ${!isReadOnly ? `
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.4rem 0.55rem; margin-top: 0.15rem;" title="Remove diagnosis" data-remove-diagnosis="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                ` : ''}
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

        // Dispose previous pickers
        this.state.medicationPickers.forEach(picker => picker && picker.destroy && picker.destroy());
        this.state.medicationPickers = [];

        container.innerHTML = '';

        if (this.state.prescriptions.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No prescriptions added.</p>';
            return;
        }

        const remoteMedications = async (query) => {
            const res = await api.get('api/medication_controller.php', { search: query });
            const items = res.success ? ((res.data && res.data.items) ? res.data.items : []) : [];
            return items.map(m => ({
                value: m.medication_id,
                label: `${m.name}${m.generic_name ? ` (${m.generic_name})` : ''}`,
                name: m.name,
                generic: m.generic_name || '',
                meta: m.manufacturer || ''
            }));
        };

        const isReadOnly = !['scheduled', 'confirmed'].includes(this.state.appointment?.status);

        this.state.prescriptions.forEach((rx, index) => {
            const card = create('div');
            card.className = 'prescription-item-card';
            card.style.cssText = 'background: var(--bg-alt, #f8fafc); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;';

            card.innerHTML = `
                <!-- Row 1: Medication Name, Strength, Dosage, Route -->
                <div style="display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; margin-bottom: 0.75rem;">
                    <div style="flex: 3; min-width: 220px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Medication Name *</label>
                        <div class="rx-medication-picker"></div>
                    </div>
                    <div style="flex: 1.2; min-width: 120px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Strength</label>
                        <input type="text" class="form-control" placeholder="e.g. 500mg, 10mg/mL" value="${escapeHtml(rx.strength || '')}" data-type="prescription" data-index="${index}" data-field="strength">
                    </div>
                    <div style="flex: 1.2; min-width: 120px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Dosage *</label>
                        <input type="text" class="form-control" placeholder="e.g. 1 tab, 5mL" value="${escapeHtml(rx.dosage || '')}" data-type="prescription" data-index="${index}" data-field="dosage">
                    </div>
                    <div style="flex: 1.5; min-width: 140px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Route</label>
                        <select class="form-control" data-type="prescription" data-index="${index}" data-field="route">
                            ${CLINICAL_ROUTES.map(r => `<option value="${escapeHtml(r.value)}" ${(rx.route || 'Oral (PO)') === r.value ? 'selected' : ''}>${escapeHtml(r.label)}</option>`).join('')}
                        </select>
                    </div>
                    ${!isReadOnly ? `
                    <div style="display: flex; align-items: flex-end; padding-top: 1.5rem;">
                        <button type="button" class="btn btn-danger btn-sm" style="padding: 0.4rem 0.55rem;" title="Remove medication" data-remove-prescription="${index}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- Row 2: Frequency, Duration, Instructions -->
                <div style="display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap;">
                    <div style="flex: 1.8; min-width: 170px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Frequency *</label>
                        <input type="text" class="form-control" list="rx-frequency-list" placeholder="e.g. TID, Once daily" value="${escapeHtml(rx.frequency || '')}" data-type="prescription" data-index="${index}" data-field="frequency">
                    </div>
                    <div style="flex: 1.2; min-width: 120px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Duration</label>
                        <input type="text" class="form-control" placeholder="e.g. 7 days, 14 days" value="${escapeHtml(rx.duration || '')}" data-type="prescription" data-index="${index}" data-field="duration">
                    </div>
                    <div style="flex: 3; min-width: 220px;">
                        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Additional Instructions / Timing</label>
                        <input type="text" class="form-control" placeholder="e.g. Take after meals with plenty of water, do not crush" value="${escapeHtml(rx.instructions || '')}" data-type="prescription" data-index="${index}" data-field="instructions">
                    </div>
                </div>
            `;

            container.appendChild(card);

            const picker = new SearchSelect({
                placeholder: 'Type to search medication...',
                emptyText: 'No matching medication found.',
                remote: remoteMedications,
                value: rx.medication_id || '',
                label: rx.medication_id ? (rx.medication_name || `Medication #${rx.medication_id}`) : '',
                onChange: (item) => {
                    const current = this.state.prescriptions[index];
                    if (!current) return;
                    if (item) {
                        current.medication_id = item.value;
                        current.medication_name = item.name || item.label;
                    } else {
                        current.medication_id = '';
                        current.medication_name = '';
                    }
                }
            }).mount(card.querySelector('.rx-medication-picker'));

            this.state.medicationPickers.push(picker);
        });
    },

    renderLabs() {
        const container = this.container.querySelector('#labs-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.state.lab_requests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0; padding: 0.5rem 0;">No laboratory requests added.</p>';
            return;
        }

        const isReadOnly = !['scheduled', 'confirmed'].includes(this.state.appointment?.status);

        this.state.lab_requests.forEach((lab, index) => {
            const row = create('div');
            row.style.cssText = 'display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: flex-start; flex-wrap: wrap;';
            row.innerHTML = `
                <div style="flex: 3; min-width: 240px;">
                    <input type="text" class="form-control" list="common-labs-list" placeholder="Test Name (e.g. Complete Blood Count, Fasting Blood Sugar, Chest X-Ray)" value="${escapeHtml(lab.test_name || '')}" data-type="lab" data-index="${index}" data-field="test_name">
                </div>
                ${!isReadOnly ? `
                <div>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.4rem 0.55rem; margin-top: 0.15rem;" title="Remove lab request" data-remove-lab="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                ` : ''}
            `;
            container.appendChild(row);
        });
    },

    syncPrescriptionsToPlan() {
        const planTextarea = this.container.querySelector('#soap-plan');
        if (!planTextarea) return;

        // Gather filled prescriptions
        const validRx = this.state.prescriptions.filter(p => p.medication_id || (p.dosage && p.dosage.trim() !== ''));
        if (validRx.length === 0) {
            showToast('No prescribed medications to summarize. Add medications in the Prescriptions section below first.', 'info');
            return;
        }

        const lines = validRx.map(p => {
            const name = p.medication_name || `Medication #${p.medication_id || 'Rx'}`;
            const strength = p.strength ? ` ${p.strength.trim()}` : '';
            const dosage = p.dosage ? p.dosage.trim() : 'As directed';
            const route = p.route ? `, ${p.route.trim()}` : '';
            const freq = p.frequency ? `, ${p.frequency.trim()}` : '';
            const dur = p.duration ? ` for ${p.duration.trim()}` : '';
            const inst = p.instructions ? ` (${p.instructions.trim()})` : '';
            return `• ${name}${strength} - ${dosage}${route}${freq}${dur}${inst}`;
        });

        const summaryBlock = `Prescribed Medications:\n${lines.join('\n')}`;

        let currentPlan = planTextarea.value.trim();
        const rxHeaderRegex = /Prescribed Medications:\n(?:•[^\n]+(?:\n|$))*/i;

        if (rxHeaderRegex.test(currentPlan)) {
            // Replace existing block
            currentPlan = currentPlan.replace(rxHeaderRegex, summaryBlock);
        } else {
            // Append with clean spacing
            if (currentPlan !== '') {
                currentPlan = `${currentPlan}\n\n${summaryBlock}`;
            } else {
                currentPlan = summaryBlock;
            }
        }

        planTextarea.value = currentPlan;
        this.state.soap.plan = currentPlan;
        showToast('Prescription details summarized in Plan.', 'success');
        planTextarea.focus();
    },

    attachEventListeners() {
        const c = this.container;
        
        // Navigation & helpers
        c.querySelector('#btn-cancel-consult')?.addEventListener('click', () => {
            window.navigateTo('doctor_appointments');
        });

        c.querySelector('#btn-set-nkda')?.addEventListener('click', () => {
            const input = c.querySelector('#cons-allergies');
            if (input) {
                input.value = 'No Known Drug Allergies (NKDA)';
                input.focus();
            }
        });

        // SOAP Plan Prescription Summarizer shortcut
        c.querySelector('#btn-sync-rx-plan')?.addEventListener('click', () => {
            this.syncPrescriptionsToPlan();
        });

        // Reprint actions for saved consultations
        c.querySelector('#btn-print-rx')?.addEventListener('click', () => printPrescription(this.state.appointmentId));
        c.querySelector('#btn-print-lab')?.addEventListener('click', () => printLabRequest(this.state.appointmentId));

        // Add detail buttons
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

        // Field change listener for two-way state synchronization
        const handleSync = (e) => {
            if (e.target.matches('[data-type]')) {
                const type = e.target.getAttribute('data-type');
                const index = parseInt(e.target.getAttribute('data-index'), 10);
                const field = e.target.getAttribute('data-field');
                
                if (type === 'diagnosis' && this.state.diagnoses[index]) {
                    this.state.diagnoses[index][field] = e.target.value;
                } else if (type === 'prescription' && this.state.prescriptions[index]) {
                    this.state.prescriptions[index][field] = e.target.value;
                } else if (type === 'lab' && this.state.lab_requests[index]) {
                    this.state.lab_requests[index][field] = e.target.value;
                }
            } else if (e.target.id === 'soap-subjective') {
                this.state.soap.subjective = e.target.value;
            } else if (e.target.id === 'soap-objective') {
                this.state.soap.objective = e.target.value;
            } else if (e.target.id === 'soap-assessment') {
                this.state.soap.assessment = e.target.value;
            } else if (e.target.id === 'soap-plan') {
                this.state.soap.plan = e.target.value;
            }
        };

        c.addEventListener('input', handleSync);
        c.addEventListener('change', handleSync);

        // Remove row delegation
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

        // Form Submission
        const form = c.querySelector('#consultation-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSave = c.querySelector('#btn-save-consultation');
                btnSave.disabled = true;
                btnSave.textContent = 'Saving encounter...';

                const allergiesVal = c.querySelector('#cons-allergies') ? c.querySelector('#cons-allergies').value.trim() : null;

                const soapPayload = {
                    subjective: c.querySelector('#soap-subjective') ? c.querySelector('#soap-subjective').value.trim() : '',
                    objective: c.querySelector('#soap-objective') ? c.querySelector('#soap-objective').value.trim() : '',
                    assessment: c.querySelector('#soap-assessment') ? c.querySelector('#soap-assessment').value.trim() : '',
                    plan: c.querySelector('#soap-plan') ? c.querySelector('#soap-plan').value.trim() : ''
                };

                const compiledNotes = compileSoapNotes(soapPayload);

                const validDiagnoses = this.state.diagnoses.filter(d => (d.diagnosis_name || '').trim() !== '');
                const validPrescriptions = this.state.prescriptions.filter(p => p.medication_id !== '' && ((p.dosage || '').trim() !== '' || (p.frequency || '').trim() !== ''));
                const validLabs = this.state.lab_requests.filter(l => (l.test_name || '').trim() !== '');

                const payload = {
                    appointment_id: this.state.appointmentId,
                    soap: soapPayload,
                    notes: compiledNotes,
                    allergies_alerts: allergiesVal,
                    diagnoses: validDiagnoses,
                    prescriptions: validPrescriptions,
                    lab_requests: validLabs
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

        // Addendum modal controls
        c.querySelector('#btn-open-addendum')?.addEventListener('click', () => {
            const notesInput = c.querySelector('#addendum-notes');
            if (notesInput) notesInput.value = '';
            openModal('addendum-modal');
        });

        const btnSaveAddendum = c.querySelector('#btn-save-addendum');
        if (btnSaveAddendum) {
            btnSaveAddendum.addEventListener('click', async () => {
                const notesInput = c.querySelector('#addendum-notes');
                const notes = notesInput ? notesInput.value.trim() : '';
                if (!notes) {
                    showToast('Please enter an addendum note.', 'warning');
                    return;
                }

                btnSaveAddendum.disabled = true;
                btnSaveAddendum.textContent = 'Saving...';

                try {
                    const res = await api.post('api/consultation_controller.php?action=addendum', {
                        appointment_id: this.state.appointmentId,
                        notes: notes
                    });

                    if (res.success) {
                        showToast('Addendum recorded successfully.', 'success');
                        closeModal('addendum-modal');
                        if (notesInput) notesInput.value = '';
                        await this.loadConsultationData();
                        const addendaCont = c.querySelector('#addenda-container');
                        if (addendaCont) {
                            addendaCont.innerHTML = this.renderAddendaHtml();
                        }
                    } else {
                        showToast(res.message || 'Failed to save addendum.', 'error');
                    }
                } catch (err) {
                    console.error('Error saving addendum', err);
                    const msg = err.response?.data?.message || 'Failed to save addendum.';
                    showToast(msg, 'error');
                } finally {
                    btnSaveAddendum.disabled = false;
                    btnSaveAddendum.textContent = 'Submit Addendum';
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

        const hasRx = this.state.prescriptions.some(p => p.medication_id && (String(p.dosage || '').trim() !== '' || String(p.frequency || '').trim() !== ''));
        const hasLabs = this.state.lab_requests.some(l => String(l.test_name || '').trim() !== '');

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
