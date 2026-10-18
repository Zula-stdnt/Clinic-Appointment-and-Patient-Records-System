// assets/js/modules/specialties.js
// Manage Specialties module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_insert_records & mysql_update_records (Modular CRUD and DOM container reset before re-render)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal, confirmAction, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=26';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        sortBy: 'specialty_id',
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
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Specialties</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Manage clinic departments and medical specialties</p>
                    </div>
                    <button id="btn-add-specialty" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Specialty
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="specialties-search" class="form-control" placeholder="Search specialty by name...">
                        </div>

                        <select id="specialties-status-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="active">Active</option>
                            <option value="deleted">Archived</option>
                            <option value="all">All Statuses</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="specialties-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="specialty_name">Specialty Name</th>
                                <th data-sort="deleted_at">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="specialties-table-body">
                            <tr><td colspan="3" class="text-center" style="padding: 2rem;">Loading specialties...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="specialties-pagination"></div>
            </div>

            <!-- Add/Edit Specialty Modal -->
            <div class="modal" id="specialty-form-modal" tabindex="-1" aria-labelledby="specialty-form-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <form id="specialty-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="specialty-form-title">Add New Specialty</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                        <div class="modal-body">
                            <input type="hidden" id="specialty-id">
                            <div class="form-group">
                                <label for="specialty-name">Specialty Name <span class="required-star">*</span></label>
                                <input type="text" id="specialty-name" class="form-control" required placeholder="e.g. Cardiology">
                                <div class="invalid-feedback" id="specialty-name-error"></div>
                            </div>
                        </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-specialty" class="btn btn-primary">Save Specialty</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- View Specialty Modal -->
            <div class="modal" id="specialty-view-modal" tabindex="-1" aria-labelledby="specialty-view-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="specialty-view-title">Specialty Details</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="specialty-view-body"></div>
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
        const searchInput = this.container.querySelector('#specialties-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.state.search = searchInput.value.trim();
                    this.state.page = 1;
                    this.loadData();
                }, 300);
            });
        }

        this.container.querySelector('#specialties-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#specialties-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-add-specialty').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#specialty-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSpecialty();
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
        const tbody = this.container.querySelector('#specialties-table-body');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 2rem;">Loading specialties...</td></tr>';

        try {
            const res = await api.get('api/specialty_controller.php', {
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
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">Failed to load specialties: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#specialties-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="empty-state">
                            <strong>No specialties found</strong>
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
                <button class="btn btn-outline-warning btn-sm btn-icon btn-archive" data-id="${s.specialty_id}" data-name="${escapeHtml(s.specialty_name)}" title="Archive Specialty" aria-label="Archive Specialty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            ` : '';

            return `
                <tr>
                    <td><strong>${escapeHtml(s.specialty_name)}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-outline-info btn-sm btn-icon btn-view" data-id="${s.specialty_id}" title="View Details" aria-label="View Details">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="btn btn-outline-primary btn-sm btn-icon btn-edit" data-id="${s.specialty_id}" title="Edit Record" aria-label="Edit Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            ${archiveBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewSpecialty(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        
        
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#specialties-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> specialties</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="specialties-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="specialties-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#specialties-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#specialties-next')?.addEventListener('click', () => {
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
        this.container.querySelector('#specialty-form').reset();
        this.container.querySelector('#specialty-id').value = '';
        this.container.querySelector('#specialty-form-title').textContent = 'Add New Specialty';
        openModal('specialty-form-modal');
    },

    async openEditModal(specialtyId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/specialty_controller.php', { id: specialtyId });
            if (!res.success) throw new Error(res.message);

            const s = res.data.specialty;
            this.container.querySelector('#specialty-id').value = s.specialty_id;
            this.container.querySelector('#specialty-name').value = s.specialty_name;

            this.container.querySelector('#specialty-form-title').textContent = `Edit Specialty: ${s.specialty_name}`;
            openModal('specialty-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveSpecialty() {
        this.clearFormErrors();

        const id = this.container.querySelector('#specialty-id').value;
        const name = this.container.querySelector('#specialty-name').value.trim();

        if (!name) {
            this.showFieldError('specialty-name', 'Specialty name is required.');
            return;
        }

        const payload = { specialty_name: name };
        const isEdit = Boolean(id);

        confirmAction({
            title: isEdit ? 'Confirm Specialty Update' : 'Confirm New Specialty',
            message: isEdit
                ? `Are you sure you want to save changes to specialty "${name}"?`
                : `Are you sure you want to create the specialty "${name}"?`,
            btnText: isEdit ? 'Save Changes' : 'Create Specialty',
            btnClass: 'btn btn-primary',
            cancelBtnText: 'Keep Editing',
            onConfirm: async () => {
                const saveBtn = this.container.querySelector('#btn-save-specialty');
                saveBtn.disabled = true;

                try {
                    let res;
                    if (id) {
                        res = await api.put(`api/specialty_controller.php?id=${id}`, payload);
                    } else {
                        res = await api.post('api/specialty_controller.php', payload);
                    }

                    if (res.success) {
                        showToast(res.message, 'success');
                        closeModal('specialty-form-modal', true);
                        this.loadData();
                    } else {
                        throw new Error(res.message);
                    }
                } catch (err) {
                    const data = err.response?.data;
                    if (data?.errors) {
                        const fieldMap = {
                            specialty_name: 'specialty-name',
                            description: 'specialty-description'
                        };
                        for (const [f, msg] of Object.entries(data.errors)) {
                            const targetId = fieldMap[f] || `specialty-${f.replace(/_/g, '-')}`;
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

    async viewSpecialty(specialtyId) {
        try {
            const res = await api.get('api/specialty_controller.php', { id: specialtyId });
            if (!res.success) throw new Error(res.message);

            const s = res.data.specialty;
            const body = this.container.querySelector('#specialty-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Specialty Name</th><td><strong>${escapeHtml(s.specialty_name)}</strong></td></tr>
                    <tr><th>Status</th><td>${s.deleted_at ? '<span class="badge badge-deleted">archived</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(s.created_at || 'N/A')}</td></tr>
                    ${s.deleted_at ? `<tr><th>archived At</th><td style="color: var(--danger);">${escapeHtml(s.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('specialty-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to deactivate specialty "${name}"? Inactive specialties cannot be assigned to doctors.`,
            onConfirm: async () => {
                const res = await api.put(`api/specialty_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


