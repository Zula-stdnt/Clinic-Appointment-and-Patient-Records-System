// assets/js/modules/my_profile.js
// Read-only profile overview for Administrator and Receptionist accounts

import api from '../api.js?v=8';
import { escapeHtml } from '../ui.js?v=26';

const GEAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

const SHIELD_CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: -0.15em; margin-right: 0.25rem;" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>';

export default {
    container: null,

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.loadProfile();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="page-intro">
                <div>
                    <h2 class="page-title">My Profile</h2>
                    <p class="page-subtitle">A quick overview of your signed-in account.</p>
                </div>
                <a class="btn btn-secondary btn-sm" href="#settings">
                    ${GEAR_ICON} Open Settings
                </a>
            </div>

            <div class="profile-grid">
                <div class="card">
                    <div class="profile-card-body">
                        <span class="user-avatar" id="profile-avatar"></span>
                        <h3 class="card-title mt-3 mb-1" id="profile-name">Loading...</h3>
                        <span class="badge badge-role" id="profile-role">&mdash;</span>
                        <p class="text-muted small mt-3 mb-0">
                            ${SHIELD_CHECK_ICON}Signed in with a secure clinic session.
                        </p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Account Details</h3>
                            <p class="card-subtitle">Read-only information for your account</p>
                        </div>
                    </div>
                    <div class="detail-list" id="profile-details">
                        <div class="text-center text-muted py-4">
                            <span class="spinner spinner-sm me-2" role="status" aria-hidden="true"></span>Loading profile...
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadProfile() {
        const details = this.container.querySelector('#profile-details');
        try {
            const res = await api.get('api/auth_controller.php', { action: 'me' });
            if (!res.success) throw new Error(res.message);

            const user = res.data.user;
            const name = user.full_name || 'Unknown User';

            this.container.querySelector('#profile-avatar').textContent = name.trim().charAt(0).toUpperCase();
            this.container.querySelector('#profile-name').textContent = name;
            this.container.querySelector('#profile-role').textContent = user.role_name || '\u2014';

            const rows = [
                ['Full Name', name],
                ['Username', user.username || '\u2014'],
                ['Role', user.role_name || '\u2014'],
                ['Account ID', `#${user.user_id ?? '\u2014'}`],
                ['Portal', 'Hospital Patient Information System']
            ];

            details.innerHTML = rows.map(([label, value]) => `
                <div class="detail-row">
                    <span class="detail-label">${escapeHtml(label)}</span>
                    <span class="detail-value">${escapeHtml(String(value))}</span>
                </div>
            `).join('') + `
                <div class="alert alert-info mb-0 mt-3">
                    To update your personal details or reset your password, use
                    <a href="#settings" class="alert-link">Settings</a> or contact an administrator.
                </div>
            `;
        } catch (err) {
            details.innerHTML = `
                <div class="alert alert-danger mb-0">
                    Unable to load your profile right now.
                </div>
            `;
        }
    }
};
