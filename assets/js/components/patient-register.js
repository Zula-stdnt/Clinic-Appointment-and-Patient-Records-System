// assets/js/components/patient-register.js
// Shared "Register New Patient" modal used by the receptionist workspace
// (Patient Register tab and the appointment booking form) so the front desk
// never has to leave its current task to add a patient record.
// ITE 387 Lessons applied: 03 APIs and Database Operations/header_detail_forms
// (single-record form saved through the patient API) & 02 DOM and UI/
// dom_apply_styles (classList toggles for validation feedback)

import api from '../api.js?v=8';
import { showToast, openModal, closeModal } from '../ui.js?v=26';

let instanceSeq = 0;

export class PatientRegisterForm {
    constructor(options = {}) {
        this.prefix = `prf${++instanceSeq}-`;
        this.modalId = options.modalId || `${this.prefix}modal`;
        this.container = options.container || document.body;
        this.successMessage = options.successMessage || 'Patient registered successfully.';
        this.onRegistered = typeof options.onRegistered === 'function' ? options.onRegistered : () => {};
        this.busy = false;

        this.render();
        this.attachEventListeners();
    }

    id(name) {
        return `${this.prefix}${name}`;
    }

    render() {
        this.root = document.createElement('div');
        this.root.innerHTML = `
            <div class="modal" id="${this.modalId}" tabindex="-1" aria-labelledby="${this.id('title')}" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <form id="${this.id('form')}" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="${this.id('title')}">Register New Patient</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 1rem;">All fields marked with <span class="required-star">*</span> are required.</p>

                                <div style="display: grid; grid-template-columns: 1fr 120px 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label for="${this.id('first-name')}">First Name <span class="required-star">*</span></label>
                                        <input type="text" id="${this.id('first-name')}" class="form-control" placeholder="First name">
                                        <div class="invalid-feedback" id="${this.id('first-name')}-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="${this.id('middle-initial')}">M.I. <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                        <input type="text" id="${this.id('middle-initial')}" class="form-control" maxlength="10" placeholder="e.g. A">
                                        <div class="invalid-feedback" id="${this.id('middle-initial')}-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="${this.id('last-name')}">Last Name <span class="required-star">*</span></label>
                                        <input type="text" id="${this.id('last-name')}" class="form-control" placeholder="Last name">
                                        <div class="invalid-feedback" id="${this.id('last-name')}-error"></div>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label for="${this.id('gender')}">Gender <span class="required-star">*</span></label>
                                        <select id="${this.id('gender')}" class="form-control">
                                            <option value="" disabled selected>Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                            <option value="Unknown">Unknown</option>
                                        </select>
                                        <div class="invalid-feedback" id="${this.id('gender')}-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="${this.id('dob')}">Date of Birth <span class="required-star">*</span></label>
                                        <input type="date" id="${this.id('dob')}" class="form-control">
                                        <div class="invalid-feedback" id="${this.id('dob')}-error"></div>
                                    </div>
                                </div>

                                <div class="form-group" id="${this.id('custom-gender-group')}" style="display: none;">
                                    <label for="${this.id('custom-gender')}">Specify Gender <span class="required-star">*</span></label>
                                    <input type="text" id="${this.id('custom-gender')}" class="form-control" placeholder="Please specify the gender">
                                    <div class="invalid-feedback" id="${this.id('custom-gender')}-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="${this.id('contact')}">Contact Number</label>
                                    <input type="text" id="${this.id('contact')}" class="form-control" placeholder="e.g. 09171234567">
                                    <div class="invalid-feedback" id="${this.id('contact')}-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="${this.id('allergies')}">Allergies &amp; Clinical Alerts <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="${this.id('allergies')}" class="form-control" placeholder="e.g. Penicillin, Sulfa drugs, Peanuts, or leave blank">
                                    <div class="invalid-feedback" id="${this.id('allergies')}-error"></div>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="${this.id('address')}">Address</label>
                                    <textarea id="${this.id('address')}" class="form-control" rows="3" placeholder="Residential / Street Address"></textarea>
                                    <div class="invalid-feedback" id="${this.id('address')}-error"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="${this.id('save')}" class="btn btn-primary">Register Patient</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.root);
        this.form = this.root.querySelector(`#${this.id('form')}`);
        this.genderSelect = this.root.querySelector(`#${this.id('gender')}`);
        this.customGenderGroup = this.root.querySelector(`#${this.id('custom-gender-group')}`);
        this.contactInput = this.root.querySelector(`#${this.id('contact')}`);
        this.dobInput = this.root.querySelector(`#${this.id('dob')}`);
        this.saveBtn = this.root.querySelector(`#${this.id('save')}`);
    }

    attachEventListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });

        this.genderSelect.addEventListener('change', () => {
            if (this.genderSelect.value === 'Other') {
                this.customGenderGroup.style.display = 'block';
            } else {
                this.customGenderGroup.style.display = 'none';
                this.root.querySelector(`#${this.id('custom-gender')}`).value = '';
            }
        });

        // Contact Number format (09XX XXX XXXX) with caret preservation
        this.contactInput.addEventListener('input', () => {
            const oldSelectionStart = this.contactInput.selectionStart;
            const oldVal = this.contactInput.value;

            let val = oldVal.replace(/\D/g, '');
            if (val.length > 11) val = val.slice(0, 11);

            let formatted = '';
            for (let i = 0; i < val.length; i++) {
                if (i === 4 || i === 7) formatted += ' ';
                formatted += val[i];
            }
            this.contactInput.value = formatted;

            let newCursor = 0;
            let digitsFound = 0;
            const digitsBeforeCursor = oldVal.slice(0, oldSelectionStart).replace(/\D/g, '').length;
            for (let i = 0; i < formatted.length; i++) {
                if (digitsFound === digitsBeforeCursor) break;
                if (/\d/.test(formatted[i])) digitsFound++;
                newCursor++;
            }
            if (document.activeElement === this.contactInput) {
                this.contactInput.setSelectionRange(newCursor, newCursor);
            }
        });
    }

    open() {
        this.clearErrors();
        this.form.reset();
        this.customGenderGroup.style.display = 'none';

        const now = new Date();
        const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        this.dobInput.max = localToday.toISOString().slice(0, 10);

        openModal(this.modalId);
    }

    clearErrors() {
        this.root.querySelectorAll('.invalid-feedback').forEach(el => {
            el.textContent = '';
        });
        this.root.querySelectorAll('.form-control').forEach(el => {
            el.classList.remove('is-invalid');
        });
    }

    showErrors(errors) {
        const fieldMap = {
            first_name: 'first-name',
            middle_initial: 'middle-initial',
            last_name: 'last-name',
            gender: 'gender',
            custom_gender: 'custom-gender',
            date_of_birth: 'dob',
            contact_no: 'contact',
            address: 'address'
        };

        Object.entries(errors || {}).forEach(([key, message]) => {
            const field = fieldMap[key];
            if (!field) return;
            const input = this.root.querySelector(`#${this.id(field)}`);
            const feedback = this.root.querySelector(`#${this.id(field)}-error`);
            if (input) input.classList.add('is-invalid');
            if (feedback) feedback.textContent = message;
        });
    }

    validate(payload) {
        const errors = {};
        if (!payload.first_name) errors.first_name = 'First name is required.';
        if (!payload.last_name) errors.last_name = 'Last name is required.';
        if (!payload.gender) errors.gender = 'Please select a gender.';
        if (!payload.date_of_birth) errors.date_of_birth = 'Date of birth is required.';

        const rawContact = payload.contact_no.replace(/\s+/g, '');
        if (rawContact !== '' && (rawContact.length !== 11 || !rawContact.startsWith('09'))) {
            errors.contact_no = 'Contact number must be exactly 11 digits and start with 09.';
        }

        this.clearErrors();
        if (Object.keys(errors).length > 0) {
            this.showErrors(errors);
            return false;
        }
        return true;
    }

    async save() {
        if (this.busy) return;

        const firstName = this.root.querySelector(`#${this.id('first-name')}`).value.trim();
        const middleInitial = this.root.querySelector(`#${this.id('middle-initial')}`).value.trim();
        const lastName = this.root.querySelector(`#${this.id('last-name')}`).value.trim();
        let gender = this.genderSelect.value;
        const customGender = this.root.querySelector(`#${this.id('custom-gender')}`).value.trim();
        const dob = this.dobInput.value;

        if (gender === 'Other') {
            if (customGender === '') {
                this.clearErrors();
                this.showErrors({ custom_gender: 'Please specify the gender.' });
                return;
            }
            gender = customGender;
        }

        const payload = {
            first_name: firstName,
            middle_initial: middleInitial,
            last_name: lastName,
            gender: gender,
            date_of_birth: dob,
            contact_no: this.contactInput.value.replace(/\s+/g, ''),
            allergies_alerts: this.root.querySelector(`#${this.id('allergies')}`)?.value.trim() || null,
            address: this.root.querySelector(`#${this.id('address')}`).value.trim()
        };

        if (!this.validate(payload)) return;

        this.busy = true;
        this.saveBtn.disabled = true;

        try {
            const res = await api.post('api/patient_controller.php', payload);
            if (res.success) {
                showToast(this.successMessage, 'success');
                closeModal(this.modalId);
                this.onRegistered({
                    ...payload,
                    patient_id: res.data ? res.data.patient_id : null
                });
            } else {
                this.showErrors(res.errors || {});
                showToast(res.message || 'Failed to register patient.', 'error');
            }
        } catch (err) {
            const data = err.response?.data || {};
            this.showErrors(data.errors || {});
            showToast(data.message || 'Failed to register patient.', 'error');
        } finally {
            this.busy = false;
            this.saveBtn.disabled = false;
        }
    }
}

export default PatientRegisterForm;
