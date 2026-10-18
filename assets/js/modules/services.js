// assets/js/modules/Services.js
// Manage Services module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_insert_records & mysql_update_records (Modular CRUD and DOM container reset before re-render)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal, confirmAction, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=26';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        sortBy: 'service_id',
        sortOrder: 'ASC',
        total: 0
    },

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.attachEventListeners();
        await this.loadData();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Services</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Manage clinic administrative service catalog</p>
                    </div>
                    <button id="btn-add-service" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Service
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="services-search" class="form-control" placeholder="Search Service by name...">
                        </div>

                        <select id="services-status-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="active">Active</option>
                            <option value="deleted">Archived</option>
                            <option value="all">All Statuses</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="services-page-size" class="form-control" style="width: auto;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                        </select>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th data-sort="service_name">Service Name</th>
                                <th data-sort="deleted_at">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="services-table-body">
                            <tr><td colspan="3" class="text-center" style="padding: 2rem;">Loading Services...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="services-pagination"></div>
            </div>

            <!-- Add/Edit Service Modal -->
            <div class="modal" id="service-form-modal" tabindex="-1" aria-labelledby="service-form-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="service-form-title">Add New Service</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="service-form" novalidate>
                            <div class="modal-body">
                                <input type="hidden" id="service-id">
                                <div class="form-group">
                                    <label for="service-name">Service Name <span class="required-star">*</span></label>
                                    <input type="text" id="service-name" class="form-control" required placeholder="e.g. Cardiology">
                                    <div class="invalid-feedback" id="service-name-error"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-service" class="btn btn-primary">Save Service</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- View Service Modal -->
            <div class="modal" id="service-view-modal" tabindex="-1" aria-labelledby="service-view-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="service-view-title">Service Details</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="service-view-body"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        let timer = null;
        const searchInput = this.container.querySelector('#services-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.state.search = e.target.value;
                    this.state.page = 1;
                    this.loadData();
                }, 300);
            });
        }
        this.container.querySelector('#services-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#services-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-add-service').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#service-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveService();
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
        const tbody = this.container.querySelector('#services-table-body');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 2rem;">Loading Services...</td></tr>';

        try {
            const res = await api.get('api/service_controller.php', {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                sort_by: this.state.sortBy,
                sort_order: this.state.sortOrder
            });

            if (res.success) {
                this.state.total = res.data.total;
                this.renderTable(res.data.items);
                this.renderPagination(res.data);
                this.updateSortHeaders();
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">Failed to load Services: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#services-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="empty-state">
                            <strong>No Services found</strong>
                            <p>Try modifying your search or filter settings.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(s => {
            const statusBadge = s.deleted_at
                ? '<span class="badge badge-status-deleted">Archived</span>'
                : '<span class="badge badge-status-active">Active</span>';

            const archiveBtn = !s.deleted_at ? `
                <button class="btn btn-outline-warning btn-sm btn-icon btn-archive" data-id="${s.service_id}" data-name="${escapeHtml(s.service_name)}" title="Archive Service" aria-label="Archive Service">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            ` : '';

            return `
                <tr>
                    <td><strong>${escapeHtml(s.service_name)}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-outline-info btn-sm btn-icon btn-view" data-id="${s.service_id}" title="View Details" aria-label="View Details">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="btn btn-outline-primary btn-sm btn-icon btn-edit" data-id="${s.service_id}" title="Edit Record" aria-label="Edit Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            ${archiveBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewService(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        
        
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#services-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> Services</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="services-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="services-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#services-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#services-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    clearFormErrors() {
        this.container.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
        this.container.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    },

    openAddModal() {
        this.clearFormErrors();
        this.container.querySelector('#service-form').reset();
        this.container.querySelector('#service-id').value = '';
        this.container.querySelector('#service-form-title').textContent = 'Add New Service';
        openModal('service-form-modal');
    },

    async openEditModal(serviceId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/service_controller.php', { id: serviceId });
            if (!res.success) throw new Error(res.message);

            const s = res.data.service;
            this.container.querySelector('#service-id').value = s.service_id;
            this.container.querySelector('#service-name').value = s.service_name;

            this.container.querySelector('#service-form-title').textContent = `Edit Service: ${s.service_name}`;
            openModal('service-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveService() {
        this.clearFormErrors();

        const id = this.container.querySelector('#service-id').value;
        const name = this.container.querySelector('#service-name').value.trim();

        if (!name) {
            this.showFieldError('service-name', 'Service name is required.');
            return;
        }

        const payload = { service_name: name };
        const isEdit = Boolean(id);

        confirmAction({
            title: isEdit ? 'Confirm Service Update' : 'Confirm New Service',
            message: isEdit
                ? `Are you sure you want to save changes to service "${name}"?`
                : `Are you sure you want to create the clinical service "${name}"?`,
            btnText: isEdit ? 'Save Changes' : 'Create Service',
            btnClass: 'btn btn-primary',
            cancelBtnText: 'Keep Editing',
            onConfirm: async () => {
                const saveBtn = this.container.querySelector('#btn-save-service');
                saveBtn.disabled = true;

                try {
                    let res;
                    if (id) {
                        res = await api.put(`api/service_controller.php?id=${id}`, payload);
                    } else {
                        res = await api.post('api/service_controller.php', payload);
                    }

                    if (res.success) {
                        showToast(res.message, 'success');
                        closeModal('service-form-modal', true);
                        this.loadData();
                    } else {
                        throw new Error(res.message);
                    }
                } catch (err) {
                    const data = err.response?.data;
                    if (data?.errors) {
                        const fieldMap = {
                            service_name: 'service-name',
                            description: 'service-description'
                        };
                        for (const [f, msg] of Object.entries(data.errors)) {
                            const targetId = fieldMap[f] || `service-${f.replace(/_/g, '-')}`;
                            this.showFieldError(targetId, msg);
                        }
                    }
                    showToast(data?.message || err.message, 'danger');
                } finally {
                    saveBtn.disabled = false;
                }
            }
        });
    },

    showFieldError(fieldId, message) {
        const input = this.container.querySelector(`#${fieldId}`);
        const feedback = this.container.querySelector(`#${fieldId}-error`);
        if (input) input.classList.add('is-invalid');
        if (feedback) feedback.textContent = message;
    },

    async viewService(serviceId) {
        try {
            const res = await api.get('api/service_controller.php', { id: serviceId });
            if (!res.success) throw new Error(res.message);

            const s = res.data.service;
            const body = this.container.querySelector('#service-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Service Name</th><td><strong>${escapeHtml(s.service_name)}</strong></td></tr>
                    <tr><th>Status</th><td>${s.deleted_at ? '<span class="badge badge-deleted">archived</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(s.created_at || 'N/A')}</td></tr>
                    ${s.deleted_at ? `<tr><th>archived At</th><td style="color: var(--danger);">${escapeHtml(s.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('service-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to deactivate Service "${name}"? Inactive services will not be available.`,
            onConfirm: async () => {
                const res = await api.put(`api/service_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


