// assets/js/modules/doctor_profile.js
// Doctor My Profile Module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_update_records (Pre-populated update form, ternary selected state, reflexive UI refresh) & 02 DOM and UI/dom_apply_styles (Safe classList.add/remove for validation feedback)

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';

function showValidationErrors(errors, container) {
    for (const [fieldId, msg] of Object.entries(errors)) {
        const input = container.querySelector(`#${fieldId}`);
        const feedback = container.querySelector(`#${fieldId}-error`);
        if (input) input.classList.add('is-invalid');
        if (feedback) feedback.textContent = msg;
    }
}

export default {
    state: {
        profile: null
    },

    async init(container) {
        this.container = container;
        this.renderSkeleton();
        await this.loadProfile();
    },

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="card" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                Loading profile data...
            </div>
        `;
    },

    async loadProfile() {
        try {
            const res = await api.get('api/doctor_profile_controller.php');
            if (res.success && res.data && res.data.profile) {
                this.state.profile = res.data.profile;
                this.renderUI();
                this.attachEventListeners();
            } else {
                showToast(res.message || 'Failed to load profile.', 'error');
                this.container.innerHTML = `<div class="alert alert-danger">Failed to load profile.</div>`;
            }
        } catch (err) {
            console.error('Error loading profile', err);
            const msg = err.response?.data?.message || 'Error loading profile.';
            showToast(msg, 'error');
            this.container.innerHTML = `<div class="alert alert-danger">${escapeHtml(msg)}</div>`;
        }
    },

    renderUI() {
        const p = this.state.profile;
        const initial = p.first_name ? p.first_name.charAt(0).toUpperCase() : '?';
        
        let specialtiesHtml = '<span class="badge" style="background: var(--bg-alt); color: var(--text-muted);">None Assigned</span>';
        if (p.specialty_names) {
            specialtiesHtml = p.specialty_names.split(',').map(s => `<span class="badge badge-info" style="margin-right: 0.5rem; margin-bottom: 0.5rem;">${escapeHtml(s.trim())}</span>`).join('');
        }

        // Format contact no
        let contactFormatted = '';
        if (p.contact_no && p.contact_no.length === 11) {
            contactFormatted = p.contact_no.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
        } else {
            contactFormatted = p.contact_no || '';
        }

        this.container.innerHTML = `
            <!-- Profile Banner -->
            <div class="card" style="margin-bottom: 1.5rem; padding: 2rem; background: var(--surface); display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 600; flex-shrink: 0;">
                    ${initial}
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <h2 style="margin: 0 0 0.5rem 0; font-size: 1.75rem; color: var(--text);">Dr. ${escapeHtml(p.first_name)} ${escapeHtml(p.middle_initial ? p.middle_initial + '. ' : '')}${escapeHtml(p.last_name)}</h2>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem;">
                        <span class="badge" style="background: var(--primary); color: white;">Licensed Physician</span>
                        <span class="badge" style="background: var(--secondary); color: white;">${escapeHtml(p.role_name)}</span>
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Member since ${new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                        <strong style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Clinical Specialties</strong>
                        <div style="display: flex; flex-wrap: wrap;">
                            ${specialtiesHtml}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Profile Edit Form -->
            <form id="profile-form" novalidate>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                    
                    <!-- Personal Info Card -->
                    <div class="card" style="padding: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Personal Information</h3>
                        
                        <div style="font-size: 0.85rem; padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; background: var(--bg-alt); border-left: 3px solid var(--info, #3b82f6); border-radius: 4px; color: var(--text-muted);">
                            <strong>Notice:</strong> Legal identity and gender are managed by clinic administration.
                        </div>

                        <div class="form-group">
                            <label for="prof-first-name">First Name <small class="text-muted">(Admin-managed)</small></label>
                            <input type="text" id="prof-first-name" class="form-control" value="${escapeHtml(p.first_name)}" disabled readonly style="background: var(--bg-alt); cursor: not-allowed; opacity: 0.85;">
                        </div>

                        <div class="form-group">
                            <label for="prof-last-name">Last Name <small class="text-muted">(Admin-managed)</small></label>
                            <input type="text" id="prof-last-name" class="form-control" value="${escapeHtml(p.last_name)}" disabled readonly style="background: var(--bg-alt); cursor: not-allowed; opacity: 0.85;">
                        </div>

                        <div class="form-group">
                            <label for="prof-middle-initial">Middle Initial <small class="text-muted">(Admin-managed)</small></label>
                            <input type="text" id="prof-middle-initial" class="form-control" value="${escapeHtml(p.middle_initial || '')}" disabled readonly style="background: var(--bg-alt); cursor: not-allowed; opacity: 0.85;">
                        </div>

                        <div class="form-group">
                            <label for="prof-gender">Gender <small class="text-muted">(Admin-managed)</small></label>
                            <input type="text" id="prof-gender" class="form-control" value="${escapeHtml(p.gender || 'Unknown')}" disabled readonly style="background: var(--bg-alt); cursor: not-allowed; opacity: 0.85;">
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="prof-contact-no">Contact Number</label>
                            <input type="text" id="prof-contact-no" class="form-control" placeholder="e.g. 0917 123 4567" value="${escapeHtml(contactFormatted)}">
                            <div class="invalid-feedback" id="prof-contact-no-error"></div>
                        </div>
                    </div>

                    <!-- Security Card -->
                    <div class="card" style="padding: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Account & Security</h3>
                        
                        <div class="form-group">
                            <label for="prof-username">Username <span class="required-star">*</span></label>
                            <input type="text" id="prof-username" class="form-control" value="${escapeHtml(p.username)}" required>
                            <div class="invalid-feedback" id="prof-username-error"></div>
                        </div>

                        <div style="background: var(--bg-alt); padding: 1rem; border-radius: 4px; border: 1px solid var(--border); margin-top: 2rem;">
                            <h4 style="margin-top: 0; margin-bottom: 1rem; font-size: 1rem;">Change Password <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></h4>
                            
                            <div class="form-group">
                                <label for="prof-current-password">Current Password</label>
                                <div style="position: relative;">
                                    <input type="password" id="prof-current-password" class="form-control" placeholder="Required to change password" style="padding-right: 40px;">
                                    <button type="button" class="btn-toggle-password" data-target="prof-current-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d; padding: 0;">
                                        <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        <svg class="icon-eye-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                                <div class="invalid-feedback" id="prof-current-password-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="prof-new-password">New Password</label>
                                <div style="position: relative;">
                                    <input type="password" id="prof-new-password" class="form-control" placeholder="Min. 6 characters" style="padding-right: 40px;">
                                    <button type="button" class="btn-toggle-password" data-target="prof-new-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d; padding: 0;">
                                        <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        <svg class="icon-eye-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                                <small class="text-muted" style="display: block; margin-top: 0.25rem;">Must contain an uppercase letter, lowercase letter, number, and special character.</small>
                                <div class="invalid-feedback" id="prof-new-password-error"></div>
                            </div>

                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prof-confirm-password">Confirm New Password</label>
                                <div style="position: relative;">
                                    <input type="password" id="prof-confirm-password" class="form-control" placeholder="Re-type new password" style="padding-right: 40px;">
                                    <button type="button" class="btn-toggle-password" data-target="prof-confirm-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d; padding: 0;">
                                        <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        <svg class="icon-eye-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                                <div class="invalid-feedback" id="prof-confirm-password-error"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: right;">
                    <button type="submit" id="btn-save-profile" class="btn btn-primary" style="padding-left: 2rem; padding-right: 2rem;">Save Changes</button>
                </div>
            </form>
        `;
    },

    attachEventListeners() {
        const c = this.container;


        // Contact Number format (09XX XXX XXXX)
        const contactInput = c.querySelector('#prof-contact-no');
        if (contactInput) {
            contactInput.addEventListener('input', (e) => {
                const input = e.target;
                const oldSelectionStart = input.selectionStart;
                const oldVal = input.value;
                
                let val = oldVal.replace(/\D/g, ''); // strip non-numeric
                if (val.length > 11) val = val.slice(0, 11);
                
                let formatted = '';
                for (let i = 0; i < val.length; i++) {
                    if (i === 4 || i === 7) formatted += ' ';
                    formatted += val[i];
                }
                
                input.value = formatted;

                let newCursor = 0;
                let digitsFound = 0;
                const digitsBeforeCursor = oldVal.slice(0, oldSelectionStart).replace(/\D/g, '').length;
                
                for (let i = 0; i < formatted.length; i++) {
                    if (digitsFound === digitsBeforeCursor) break;
                    if (/\d/.test(formatted[i])) digitsFound++;
                    newCursor++;
                }
                
                if (document.activeElement === input) {
                    input.setSelectionRange(newCursor, newCursor);
                }
            });
        }

        // Password visibility toggles
        c.querySelectorAll('.btn-toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const passInput = c.querySelector(`#${targetId}`);
                if (passInput) {
                    if (passInput.type === 'password') {
                        passInput.type = 'text';
                        btn.querySelector('.icon-eye-off').style.display = 'none';
                        btn.querySelector('.icon-eye-on').style.display = 'block';
                    } else {
                        passInput.type = 'password';
                        btn.querySelector('.icon-eye-on').style.display = 'none';
                        btn.querySelector('.icon-eye-off').style.display = 'block';
                    }
                }
            });
        });

        // Form Submission
        const form = c.querySelector('#profile-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Clear validation errors
                c.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
                c.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');

                const btn = c.querySelector('#btn-save-profile');
                btn.disabled = true;
                btn.textContent = 'Saving...';

                const payload = {
                    contact_no: c.querySelector('#prof-contact-no').value.trim(),
                    username: c.querySelector('#prof-username').value.trim(),
                    current_password: c.querySelector('#prof-current-password').value,
                    new_password: c.querySelector('#prof-new-password').value,
                    confirm_password: c.querySelector('#prof-confirm-password').value
                };

                try {
                    const res = await api.put('api/doctor_profile_controller.php', payload);
                    
                    if (res.success) {
                        showToast(res.message || 'Profile updated successfully.', 'success');
                        
                        // Clear password fields
                        c.querySelector('#prof-current-password').value = '';
                        c.querySelector('#prof-new-password').value = '';
                        c.querySelector('#prof-confirm-password').value = '';

                        // Reload profile to refresh banner
                        await this.loadProfile();

                    } else {
                        if (res.errors) {
                            const mappedErrors = {};
                            for (const [key, msg] of Object.entries(res.errors)) {
                                mappedErrors[`prof-${key.replace(/_/g, '-')}`] = msg;
                            }
                            showValidationErrors(mappedErrors, c);
                            showToast('Please correct the highlighted errors.', 'error');
                        } else {
                            showToast(res.message || 'Failed to update profile.', 'error');
                        }
                    }
                } catch (err) {
                    console.error('Error saving profile', err);
                    if (err.response?.status === 422 && err.response?.data?.errors) {
                        const mappedErrors = {};
                        for (const [key, msg] of Object.entries(err.response.data.errors)) {
                            mappedErrors[`prof-${key.replace(/_/g, '-')}`] = msg;
                        }
                        showValidationErrors(mappedErrors, c);
                        showToast('Please correct the highlighted errors.', 'error');
                    } else {
                        const msg = err.response?.data?.message || 'An error occurred while saving.';
                        showToast(msg, 'error');
                    }
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Save Changes';
                }
            });
        }
    }
};
