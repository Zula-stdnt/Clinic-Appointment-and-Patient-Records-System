// assets/js/modules/audit_logs.js
// Compliance & Audit Logs module for Administrator oversight

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';

const AUDIT_ACTION_GROUPS = [
    {
        name: 'Appointments & Clinical',
        actions: [
            { value: 'CREATE_APPOINTMENT', label: 'Appointment Created' },
            { value: 'STATUS_CHANGE', label: 'Appointment Status Changed' },
            { value: 'RESCHEDULE_APPOINTMENT', label: 'Appointment Rescheduled' },
            { value: 'EDIT_APPOINTMENT', label: 'Appointment Edited' },
            { value: 'CANCEL_REQUEST', label: 'Cancellation Requested' },
            { value: 'CANCEL_APPOINTMENT', label: 'Appointment Cancelled' },
            { value: 'SAVE_CONSULTATION', label: 'Consultation Saved' },
            { value: 'UPDATE_CONSULTATION', label: 'Consultation Updated' },
            { value: 'COMPLETE_CONSULTATION', label: 'Consultation Completed' },
            { value: 'ADD_ENCOUNTER_ADDENDUM', label: 'Encounter Addendum Appended' },
            { value: 'UPDATE_ALLERGIES_AT_INTAKE', label: 'Allergies Updated at Intake' }
        ]
    },
    {
        name: 'Patient Records & Demographics',
        actions: [
            { value: 'REGISTER_PATIENT', label: 'Patient Registered' },
            { value: 'REGISTER_WALKIN', label: 'Walk-in Registered' },
            { value: 'VIEW_RECORD', label: 'Medical Record Viewed' },
            { value: 'VIEW_DEMOGRAPHICS', label: 'Demographics Viewed' },
            { value: 'EDIT_DEMOGRAPHICS', label: 'Demographics Edited' },
            { value: 'ARCHIVE', label: 'Patient Record Archived' },
            { value: 'RESTORE', label: 'Patient Record Restored' },
            { value: 'PURGE', label: 'Patient Record Purged' }
        ]
    },
    {
        name: 'Security & Access Control',
        actions: [
            { value: 'BREAK_GLASS_ACCESS', label: 'Emergency Break-Glass Override' },
            { value: 'REQUEST_STANDARD_ACCESS', label: 'Access Requested' },
            { value: 'APPROVE_ACCESS_REQUEST', label: 'Access Approved' },
            { value: 'REJECT_ACCESS_REQUEST', label: 'Access Rejected' },
            { value: 'ACKNOWLEDGE_AUDIT_FLAG', label: 'Audit Flag Acknowledged' },
            { value: 'VIEW_RECORD_APPROVED_ACCESS', label: 'Approved Record Viewed' },
            { value: 'LOGIN', label: 'User Login' },
            { value: 'LOGOUT', label: 'User Logout' },
            { value: 'CHANGE_PASSWORD', label: 'Account Password Changed' }
        ]
    },
    {
        name: 'Administration & Staff',
        actions: [
            { value: 'CREATE_DOCTOR', label: 'Doctor Profile Created' },
            { value: 'UPDATE_DOCTOR', label: 'Doctor Profile Updated' },
            { value: 'UPDATE_DOCTOR_SCHEDULE', label: 'Doctor Schedule Updated' },
            { value: 'ARCHIVE_DOCTOR', label: 'Doctor Profile Archived' },
            { value: 'RESTORE_DOCTOR', label: 'Doctor Profile Restored' },
            { value: 'PURGE_DOCTOR', label: 'Doctor Profile Purged' },
            { value: 'CREATE_USER', label: 'User Account Created' },
            { value: 'UPDATE_USER', label: 'User Account Updated' },
            { value: 'ARCHIVE_USER', label: 'User Account Archived' },
            { value: 'RESTORE_USER', label: 'User Account Restored' },
            { value: 'PURGE_USER', label: 'User Account Purged' },
            { value: 'UPDATE_PROFILE', label: 'User Profile Updated' }
        ]
    }
];

