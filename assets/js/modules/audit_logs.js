// assets/js/modules/audit_logs.js
// Compliance & Audit Logs module for Administrator oversight

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';

const auditLogsModule = {
    container: null,
    currentPage: 1,
    pageSize: 10,
    currentAction: '',
    searchQuery: '',
    dateFilter: 'all',
    sortBy: 'created_at',
    sortOrder: 'DESC',

    init(container) {
        this.container = container;
        this.render();
        this.attachEventListeners();
        this.loadData();
    },

    render() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">System Compliance & Audit Logs</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Review security events, patient record access, demographic changes, and emergency overrides</p>
                    </div>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <select id="audit-action-filter" class="form-control" style="width: auto; min-width: 180px;">
                            <option value="">All Actions</option>
                            <option value="BREAK_GLASS_ACCESS">Emergency Break-Glass</option>
                            <option value="VIEW_RECORD">Medical Record Views</option>
                            <option value="VIEW_DEMOGRAPHICS">Demographics Views</option>
                            <option value="EDIT_DEMOGRAPHICS">Demographics Edited</option>
                            <option value="CANCEL_REQUEST">Cancellation Requests</option>
                            <option value="CANCEL_APPOINTMENT">Cancelled Appointments</option>
                            <option value="REGISTER_PATIENT">Patient Registrations</option>
                            <option value="REGISTER_WALKIN">Walk-in Registrations</option>
                            <option value="CREATE_USER">User Creations</option>
                            <option value="UPDATE_USER">User Updates</option>
                            <option value="ARCHIVE">Archive Events</option>
                            <option value="RESTORE">Restore Events</option>
                        </select>

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
        `;
    },

    attachEventListeners() {
        const actionFilter = this.container.querySelector('#audit-action-filter');
        if (actionFilter) {
            actionFilter.addEventListener('change', (e) => {
                this.currentAction = e.target.value;
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
        else if (item.action.includes('CANCEL')) actionBadgeClass = 'badge-status-critical';
        else if (item.action.includes('CREATE') || item.action.includes('REGISTER')) actionBadgeClass = 'badge-status-active';
        else if (item.action.includes('EDIT') || item.action.includes('UPDATE')) actionBadgeClass = 'badge-status-scheduled';
        else if (item.action.includes('VIEW')) actionBadgeClass = 'badge-status-confirmed';

        let entityLabel = item.entity_type ? `${escapeHtml(item.entity_type.toUpperCase())} #${escapeHtml(String(item.entity_id || ''))}` : '<span class="text-muted">—</span>';

        let detailsHtml = '';
        if (item.reason) {
            detailsHtml += `<div style="font-weight: 500; color: var(--text);"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>`;
        }
        if (item.old_values_parsed || item.new_values_parsed) {
            const oldVals = item.old_values_parsed ? JSON.stringify(item.old_values_parsed) : '';
            const newVals = item.new_values_parsed ? JSON.stringify(item.new_values_parsed) : '';
            if (oldVals && newVals) {
                detailsHtml += `<div class="text-muted" style="font-size: 0.75rem;"><strong>Diff:</strong> ${escapeHtml(oldVals)} &rarr; ${escapeHtml(newVals)}</div>`;
            } else if (newVals) {
                detailsHtml += `<div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(newVals)}</div>`;
            }
        } else if (!item.reason && item.new_values) {
            detailsHtml += `<div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(item.new_values)}</div>`;
        }
        if (!detailsHtml) detailsHtml = '<span class="text-muted">—</span>';

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 0.82rem;">${escapeHtml(item.created_at)}</td>
                <td>
                    <strong>${escapeHtml(item.full_name)}</strong>
                    <div class="text-muted" style="font-size: 0.78rem;"><code>${escapeHtml(item.username)}</code> &middot; ${escapeHtml(item.role_name)}</div>
                </td>
                <td><span class="badge ${actionBadgeClass}">${escapeHtml(item.action)}</span></td>
                <td>${entityLabel}</td>
                <td style="max-width: 320px; word-break: break-word; font-size: 0.85rem;">${detailsHtml}</td>
                <td style="font-size: 0.8rem; font-family: monospace;">${escapeHtml(item.ip_address || '—')}</td>
            </tr>
        `;
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
    }
};

export default auditLogsModule;

