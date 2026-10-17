// assets/js/modules/account_settings.js
// Account Settings: read-only account summary and a secure change-password form

import api from '../api.js?v=8';
import { escapeHtml, showToast } from '../ui.js?v=26';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const SHIELD_LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><rect x="9" y="11" width="6" height="5" rx="1"></rect><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11"></path></svg>';

export default {
    container: null,
    user: null,

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.attachEventListeners();
        this.loadAccount();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="page-intro">
                <div>
                    <h2 class="page-title">Settings</h2>
                    <p class="page-subtitle">Manage your account information and sign-in credentials.</p>
                </div>
            </div>

            <div class="settings-grid">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Account Information</h3>
                            <p class="card-subtitle">Your signed-in identity</p>
                        </div>
                    </div>
                    <div class="detail-list" id="settings-account-body">
                        <div class="text-center text-muted py-4">
                            <span class="spinner spinner-sm me-2" role="status" aria-hidden="true"></span>Loading account...
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Change Password</h3>
                            <p class="card-subtitle">Use at least 6 characters with uppercase, lowercase, a number, and a special character</p>
                        </div>
                    </div>
                    <form id="change-password-form" class="card-body" novalidate>
                        <div class="form-group">
                            <label for="current-password">Current Password <span class="required-star">*</span></label>
                            <input type="password" id="current-password" class="form-control" autocomplete="current-password" placeholder="Enter your current password">
                            <div class="invalid-feedback" id="current-password-error"></div>
                        </div>

                        <div class="form-group">
                            <label for="new-password">New Password <span class="required-star">*</span></label>
                            <input type="password" id="new-password" class="form-control" autocomplete="new-password" placeholder="Enter your new password">
                            <div class="invalid-feedback" id="new-password-error"></div>
                        </div>

                        <div class="form-group">
                            <label for="confirm-password">Confirm New Password <span class="required-star">*</span></label>
                            <input type="password" id="confirm-password" class="form-control" autocomplete="new-password" placeholder="Re-enter your new password">
                            <div class="invalid-feedback" id="confirm-password-error"></div>
                        </div>

                        <div class="d-flex justify-content-end gap-2 mt-3">
                            <button type="reset" class="btn btn-secondary" id="btn-reset-password">Clear</button>
                            <button type="submit" class="btn btn-primary" id="btn-save-password">
                                ${SHIELD_LOCK_ICON} Update Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        const form = this.container.querySelector('#change-password-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePassword();
        });
        form.addEventListener('reset', () => this.clearErrors());
    },

    async loadAccount() {
        const body = this.container.querySelector('#settings-account-body');
        try {
            const res = await api.get('api/auth_controller.php', { action: 'me' });
            if (!res.success) throw new Error(res.message);
            this.user = res.data.user;
            body.innerHTML = this.accountRows(this.user);
        } catch (err) {
            body.innerHTML = `
                <div class="alert alert-danger mb-0">
                    Unable to load your account information right now.
                </div>
            `;
        }
    },

    accountRows(user) {
        const rows = [
            ['Full Name', user.full_name || '\u2014'],
            ['Username', user.username || '\u2014'],
            ['Role', user.role_name || '\u2014'],
            ['Account ID', `#${user.user_id ?? '\u2014'}`]
        ];

        return rows.map(([label, value]) => `
            <div class="detail-row">
                <span class="detail-label">${escapeHtml(label)}</span>
                <span class="detail-value">${escapeHtml(String(value))}</span>
            </div>
        `).join('');
    },

    clearErrors() {
        this.container.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
        this.container.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    },

    showFieldError(fieldId, message) {
        const input = this.container.querySelector(`#${fieldId}`);
        const feedback = this.container.querySelector(`#${fieldId}-error`);
        if (input) input.classList.add('is-invalid');
        if (feedback) feedback.textContent = message;
    },

    async savePassword() {
        this.clearErrors();

        const currentPassword = this.container.querySelector('#current-password').value;
        const newPassword = this.container.querySelector('#new-password').value;
        const confirmPassword = this.container.querySelector('#confirm-password').value;

        let valid = true;

        if (!currentPassword) {
            this.showFieldError('current-password', 'Your current password is required.');
            valid = false;
        }

        if (!newPassword) {
            this.showFieldError('new-password', 'A new password is required.');
            valid = false;
        } else if (!PASSWORD_RULE.test(newPassword)) {
            this.showFieldError('new-password', 'Must be 6+ characters with uppercase, lowercase, number, and special character.');
            valid = false;
        } else if (newPassword === currentPassword) {
            this.showFieldError('new-password', 'The new password must be different from the current password.');
            valid = false;
        }

        if (!confirmPassword) {
            this.showFieldError('confirm-password', 'Please confirm your new password.');
            valid = false;
        } else if (newPassword !== confirmPassword) {
            this.showFieldError('confirm-password', 'Passwords do not match.');
            valid = false;
        }

        if (!valid) return;

        const saveBtn = this.container.querySelector('#btn-save-password');
        saveBtn.disabled = true;

        try {
            const res = await api.post('api/auth_controller.php?action=change_password', {
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            });

            if (!res.success) throw new Error(res.message);

            showToast(res.message || 'Password updated successfully.', 'success');
            this.container.querySelector('#change-password-form').reset();
            this.clearErrors();
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [field, message] of Object.entries(data.errors)) {
                    this.showFieldError(field.replace(/_/g, '-'), message);
                }
            }
            showToast(data?.message || err.message, 'danger');
        } finally {
            saveBtn.disabled = false;
        }
    }
};
