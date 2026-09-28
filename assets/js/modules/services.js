// assets/js/modules/services.js
// Manage Services module (Non-negative price validation and CRUD)
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_insert_records & mysql_update_records (Async Axios CRUD with semantic hook classes .btn-view / .btn-edit / .btn-archive)

import api from '../api.js?v=7';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=22';

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
                        <p class="text-muted" style="font-size: 0.85rem;">Manage hospital medical procedures, laboratory examinations, and diagnostic tests</p>
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
                            <input type="text" id="services-search" class="form-control" placeholder="Search services by name...">
                        </div>

                        
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
                                <th data-sort="price">Price (PHP)</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="services-table-body">
                            <tr><td colspan="4" class="text-center" style="padding: 2rem;">Loading services...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="services-pagination"></div>
            </div>

            <!-- Add/Edit Service Modal -->
            <div class="modal-backdrop" id="service-form-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title" id="service-form-title">Add New Service</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <form id="service-form" novalidate>
                        <div class="modal-body">
                            <input type="hidden" id="service-id">
                            <div class="form-group">
                                <label for="service-name">Service Name <span class="required-star">*</span></label>
                                <input type="text" id="service-name" class="form-control" required placeholder="e.g. Complete Blood Count (CBC)">
                                <div class="invalid-feedback" id="service-name-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="service-price">Standard Price (PHP) <span class="required-star">*</span></label>
                                <input type="number" step="0.01" min="0" id="service-price" class="form-control" required placeholder="0.00">
                                <div class="invalid-feedback" id="service-price-error"></div>
                                <small class="text-muted">Price must be a non-negative number.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
                            <button type="submit" id="btn-save-service" class="btn btn-primary">Save Service</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- View Service Modal -->
            <div class="modal-backdrop" id="service-view-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Service Details</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" id="service-view-body"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-close-modal>Close</button>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        let timer = null;
        const searchInput = 

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

    async loadData() {
        const tbody = this.container.querySelector('#services-table-body');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem;">Loading services...</td></tr>';

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
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 2rem;">Failed to load services: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#services-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <strong>No services found</strong>
                            <p>Try modifying your search or filter settings.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(s => {
            

            const priceFormatted = parseFloat(s.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return `
                <tr>
                    <td><strong>${escapeHtml(s.service_name)}</strong></td>
                    <td>PHP ${escapeHtml(priceFormatted)}</td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-secondary btn-sm btn-view" data-id="${s.service_id}" title="View Details">View</button>
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${s.service_id}" title="Edit Record">Edit</button>
                            <button class="btn btn-warning btn-sm btn-archive" data-id="${s.service_id}" data-name="${escapeHtml(s.service_name)}" title="Archive">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
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
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> services</div>
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
            this.container.querySelector('#service-price').value = s.price;

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
        const price = this.container.querySelector('#service-price').value.trim();

        let hasErrors = false;
        if (!name) {
            this.showFieldError('service-name', 'Service name is required.');
            hasErrors = true;
        }

        if (price === '' || isNaN(price) || parseFloat(price) < 0) {
            this.showFieldError('service-price', 'Price must be a valid non-negative number.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            service_name: name,
            price: parseFloat(price)
        };

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
                closeModal('service-form-modal');
                this.loadData();
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [f, msg] of Object.entries(data.errors)) {
                    this.showFieldError(`service-${f.replace('_', '-')}`, msg);
                }
            }
            showToast(data?.message || err.message, 'danger');
        } finally {
            saveBtn.disabled = false;
        }
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
            const priceFormatted = parseFloat(s.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const body = this.container.querySelector('#service-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Service Name</th><td><strong>${escapeHtml(s.service_name)}</strong></td></tr>
                    <tr><th>Standard Price</th><td><strong>PHP ${escapeHtml(priceFormatted)}</strong></td></tr>
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
            message: `Are you sure you want to deactivate service "${name}"? Soft-deleted services cannot be added to new invoices.`,
            onConfirm: async () => {
                const res = await api.put(`api/service_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