const auditLogsModule = {
    container: null,
    currentPage: 1,
    pageSize: 10,
    currentAction: '',
    searchQuery: '',
    dateFilter: 'all',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    activeTab: 'audit-trail',
    requestsFilter: 'all',
    requestsPage: 1,
    requestsPageSize: 10,

    init(container) {
        this.container = container;
        this.render();
        this.attachEventListeners();
        this.loadData();
        this.checkPendingBadge();
    },

    renderDropdownOptions() {
        let html = `
            <div class="custom-dropdown-item${!this.currentAction ? ' is-selected' : ''}" data-value="" data-label="All Actions" role="option">
                <span>All Actions</span>
                ${!this.currentAction ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </div>
        `;

        AUDIT_ACTION_GROUPS.forEach(group => {
            html += `<div class="custom-dropdown-header">${escapeHtml(group.name)}</div>`;
            group.actions.forEach(act => {
                const isSel = this.currentAction === act.value;
                html += `
                    <div class="custom-dropdown-item${isSel ? ' is-selected' : ''}" data-value="${escapeHtml(act.value)}" data-label="${escapeHtml(act.label)}" role="option">
                        <span>${escapeHtml(act.label)}</span>
                        ${isSel ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                `;
            });
        });

        return html;
    },

    renderNativeSelectOptions() {
        let html = '';
        AUDIT_ACTION_GROUPS.forEach(group => {
            html += `<optgroup label="${escapeHtml(group.name)}">`;
            group.actions.forEach(act => {
                const isSel = this.currentAction === act.value ? ' selected' : '';
                html += `<option value="${escapeHtml(act.value)}"${isSel}>${escapeHtml(act.label)}</option>`;
            });
            html += `</optgroup>`;
        });
        return html;
    },

    render() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">System Compliance &amp; Audit Trail</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Review security events, patient record access, demographic changes, and emergency overrides</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="btn btn-primary btn-sm audit-tab-btn" data-tab="audit-trail">Audit Trail</button>
                        <button type="button" class="btn btn-secondary btn-sm audit-tab-btn" data-tab="access-requests">
                            Access Requests
                            <span id="pending-requests-badge" class="badge badge-status-scheduled" style="display: none; margin-left: 0.35rem; font-size: 0.72rem;">0</span>
                        </button>
                    </div>
                </div>

                <div id="audit-trail-section">
                    <div class="toolbar">
                        <div class="toolbar-filters">
                            <div class="custom-dropdown-filter-wrapper">
                                <button type="button" id="audit-action-btn" class="form-control" style="width: auto; min-width: 220px; text-align: left; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: var(--surface, #fff); padding-right: 2.25rem; position: relative;" aria-haspopup="listbox" aria-expanded="false" title="Filter by audit action">
                                    <span id="audit-action-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;">All Actions</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; right: 0.75rem; pointer-events: none;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                                <div id="audit-action-menu" class="custom-dropdown-menu" role="listbox" style="display: none; position: absolute; top: 100%; left: 0; min-width: 290px; max-width: 360px; z-index: 1050; background: var(--surface, #fff); border: 1px solid var(--border, #ced4da); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.14); margin-top: 4px; padding: 0.25rem 0;">
                                    <div style="padding: 0.4rem 0.5rem; position: sticky; top: 0; background: var(--surface, #fff); z-index: 2; border-bottom: 1px solid var(--border, #e2e8f0);">
                                        <input type="text" id="audit-action-search" class="form-control form-control-sm" placeholder="Quick search actions..." style="font-size: 0.8rem; padding: 0.3rem 0.5rem; width: 100%;">
                                    </div>
                                    <div id="audit-action-items">
                                        ${this.renderDropdownOptions()}
                                    </div>
                                </div>
                                <select id="audit-action-filter" style="display: none;">
                                    <option value="">All Actions</option>
                                    ${this.renderNativeSelectOptions()}
                                </select>
                            </div>

                            <select id="audit-date-filter" class="form-control" style="width: auto; min-width: 140px;">
                                <option value="all">All Dates</option>
                                <option value="today">Today</option>
                                <option value="last_7_days">Last 7 Days</option>
                                <option value="last_30_days">Last 30 Days</option>
                            </select>

                            <div class="search-input-wrapper">
                                <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input type="text" id="audit-search" class="form-control" placeholder="Search actor, reason, action...">
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                            <select id="audit-page-size" class="form-control" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th data-sort="created_at">Timestamp</th>
                                    <th data-sort="username">User (Actor)</th>
                                    <th data-sort="action">Action</th>
                                    <th data-sort="entity_type">Target Entity</th>
                                    <th>Details / Reason</th>
                                    <th>IP Address</th>
                                </tr>
                            </thead>
                            <tbody id="audit-table-body">
                                <tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading audit trail...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="pagination-wrapper" id="audit-pagination"></div>
                </div>

                <div id="access-requests-section" style="display: none;">
                    <div class="toolbar">
                        <div class="toolbar-filters">
                            <select id="requests-status-filter" class="form-control" style="width: auto; min-width: 180px;">
                                <option value="all">All Requests &amp; Overrides</option>
                                <option value="pending">Pending Approval</option>
                                <option value="flagged">Flagged Overrides</option>
                            </select>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                                <select id="requests-page-size" class="form-control" style="width: auto;">
                                    <option value="10" selected>10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-requests">Refresh</button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Requested At</th>
                                    <th>Doctor</th>
                                    <th>Patient</th>
                                    <th>Mode</th>
                                    <th>Status / Window</th>
                                    <th>Clinical Justification</th>
                                    <th style="text-align: right; white-space: nowrap;">Administrative Action</th>
                                </tr>
                            </thead>
                            <tbody id="access-requests-tbody">
                                <tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading access requests...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="pagination-wrapper" id="requests-pagination"></div>
                </div>
            </div>
        `;
    },

    filterActionDropdown(query) {
        const actionMenu = this.container.querySelector('#audit-action-menu');
        if (!actionMenu) return;

        const items = actionMenu.querySelectorAll('.custom-dropdown-item');
        const headers = actionMenu.querySelectorAll('.custom-dropdown-header');

        if (!query) {
            items.forEach(el => el.style.display = '');
            headers.forEach(el => el.style.display = '');
            return;
        }

        items.forEach(el => {
            const val = (el.getAttribute('data-value') || '').toLowerCase();
            const lbl = (el.getAttribute('data-label') || el.textContent || '').toLowerCase();
            const match = val.includes(query) || lbl.includes(query);
            el.style.display = match ? '' : 'none';
        });

        // Toggle category headers based on whether any child item in the group is visible
        let currentHeader = null;
        let headerHasVisibleChild = false;

        actionMenu.querySelectorAll('.custom-dropdown-header, .custom-dropdown-item').forEach(el => {
            if (el.classList.contains('custom-dropdown-header')) {
                if (currentHeader) {
                    currentHeader.style.display = headerHasVisibleChild ? '' : 'none';
                }
                currentHeader = el;
                headerHasVisibleChild = false;
            } else if (el.classList.contains('custom-dropdown-item') && el.style.display !== 'none') {
                headerHasVisibleChild = true;
            }
        });
        if (currentHeader) {
            currentHeader.style.display = headerHasVisibleChild ? '' : 'none';
        }
    },

    attachEventListeners() {
        const actionBtn = this.container.querySelector('#audit-action-btn');
        const actionMenu = this.container.querySelector('#audit-action-menu');
        const actionSearch = this.container.querySelector('#audit-action-search');
        const actionLabel = this.container.querySelector('#audit-action-label');
        const actionFilter = this.container.querySelector('#audit-action-filter');

        const closeActionMenu = () => {
            if (actionMenu && actionMenu.style.display !== 'none') {
                actionMenu.style.display = 'none';
                if (actionBtn) actionBtn.setAttribute('aria-expanded', 'false');
            }
        };

        if (actionBtn && actionMenu) {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = actionMenu.style.display !== 'none';
                if (isOpen) {
                    closeActionMenu();
                } else {
                    actionMenu.style.display = 'block';
                    actionBtn.setAttribute('aria-expanded', 'true');
                    if (actionSearch) {
                        actionSearch.value = '';
                        this.filterActionDropdown('');
                        setTimeout(() => actionSearch.focus(), 50);
                    }
                }
            });

            if (actionSearch) {
                actionSearch.addEventListener('click', (e) => e.stopPropagation());
                actionSearch.addEventListener('input', (e) => {
                    this.filterActionDropdown(e.target.value.trim().toLowerCase());
                });
                actionSearch.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        closeActionMenu();
                        actionBtn.focus();
                    }
                });
            }

            actionMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.custom-dropdown-item');
                if (!item) return;
                const val = item.getAttribute('data-value') || '';
                const lbl = item.getAttribute('data-label') || (val ? val : 'All Actions');

                this.currentAction = val;
                if (actionLabel) actionLabel.textContent = lbl;
                if (actionFilter) actionFilter.value = val;

                // Sync is-selected indicator
                actionMenu.querySelectorAll('.custom-dropdown-item').forEach(el => {
                    const match = el.getAttribute('data-value') === val;
                    el.classList.toggle('is-selected', match);
                    const check = el.querySelector('svg');
                    if (match && !check) {
                        el.insertAdjacentHTML('beforeend', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>');
                    } else if (!match && check) {
                        check.remove();
                    }
                });

                closeActionMenu();
                this.currentPage = 1;
                this.loadData();
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-dropdown-filter-wrapper')) {
                    closeActionMenu();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeActionMenu();
                }
            });
        }

        if (actionFilter) {
            actionFilter.addEventListener('change', (e) => {
                const val = e.target.value;
                this.currentAction = val;
                if (actionLabel) {
                    const opt = actionFilter.options[actionFilter.selectedIndex];
                    actionLabel.textContent = opt ? opt.textContent : 'All Actions';
                }
                this.currentPage = 1;
                this.loadData();
            });
        }

        const dateFilter = this.container.querySelector('#audit-date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.dateFilter = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        const pageSizeSelect = this.container.querySelector('#audit-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value, 10);
                this.currentPage = 1;
                this.loadData();
            });
        }

        let debounceTimer = null;
        const searchInput = this.container.querySelector('#audit-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.currentPage = 1;
                    this.loadData();
                }, 350);
            });
        }

        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.getAttribute('data-sort');
                if (this.sortBy === sortField) {
                    this.sortOrder = this.sortOrder === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    this.sortBy = sortField;
                    this.sortOrder = 'ASC';
                }
                this.currentPage = 1;
                this.loadData();
            });
        });

        // Tab switching
        this.container.querySelectorAll('.audit-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                if (targetTab === this.activeTab) return;
                this.activeTab = targetTab;

                this.container.querySelectorAll('.audit-tab-btn').forEach(b => {
                    if (b.getAttribute('data-tab') === targetTab) {
                        b.classList.remove('btn-secondary');
                        b.classList.add('btn-primary');
                    } else {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                    }
                });

                const auditSec = this.container.querySelector('#audit-trail-section');
                const reqSec = this.container.querySelector('#access-requests-section');

                if (targetTab === 'audit-trail') {
                    if (auditSec) auditSec.style.display = '';
                    if (reqSec) reqSec.style.display = 'none';
                    this.loadData();
                } else {
                    if (auditSec) auditSec.style.display = 'none';
                    if (reqSec) reqSec.style.display = '';
                    this.loadAccessRequests();
                }
            });
        });

        // Requests filters & controls
        const reqFilter = this.container.querySelector('#requests-status-filter');
        if (reqFilter) {
            reqFilter.addEventListener('change', (e) => {
                this.requestsFilter = e.target.value;
                this.requestsPage = 1;
                this.loadAccessRequests();
            });
        }

        const reqPageSize = this.container.querySelector('#requests-page-size');
        if (reqPageSize) {
            reqPageSize.addEventListener('change', (e) => {
                this.requestsPageSize = parseInt(e.target.value, 10);
                this.requestsPage = 1;
                this.loadAccessRequests();
            });
        }

        const refreshReqBtn = this.container.querySelector('#btn-refresh-requests');
        if (refreshReqBtn) {
            refreshReqBtn.addEventListener('click', () => {
                this.loadAccessRequests();
            });
        }

        // Requests action buttons delegation
        const reqTbody = this.container.querySelector('#access-requests-tbody');
        if (reqTbody) {
            reqTbody.addEventListener('click', (e) => {
                const approveBtn = e.target.closest('.btn-approve-request');
                if (approveBtn) {
                    const id = parseInt(approveBtn.getAttribute('data-id'), 10);
                    if (id) this.approveRequest(id);
                    return;
                }

                const rejectBtn = e.target.closest('.btn-reject-request');
                if (rejectBtn) {
                    const id = parseInt(rejectBtn.getAttribute('data-id'), 10);
                    if (id) this.rejectRequest(id);
                    return;
                }

                const ackBtn = e.target.closest('.btn-ack-audit');
                if (ackBtn) {
                    const id = parseInt(ackBtn.getAttribute('data-id'), 10);
                    if (id) this.acknowledgeAudit(id);
                    return;
                }
            });
        }

        // Real-time live update sync listener
        if (!this._syncBound) {
            this._syncBound = true;
            document.addEventListener('cprms:sync', () => {
                if (this.container && this.container.isConnected) {
                    this.checkPendingBadge();
                    if (this.activeTab === 'audit-trail') {
                        this.loadData();
                    } else {
                        this.loadAccessRequests();
                    }
                }
            });
        }
    },

    updateSortHeaders() {
        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.getAttribute('data-sort') === this.sortBy) {
                th.classList.add(this.sortOrder === 'ASC' ? 'sort-asc' : 'sort-desc');
            }
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#audit-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading audit trail...</td></tr>`;

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize
            });
            if (this.currentAction) params.append('action', this.currentAction);
            if (this.dateFilter && this.dateFilter !== 'all') params.append('date_filter', this.dateFilter);
            if (this.searchQuery) params.append('search', this.searchQuery);
            if (this.sortBy) params.append('sort_by', this.sortBy);
            if (this.sortOrder) params.append('sort_order', this.sortOrder);

            const res = await api.get(`api/audit_log_controller.php?${params.toString()}`);
            const items = res.data?.items || [];
            const pagination = res.data?.pagination || { current_page: 1, total_pages: 1, total_items: 0 };

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">No audit records found matching criteria.</td></tr>`;
                this.renderPagination(pagination);
                this.updateSortHeaders();
                return;
            }

            tbody.innerHTML = items.map(item => this.renderRow(item)).join('');
            this.renderPagination(pagination);
            this.updateSortHeaders();
        } catch (err) {
            console.error('Failed to load audit logs:', err);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 2rem;">Failed to load audit trail: ${escapeHtml(err.response?.data?.message || err.message)}</td></tr>`;
        }
    },

    renderRow(item) {
        let actionBadgeClass = 'badge-status-secondary';
        if (item.action.includes('BREAK_GLASS')) actionBadgeClass = 'badge-status-breakglass';
        else if (item.action.includes('CANCEL') || item.action.includes('REJECT') || item.action.includes('PURGE')) actionBadgeClass = 'badge-status-critical';
        else if (item.action.includes('CREATE') || item.action.includes('REGISTER') || item.action.includes('APPROVE') || item.action.includes('RESTORE')) actionBadgeClass = 'badge-status-active';
        else if (item.action.includes('EDIT') || item.action.includes('UPDATE') || item.action.includes('RESCHEDULE')) actionBadgeClass = 'badge-status-scheduled';
        else if (item.action.includes('VIEW') || item.action.includes('CONSULTATION') || item.action.includes('ACKNOWLEDGE')) actionBadgeClass = 'badge-status-confirmed';

        let entityLabel = item.entity_type ? `${escapeHtml(item.entity_type.toUpperCase())} #${escapeHtml(String(item.entity_id || ''))}` : '<span class="text-muted">—</span>';
        if (item.target_name) {
            entityLabel += `<div class="text-muted" style="font-size: 0.76rem; font-weight: 500; margin-top: 2px;">${escapeHtml(item.target_name)}</div>`;
        }

        const detailsHtml = this.formatAuditDetails(item);

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 0.82rem;">${escapeHtml(item.created_at)}</td>
                <td>
                    <strong>${escapeHtml(item.full_name)}</strong>
                    <div class="text-muted" style="font-size: 0.78rem;"><code>${escapeHtml(item.username)}</code> &middot; ${escapeHtml(item.role_name)}</div>
                </td>
                <td><span class="badge ${actionBadgeClass}">${escapeHtml(item.action)}</span></td>
                <td>${entityLabel}</td>
                <td style="max-width: 380px; word-break: break-word; font-size: 0.85rem;">${detailsHtml}</td>
                <td style="font-size: 0.8rem; font-family: monospace;">${escapeHtml(item.ip_address || '—')}</td>
            </tr>
        `;
    },

    formatAuditDetails(item) {
        const action = item.action || '';
        const oldVals = item.old_values_parsed || null;
        const newVals = item.new_values_parsed || null;
        const reason = (item.reason || '').trim();

        let primaryText = '';
        let additionalInfo = '';

        const formatStatus = (s) => {
            if (!s) return '';
            const map = {
                scheduled: 'Scheduled',
                confirmed: 'Confirmed',
                completed: 'Completed',
                cancelled: 'Cancelled',
                no_show: 'No Show'
            };
            return map[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1);
        };

        const formatDateTime = (dateStr, timeStr) => {
            if (!dateStr && !timeStr) return '';
            let dPart = '';
            if (dateStr) {
                const parts = String(dateStr).split('-');
                if (parts.length === 3) {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const mIdx = parseInt(parts[1], 10) - 1;
                    dPart = `${months[mIdx] || parts[1]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
                } else {
                    dPart = String(dateStr);
                }
            }
            let tPart = '';
            if (timeStr) {
                const tParts = String(timeStr).split(':');
                if (tParts.length >= 2) {
                    let h = parseInt(tParts[0], 10);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    h = h % 12 || 12;
                    tPart = `${String(h).padStart(2, '0')}:${tParts[1]} ${ampm}`;
                } else {
                    tPart = String(timeStr);
                }
            }
            if (dPart && tPart) return `${dPart} at ${tPart}`;
            return dPart || tPart;
        };

        const formatDiff = (oldObj, newObj) => {
            if (!oldObj && !newObj) return '';
            const FIELD_LABELS = {
                first_name: 'First Name',
                last_name: 'Last Name',
                middle_initial: 'Middle Initial',
                contact_no: 'Contact Number',
                address: 'Address',
                gender: 'Gender',
                date_of_birth: 'Date of Birth',
                allergies_alerts: 'Allergies / Alerts',
                allergies_confirmed_by_doctor: 'Physician Allergy Confirmation',
                status: 'Status',
                appointment_date: 'Date',
                appointment_time: 'Time',
                date: 'Date',
                time: 'Time',
                chief_complaint: 'Chief Complaint',
                username: 'Username',
                role_name: 'Role',
                cancel_request_reason: 'Cancellation Reason'
            };

            const changes = [];
            const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

            for (const k of allKeys) {
                if (['appointment_id', 'patient_id', 'doctor_id', 'consultation_id', 'user_id', 'role_id'].includes(k)) continue;
                const oVal = oldObj ? oldObj[k] : undefined;
                const nVal = newObj ? newObj[k] : undefined;

                if (JSON.stringify(oVal) !== JSON.stringify(nVal)) {
                    const label = FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    let fromStr = (oVal === null || oVal === undefined || oVal === '') ? 'None' : String(oVal);
                    let toStr = (nVal === null || nVal === undefined || nVal === '') ? 'None' : String(nVal);

                    if (k === 'status') {
                        fromStr = formatStatus(fromStr);
                        toStr = formatStatus(toStr);
                    } else if (k === 'date' || k === 'appointment_date') {
                        fromStr = formatDateTime(fromStr, null);
                        toStr = formatDateTime(toStr, null);
                    } else if (k === 'time' || k === 'appointment_time') {
                        fromStr = formatDateTime(null, fromStr);
                        toStr = formatDateTime(null, toStr);
                    }

                    if (oVal === undefined || oVal === null || oVal === '') {
                        changes.push(`<strong>${label}</strong> set to <em>"${escapeHtml(toStr)}"</em>`);
                    } else if (nVal === undefined || nVal === null || nVal === '') {
                        changes.push(`<strong>${label}</strong> cleared (was <em>"${escapeHtml(fromStr)}"</em>)`);
                    } else {
                        changes.push(`<strong>${label}</strong> changed from <em>"${escapeHtml(fromStr)}"</em> to <em>"${escapeHtml(toStr)}"</em>`);
                    }
                }
            }
            return changes.length > 0 ? changes.join('; ') : '';
        };

        // Specific actions human-readable translation
        if (action === 'LOGIN') {
            const role = (newVals && newVals.role_name) || item.role_name || 'User';
            primaryText = `${escapeHtml(role)} logged in`;
        } else if (action === 'LOGOUT') {
            primaryText = 'User logged out of the system';
        } else if (action === 'CHANGE_PASSWORD') {
            primaryText = 'Account password was updated';
        } else if (action === 'CREATE_APPOINTMENT') {
            const patName = item.target_patient_name;
            const docName = item.target_doctor_name;
            const patientText = patName ? `patient <strong>${escapeHtml(patName)}</strong>` : 'the patient';
            const doctorText = docName ? `Dr. <strong>${escapeHtml(docName)}</strong>` : 'the doctor';

            primaryText = `Appointment created for ${patientText} and assigned to ${doctorText}`;

            const dateVal = newVals ? (newVals.appointment_date || newVals.date) : null;
            const timeVal = newVals ? (newVals.appointment_time || newVals.time) : null;
            const scheduleStr = formatDateTime(dateVal, timeVal);
            if (scheduleStr) {
                additionalInfo = `Scheduled for ${escapeHtml(scheduleStr)}`;
            }
        } else if (action === 'STATUS_CHANGE') {
            const oldStatus = oldVals ? oldVals.status : null;
            const newStatus = newVals ? newVals.status : null;
            const oldDate = oldVals ? (oldVals.appointment_date || oldVals.date) : null;
            const newDate = newVals ? (newVals.appointment_date || newVals.date) : null;
            const oldTime = oldVals ? (oldVals.appointment_time || oldVals.time) : null;
            const newTime = newVals ? (newVals.appointment_time || newVals.time) : null;

            const statusChanged = oldStatus && newStatus && oldStatus !== newStatus;
            const scheduleChanged = (oldDate && newDate && oldDate !== newDate) || (oldTime && newTime && oldTime !== newTime);

            if (statusChanged && scheduleChanged) {
                primaryText = `Appointment status changed from <strong>${formatStatus(oldStatus)}</strong> to <strong>${formatStatus(newStatus)}</strong>`;
                additionalInfo = `Rescheduled to ${escapeHtml(formatDateTime(newDate, newTime))}`;
            } else if (statusChanged) {
                primaryText = `Appointment status changed from <strong>${formatStatus(oldStatus)}</strong> to <strong>${formatStatus(newStatus)}</strong>`;
                if (newDate || newTime) {
                    additionalInfo = `Appointment schedule: ${escapeHtml(formatDateTime(newDate, newTime))}`;
                }
            } else if (scheduleChanged) {
                primaryText = `Appointment rescheduled to ${escapeHtml(formatDateTime(newDate, newTime))}`;
                if (oldDate || oldTime) {
                    additionalInfo = `Previous schedule: ${escapeHtml(formatDateTime(oldDate, oldTime))}`;
                }
            } else {
                primaryText = `Appointment status updated to <strong>${formatStatus(newStatus || 'Updated')}</strong>`;
            }
        } else if (action === 'RESCHEDULE_APPOINTMENT') {
            const oldDate = oldVals ? (oldVals.appointment_date || oldVals.date) : null;
            const newDate = newVals ? (newVals.appointment_date || newVals.date) : null;
            const oldTime = oldVals ? (oldVals.appointment_time || oldVals.time) : null;
            const newTime = newVals ? (newVals.appointment_time || newVals.time) : null;
            primaryText = `Appointment rescheduled to ${escapeHtml(formatDateTime(newDate, newTime))}`;
            if (oldDate || oldTime) {
                additionalInfo = `Previous schedule: ${escapeHtml(formatDateTime(oldDate, oldTime))}`;
            }
        } else if (action === 'EDIT_APPOINTMENT') {
            primaryText = 'Appointment details updated';
            const diffText = formatDiff(oldVals, newVals);
            if (diffText) additionalInfo = diffText;
        } else if (action === 'CANCEL_APPOINTMENT') {
            primaryText = 'Appointment cancelled';
            if (reason) {
                additionalInfo = `Reason: "${escapeHtml(reason)}"`;
            }
        } else if (action === 'CANCEL_REQUEST') {
            primaryText = 'Doctor requested appointment cancellation';
            const cancelReason = reason || (newVals && newVals.cancel_request_reason);
            if (cancelReason) {
                additionalInfo = `Reason: "${escapeHtml(cancelReason)}"`;
            }
        } else if (action === 'COMPLETE_CONSULTATION' || action === 'SAVE_CONSULTATION' || action === 'UPDATE_CONSULTATION') {
            const verb = action === 'UPDATE_CONSULTATION' ? 'updated' : (action === 'COMPLETE_CONSULTATION' ? 'completed' : 'saved');
            primaryText = `Doctor ${verb} clinical consultation`;
            if (newVals && (newVals.diagnoses_count !== undefined || newVals.prescriptions_count !== undefined || newVals.lab_requests_count !== undefined)) {
                const dCount = Number(newVals.diagnoses_count) || 0;
                const pCount = Number(newVals.prescriptions_count) || 0;
                const lCount = Number(newVals.lab_requests_count) || 0;
                const parts = [];
                parts.push(`${dCount} ${dCount === 1 ? 'diagnosis' : 'diagnoses'}`);
                parts.push(`${pCount} ${pCount === 1 ? 'prescription' : 'prescriptions'}`);
                if (lCount > 0) {
                    parts.push(`${lCount} ${lCount === 1 ? 'lab request' : 'lab requests'}`);
                }
                additionalInfo = parts.join(' and ') + ' recorded';
            }
        } else if (action === 'ADD_ENCOUNTER_ADDENDUM') {
            primaryText = 'Clinical follow-up addendum note appended to consultation';
            if (reason) {
                additionalInfo = `Addendum note: "${escapeHtml(reason)}"`;
            }
        } else if (action === 'UPDATE_ALLERGIES_AT_INTAKE') {
            const allergyText = newVals && newVals.allergies_alerts !== undefined ? newVals.allergies_alerts : (oldVals ? oldVals.allergies_alerts : '');
            const isConfirmed = newVals && Boolean(newVals.allergies_confirmed_by_doctor);
            if (allergyText) {
                primaryText = `Patient allergy alerts updated: <strong>"${escapeHtml(allergyText)}"</strong>`;
            } else {
                primaryText = 'Patient allergy alerts cleared (No known allergies)';
            }
            additionalInfo = isConfirmed ? 'Confirmed by physician' : 'Recorded at front-desk intake (Pending physician verification)';
        } else if (action === 'BREAK_GLASS_ACCESS') {
            primaryText = 'Emergency "Break-Glass" access override granted to restricted patient record';
            if (reason) {
                additionalInfo = `Emergency justification: "${escapeHtml(reason)}"`;
            }
        } else if (action === 'REQUEST_STANDARD_ACCESS') {
            primaryText = 'Doctor requested emergency administrative access to patient medical record';
            if (reason) additionalInfo = `Clinical reason: "${escapeHtml(reason)}"`;
        } else if (action === 'APPROVE_ACCESS_REQUEST') {
            primaryText = 'Administrator approved emergency record access request (24-hour window)';
            if (reason) additionalInfo = `Administrative note: "${escapeHtml(reason)}"`;
        } else if (action === 'REJECT_ACCESS_REQUEST') {
            primaryText = 'Administrator rejected emergency record access request';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'ACKNOWLEDGE_AUDIT_FLAG') {
            primaryText = 'Administrator acknowledged and reviewed flagged emergency access event';
            if (reason) additionalInfo = `Audit note: "${escapeHtml(reason)}"`;
        } else if (action === 'VIEW_RECORD_APPROVED_ACCESS') {
            primaryText = 'Accessed patient medical chart via approved administrative access window';
        } else if (action === 'UPDATE_DOCTOR_SCHEDULE') {
            primaryText = 'Doctor weekly availability schedule updated';
            if (newVals && newVals.schedules_count) {
                additionalInfo = `${newVals.schedules_count} duty day(s) configured`;
            }
        } else if (action === 'VIEW_RECORD') {
            primaryText = 'Accessed patient medical chart and consultation history';
        } else if (action === 'VIEW_DEMOGRAPHICS') {
            primaryText = 'Accessed patient demographic profile card';
        } else if (action === 'REGISTER_PATIENT') {
            let name = '';
            if (newVals) {
                const mi = newVals.middle_initial ? ` ${newVals.middle_initial}.` : '';
                if (newVals.first_name || newVals.last_name) {
                    name = `${newVals.first_name || ''}${mi} ${newVals.last_name || ''}`.trim();
                }
            }
            primaryText = name ? `New patient registered: <strong>${escapeHtml(name)}</strong>` : 'New patient registered';
            const metaParts = [];
            if (newVals && newVals.gender) metaParts.push(`Gender: ${escapeHtml(newVals.gender)}`);
            if (newVals && newVals.date_of_birth) metaParts.push(`DOB: ${escapeHtml(formatDateTime(newVals.date_of_birth, null))}`);
            if (metaParts.length > 0) additionalInfo = metaParts.join(' &middot; ');
        } else if (action === 'REGISTER_WALKIN') {
            let name = '';
            if (newVals) {
                const mi = newVals.middle_initial ? ` ${newVals.middle_initial}.` : '';
                if (newVals.first_name || newVals.last_name) {
                    name = `${newVals.first_name || ''}${mi} ${newVals.last_name || ''}`.trim();
                }
            }
            primaryText = name ? `Walk-in patient registered: <strong>${escapeHtml(name)}</strong>` : 'Walk-in patient registered at front desk';
            const metaParts = [];
            if (newVals && newVals.gender) metaParts.push(`Gender: ${escapeHtml(newVals.gender)}`);
            if (newVals && newVals.date_of_birth) metaParts.push(`DOB: ${escapeHtml(formatDateTime(newVals.date_of_birth, null))}`);
            if (metaParts.length > 0) additionalInfo = metaParts.join(' &middot; ');
        } else if (action === 'EDIT_DEMOGRAPHICS') {
            primaryText = 'Patient demographic profile updated';
            const diffText = formatDiff(oldVals, newVals);
            if (diffText) additionalInfo = diffText;
            if (reason) {
                additionalInfo = (additionalInfo ? `${additionalInfo}<br>` : '') + `Reason: "${escapeHtml(reason)}"`;
            }
        } else if (action === 'ARCHIVE' || action === 'ARCHIVE_PATIENT') {
            primaryText = 'Patient record moved to Central Archive (soft-deleted)';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'RESTORE' || action === 'RESTORE_PATIENT') {
            primaryText = 'Patient record restored from Central Archive to active records';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'PURGE' || action === 'PURGE_PATIENT') {
            primaryText = 'Patient record permanently purged from database';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'CREATE_DOCTOR') {
            const docName = (newVals && newVals.full_name) || '';
            const uname = (newVals && newVals.username) || '';
            primaryText = docName ? `Doctor staff profile created for Dr. <strong>${escapeHtml(docName)}</strong>` : 'New doctor staff profile created';
            const metaParts = [];
            if (uname) metaParts.push(`Username: <code>${escapeHtml(uname)}</code>`);
            if (newVals && newVals.contact_no) metaParts.push(`Contact: ${escapeHtml(newVals.contact_no)}`);
            if (metaParts.length > 0) additionalInfo = metaParts.join(' &middot; ');
        } else if (action === 'UPDATE_DOCTOR') {
            const docName = (newVals && newVals.full_name) || item.target_name || '';
            primaryText = docName ? `Doctor staff profile updated for Dr. <strong>${escapeHtml(docName)}</strong>` : 'Doctor staff profile updated';
            const diffText = formatDiff(oldVals, newVals);
            if (diffText) additionalInfo = diffText;
            else if (newVals && newVals.contact_no) additionalInfo = `Contact: ${escapeHtml(newVals.contact_no)}`;
            if (reason) additionalInfo = (additionalInfo ? `${additionalInfo}<br>` : '') + `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'ARCHIVE_DOCTOR') {
            primaryText = 'Doctor staff profile moved to Central Archive (deactivated)';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'RESTORE_DOCTOR') {
            primaryText = 'Doctor staff profile restored from Central Archive back to active staff';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'PURGE_DOCTOR') {
            primaryText = 'Doctor staff profile permanently purged from database';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'CREATE_USER') {
            const uname = (newVals && newVals.username) || '';
            const role = (newVals && newVals.role_name) || '';
            primaryText = uname ? `User account created for <code>${escapeHtml(uname)}</code>` : 'New system user account created';
            if (role) additionalInfo = `Assigned Role: <strong>${escapeHtml(role)}</strong>`;
        } else if (action === 'UPDATE_USER') {
            const uname = (newVals && newVals.username) || item.target_name || '';
            primaryText = uname ? `User account updated for <code>${escapeHtml(uname)}</code>` : 'User account updated';
            const diffText = formatDiff(oldVals, newVals);
            if (diffText) additionalInfo = diffText;
            else if (newVals && newVals.role_name) additionalInfo = `Role: <strong>${escapeHtml(newVals.role_name)}</strong>`;
            if (reason) additionalInfo = (additionalInfo ? `${additionalInfo}<br>` : '') + `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'ARCHIVE_USER') {
            primaryText = 'User account moved to Central Archive (deactivated)';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'RESTORE_USER') {
            primaryText = 'User account restored from Central Archive (reactivated)';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'PURGE_USER') {
            primaryText = 'User account permanently purged from database';
            if (reason) additionalInfo = `Reason: "${escapeHtml(reason)}"`;
        } else if (action === 'UPDATE_PROFILE') {
            primaryText = 'User updated personal profile details';
            const changes = [];
            if (newVals) {
                if (newVals.username_changed) changes.push('Username changed');
                if (newVals.password_changed) changes.push('Password updated');
                if (newVals.contact_no) changes.push(`Contact number updated to ${escapeHtml(newVals.contact_no)}`);
            }
            if (changes.length > 0) additionalInfo = changes.join(' &middot; ');
            if (reason) additionalInfo = (additionalInfo ? `${additionalInfo}<br>` : '') + `Reason: "${escapeHtml(reason)}"`;
        } else {
            // Humanize any unrecognized action
            const readableAction = action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            primaryText = readableAction;
            const diffText = formatDiff(oldVals, newVals);
            if (diffText) {
                additionalInfo = diffText;
            } else if (newVals && typeof newVals === 'object') {
                const parts = [];
                for (const [k, v] of Object.entries(newVals)) {
                    if (v !== null && v !== undefined && v !== '') {
                        const kLabel = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        parts.push(`${kLabel}: ${escapeHtml(String(v))}`);
                    }
                }
                if (parts.length > 0) additionalInfo = parts.join(' &middot; ');
            }
            if (reason) {
                additionalInfo = (additionalInfo ? `${additionalInfo}<br>` : '') + `Reason: "${escapeHtml(reason)}"`;
            }
        }

        let detailsHtml = '';
        if (primaryText) {
            detailsHtml += `<div style="font-weight: 500; color: var(--text, #1e293b); line-height: 1.35;">${primaryText}</div>`;
        }
        if (additionalInfo) {
            detailsHtml += `<div class="text-muted" style="font-size: 0.8rem; margin-top: 0.2rem; line-height: 1.35;">${additionalInfo}</div>`;
        } else if (!primaryText && reason) {
            detailsHtml += `<div style="font-weight: 500; color: var(--text, #1e293b);"><strong>Reason:</strong> ${escapeHtml(reason)}</div>`;
        }

        // Collapsible raw technical details for IT auditing or developer reference if raw JSON is present
        const rawData = item.old_values || item.new_values;
        if (rawData) {
            let rawText = '';
            if (item.old_values && item.new_values) {
                rawText = `Old Values:\n${item.old_values}\n\nNew Values:\n${item.new_values}`;
            } else if (item.new_values) {
                rawText = `Values:\n${item.new_values}`;
            } else {
                rawText = `Values:\n${item.old_values}`;
            }
            detailsHtml += `
                <details style="margin-top: 0.35rem; font-size: 0.72rem; color: var(--text-muted, #64748b);">
                    <summary style="cursor: pointer; user-select: none;">View technical details</summary>
                    <pre style="margin: 0.25rem 0 0; padding: 0.35rem 0.5rem; font-size: 0.7rem; background: var(--bg-hover, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 4px; max-height: 100px; overflow: auto; white-space: pre-wrap; word-break: break-all;">${escapeHtml(rawText)}</pre>
                </details>
            `;
        }

        if (!detailsHtml) detailsHtml = '<span class="text-muted">—</span>';
        return detailsHtml;
    },

    renderPagination(p) {
        const pagEl = this.container.querySelector('#audit-pagination');
        if (!pagEl) return;

        if (p.total_pages <= 1) {
            pagEl.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">Showing ${p.total_items} records</span>`;
            return;
        }

        pagEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="text-muted" style="font-size: 0.85rem;">Page ${p.current_page} of ${p.total_pages} (${p.total_items} total)</span>
                <div class="pagination">
                    <button type="button" class="btn btn-sm btn-secondary" ${p.current_page <= 1 ? 'disabled' : ''} id="audit-prev-page">Prev</button>
                    <span style="font-weight: 600; padding: 0 0.5rem;">${p.current_page}</span>
                    <button type="button" class="btn btn-sm btn-secondary" ${p.current_page >= p.total_pages ? 'disabled' : ''} id="audit-next-page">Next</button>
                </div>
            </div>
        `;

        const prevBtn = pagEl.querySelector('#audit-prev-page');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadData();
                }
            });
        }

        const nextBtn = pagEl.querySelector('#audit-next-page');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentPage < p.total_pages) {
                    this.currentPage++;
                    this.loadData();
                }
            });
        }
    },

    async checkPendingBadge() {
        try {
            const res = await api.get('api/access_request_controller.php', { filter: 'pending', page_size: 1 });
            const total = res.data?.total || 0;
            const badge = this.container.querySelector('#pending-requests-badge');
            if (badge) {
                if (total > 0) {
                    badge.textContent = total;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {
            // Ignore badge polling errors silently
        }
    },

    async loadAccessRequests() {
        const tbody = this.container.querySelector('#access-requests-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading access requests...</td></tr>`;

        try {
            const res = await api.get('api/access_request_controller.php', {
                filter: this.requestsFilter,
                page: this.requestsPage,
                page_size: this.requestsPageSize
            });
            const items = res.data?.items || [];
            const total = res.data?.total || 0;
            const pages = res.data?.pages || 1;

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No access requests found matching the filter.</td></tr>`;
                this.renderRequestsPagination({ current_page: this.requestsPage, total_pages: pages, total_items: total });
                return;
            }

            tbody.innerHTML = items.map(it => this.renderRequestRow(it)).join('');
            this.renderRequestsPagination({ current_page: this.requestsPage, total_pages: pages, total_items: total });

            this.checkPendingBadge();
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2rem;">Failed to load access requests: ${escapeHtml(err.response?.data?.message || err.message)}</td></tr>`;
        }
    },

    renderRequestRow(item) {
        const isUrgent = item.mode === 'urgent';
        const isPending = item.status === 'pending';
        const isApproved = item.status === 'approved';
        const isRejected = item.status === 'rejected';
        const isFlagged = item.is_audit_flagged == 1;
        const isAuditReviewed = item.audit_reviewed == 1;

        let modeBadge = isUrgent
            ? `<span class="badge badge-status-breakglass">URGENT OVERRIDE</span>`
            : `<span class="badge badge-status-confirmed">STANDARD (24H)</span>`;

        let statusBadge = '';
        if (isPending) {
            statusBadge = `<span class="badge badge-status-scheduled">PENDING APPROVAL</span>`;
        } else if (isApproved) {
            const expires = item.expires_at ? `<div class="text-muted" style="font-size: 0.75rem;">Expires: ${escapeHtml(item.expires_at)}</div>` : '';
            statusBadge = `<span class="badge badge-status-active">APPROVED</span>${expires}`;
        } else if (isRejected) {
            statusBadge = `<span class="badge badge-status-critical">REJECTED</span>`;
        }

        let auditBadge = '';
        if (isFlagged) {
            auditBadge = isAuditReviewed
                ? `<div style="margin-top: 0.25rem;"><span class="badge badge-status-completed" style="font-size: 0.7rem;">AUDIT REVIEWED</span></div>`
                : `<div style="margin-top: 0.25rem;"><span class="badge badge-status-critical" style="font-size: 0.7rem;">FLAGGED FOR AUDIT</span></div>`;
        }

        let actionsHtml = '';
        if (isPending) {
            actionsHtml = `
                <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                    <button type="button" class="btn btn-sm btn-outline-success btn-approve-request" data-id="${item.request_id}" title="Approve for 24 Hours">
                        Approve (24h)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-reject-request" data-id="${item.request_id}" title="Reject Request">
                        Reject
                    </button>
                </div>
            `;
        } else if (isFlagged && !isAuditReviewed) {
            actionsHtml = `
                <div style="display: flex; justify-content: flex-end;">
                    <button type="button" class="btn btn-sm btn-outline-warning btn-ack-audit" data-id="${item.request_id}" title="Acknowledge & Sign-off Audit Override">
                        Acknowledge Audit
                    </button>
                </div>
            `;
        } else {
            const reviewer = item.reviewer_username ? `by <code>${escapeHtml(item.reviewer_username)}</code>` : '';
            actionsHtml = `<span class="text-muted" style="font-size: 0.8rem;">Reviewed ${reviewer}</span>`;
        }

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 0.82rem; vertical-align: middle;">${escapeHtml(item.requested_at)}</td>
                <td style="vertical-align: middle;">
                    <strong>Dr. ${escapeHtml(item.doctor_last)}, ${escapeHtml(item.doctor_first)}</strong>
                </td>
                <td style="vertical-align: middle;">
                    <strong>${escapeHtml(item.patient_last)}, ${escapeHtml(item.patient_first)}</strong>
                </td>
                <td style="vertical-align: middle;">${modeBadge}</td>
                <td style="vertical-align: middle;">${statusBadge}${auditBadge}</td>
                <td style="vertical-align: middle; max-width: 280px;">
                    <div style="font-size: 0.85rem; word-break: break-word;">${escapeHtml(item.reason || '')}</div>
                    ${item.review_notes ? `<div class="text-muted" style="font-size: 0.76rem; font-style: italic; margin-top: 0.2rem;">Notes: ${escapeHtml(item.review_notes)}</div>` : ''}
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">${actionsHtml}</td>
            </tr>
        `;
    },

    renderRequestsPagination(p) {
        const pagEl = this.container.querySelector('#requests-pagination');
        if (!pagEl) return;

        if (p.total_pages <= 1) {
            pagEl.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">Showing ${p.total_items} requests</span>`;
            return;
        }

        pagEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="text-muted" style="font-size: 0.85rem;">Page ${p.current_page} of ${p.total_pages} (${p.total_items} total)</span>
                <div class="pagination">
                    <button type="button" class="btn btn-sm btn-secondary" ${p.current_page <= 1 ? 'disabled' : ''} id="requests-prev-page">Prev</button>
                    <span style="font-weight: 600; padding: 0 0.5rem;">${p.current_page}</span>
                    <button type="button" class="btn btn-sm btn-secondary" ${p.current_page >= p.total_pages ? 'disabled' : ''} id="requests-next-page">Next</button>
                </div>
            </div>
        `;

        const prevBtn = pagEl.querySelector('#requests-prev-page');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.requestsPage > 1) {
                    this.requestsPage--;
                    this.loadAccessRequests();
                }
            });
        }

        const nextBtn = pagEl.querySelector('#requests-next-page');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.requestsPage < p.total_pages) {
                    this.requestsPage++;
                    this.loadAccessRequests();
                }
            });
        }
    },

    async approveRequest(requestId) {
        try {
            const res = await api.put('api/access_request_controller.php?action=approve', { request_id: requestId });
            showToast(res.message || 'Access request approved for 24 hours.', 'success');
            this.loadAccessRequests();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to approve request.', 'danger');
        }
    },

    async rejectRequest(requestId) {
        const notes = prompt('Enter rejection reason (optional):');
        if (notes === null) return;
        try {
            const res = await api.put('api/access_request_controller.php?action=reject', { request_id: requestId, notes: notes });
            showToast(res.message || 'Access request rejected.', 'success');
            this.loadAccessRequests();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to reject request.', 'danger');
        }
    },

    async acknowledgeAudit(requestId) {
        try {
            const res = await api.put('api/access_request_controller.php?action=acknowledge_audit', { request_id: requestId });
            showToast(res.message || 'Urgent break-glass audit review acknowledged and logged.', 'success');
            this.loadAccessRequests();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to acknowledge audit.', 'danger');
        }
    }
};

export default auditLogsModule;

