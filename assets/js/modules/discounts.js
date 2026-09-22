// assets/js/modules/discounts.js
// Manage Discounts module (Strict 0-100% validation on client and server)

import api from '../api.js';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmHardDelete } from '../ui.js';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        sortBy: 'discount_id',
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
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Discounts</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Manage statutory discounts (Senior, PWD, PhilHealth) and institutional concessions</p>
                    </div>
                    <button id="btn-add-discount" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Discount
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="discounts-search" class="form-control" placeholder="Search discounts by name...">
                        </div>

                        
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="discounts-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="discount_id">ID</th>
                                <th data-sort="discount_name">Discount Name</th>
                                <th data-sort="percentage">Percentage (%)</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="discounts-table-body">
                            <tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading discounts...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="discounts-pagination"></div>
            </div>

            <!-- Add/Edit Discount Modal -->
            <div class="modal-backdrop" id="discount-form-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title" id="discount-form-title">Add New Discount</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <form id="discount-form" novalidate>
                        <div class="modal-body">
                            <input type="hidden" id="discount-id">
                            <div class="form-group">
                                <label for="discount-name">Discount Name <span class="required-star">*</span></label>
                                <input type="text" id="discount-name" class="form-control" required placeholder="e.g. Senior Citizen Discount">
                                <div class="invalid-feedback" id="discount-name-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="discount-percentage">Percentage (%) <span class="required-star">*</span></label>
                                <input type="number" step="0.01" min="0" max="100" id="discount-percentage" class="form-control" required placeholder="0.00">
                                <div class="invalid-feedback" id="discount-percentage-error"></div>
                                <small class="text-muted">Must be between 0 and 100 inclusive.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
                            <button type="submit" id="btn-save-discount" class="btn btn-primary">Save Discount</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- View Discount Modal -->
            <div class="modal-backdrop" id="discount-view-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Discount Details</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" id="discount-view-body"></div>
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

        this.container.querySelector('#discounts-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-add-discount').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#discount-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDiscount();
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#discounts-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading discounts...</td></tr>';

        try {
            const res = await api.get('api/discount_controller.php', {
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Failed to load discounts: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#discounts-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <strong>No discounts found</strong>
                            <p>Try modifying your search or filter settings.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(d => {
            

            const percentageFormatted = parseFloat(d.percentage).toFixed(2);

            return `
                <tr>
                    <td><strong>#${d.discount_id}</strong></td>
                    <td><strong>${escapeHtml(d.discount_name)}</strong></td>
                    <td><span class="badge badge-role">${escapeHtml(percentageFormatted)}%</span></td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-secondary btn-sm btn-view" data-id="${d.discount_id}" title="View Details">View</button>
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${d.discount_id}" title="Edit Record">Edit</button>
                            <button class="btn btn-warning btn-sm btn-archive" data-id="${d.discount_id}" data-name="${escapeHtml(d.discount_name)}" title="Archive">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewDiscount(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        
        
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#discounts-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> discounts</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="discounts-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="discounts-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#discounts-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#discounts-next')?.addEventListener('click', () => {
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
        this.container.querySelector('#discount-form').reset();
        this.container.querySelector('#discount-id').value = '';
        this.container.querySelector('#discount-form-title').textContent = 'Add New Discount';
        openModal('discount-form-modal');
    },

    async openEditModal(discountId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/discount_controller.php', { id: discountId });
            if (!res.success) throw new Error(res.message);

            const d = res.data.discount;
            this.container.querySelector('#discount-id').value = d.discount_id;
            this.container.querySelector('#discount-name').value = d.discount_name;
            this.container.querySelector('#discount-percentage').value = d.percentage;

            this.container.querySelector('#discount-form-title').textContent = `Edit Discount: ${d.discount_name}`;
            openModal('discount-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveDiscount() {
        this.clearFormErrors();

        const id = this.container.querySelector('#discount-id').value;
        const name = this.container.querySelector('#discount-name').value.trim();
        const pctInput = this.container.querySelector('#discount-percentage').value.trim();

        let hasErrors = false;
        if (!name) {
            this.showFieldError('discount-name', 'Discount name is required.');
            hasErrors = true;
        }

        const pct = parseFloat(pctInput);
        if (pctInput === '' || isNaN(pct) || pct < 0 || pct > 100) {
            this.showFieldError('discount-percentage', 'Percentage must be between 0 and 100 inclusive.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            discount_name: name,
            percentage: pct
        };

        const saveBtn = this.container.querySelector('#btn-save-discount');
        saveBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await api.put(`api/discount_controller.php?id=${id}`, payload);
            } else {
                res = await api.post('api/discount_controller.php', payload);
            }

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('discount-form-modal');
                this.loadData();
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [f, msg] of Object.entries(data.errors)) {
                    this.showFieldError(`discount-${f.replace('_', '-')}`, msg);
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

    async viewDiscount(discountId) {
        try {
            const res = await api.get('api/discount_controller.php', { id: discountId });
            if (!res.success) throw new Error(res.message);

            const d = res.data.discount;
            const body = this.container.querySelector('#discount-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Discount ID</th><td>#${d.discount_id}</td></tr>
                    <tr><th>Discount Name</th><td><strong>${escapeHtml(d.discount_name)}</strong></td></tr>
                    <tr><th>Percentage</th><td><strong>${escapeHtml(parseFloat(d.percentage).toFixed(2))}%</strong></td></tr>
                    <tr><th>Status</th><td>${d.deleted_at ? '<span class="badge badge-deleted">archived</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(d.created_at || 'N/A')}</td></tr>
                    ${d.deleted_at ? `<tr><th>archived At</th><td style="color: var(--danger);">${escapeHtml(d.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('discount-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to deactivate discount "${name}"? Soft-deleted discounts cannot be applied to new patient invoices.`,
            onConfirm: async () => {
                const res = await api.put(`api/discount_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


