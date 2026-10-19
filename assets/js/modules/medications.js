// assets/js/modules/medications.js
// Manage Medications module (formulary used by the Doctor consultation Rx picker)
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records, mysql_insert_records & mysql_update_records (Async Axios CRUD with semantic hook classes .btn-view / .btn-edit / .btn-archive)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal, confirmAction, confirmSoftDelete } from '../ui.js?v=26';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        sortBy: 'name',
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
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Medications</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Formulary catalog available to doctors when prescribing medications</p>
                    </div>
                    <button id="btn-add-medication" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Medication
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="medications-search" class="form-control" placeholder="Search by name, generic name, or manufacturer...">
                        </div>

                        <select id="medications-status-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="active">Active</option>
                            <option value="deleted">Archived</option>
                            <option value="all">All Statuses</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="medications-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="name">Medication Name</th>
                                <th data-sort="generic_name">Generic Name</th>
                                <th data-sort="manufacturer">Manufacturer</th>
                                <th data-sort="deleted_at">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="medications-table-body">
                            <tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading medications...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="medications-pagination"></div>
            </div>

            <!-- Add/Edit Medication Modal -->
            <div class="modal" id="medication-form-modal" tabindex="-1" aria-labelledby="medication-form-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <form id="medication-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="medication-form-title">Add New Medication</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <input type="hidden" id="medication-id">
                                <div class="form-group">
                                    <label for="medication-name">Medication Name <span class="required-star">*</span></label>
                                    <input type="text" id="medication-name" class="form-control" required placeholder="e.g. Biogesic">
                                    <div class="invalid-feedback" id="medication-name-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="medication-generic">Generic Name</label>
                                    <input type="text" id="medication-generic" class="form-control" placeholder="e.g. Paracetamol">
                                    <div class="invalid-feedback" id="medication-generic-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="medication-manufacturer">Manufacturer</label>
                                    <input type="text" id="medication-manufacturer" class="form-control" placeholder="e.g. Unilab">
                                    <div class="invalid-feedback" id="medication-manufacturer-error"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-medication" class="btn btn-primary">Save Medication</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- View Medication Modal -->
            <div class="modal" id="medication-view-modal" tabindex="-1" aria-labelledby="medication-view-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="medication-view-title">Medication Details</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="medication-view-body"></div>
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
        const searchInput = this.container.querySelector('#medications-search');
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

        this.container.querySelector('#medications-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#medications-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-add-medication').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#medication-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMedication();
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
        const tbody = this.container.querySelector('#medications-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading medications...</td></tr>';

        try {
            const res = await api.get('api/medication_controller.php', {
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Failed to load medications: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#medications-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <strong>No medications found</strong>
                            <p>Try modifying your search or add a new medication to the formulary.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(m => {
            const statusBadge = m.deleted_at
                ? '<span class="badge badge-status-deleted">Archived</span>'
                : '<span class="badge badge-status-active">Active</span>';

            const archiveBtn = !m.deleted_at ? `
                <button class="btn btn-outline-warning btn-sm btn-icon btn-archive" data-id="${m.medication_id}" data-name="${escapeHtml(m.name)}" title="Archive Medication" aria-label="Archive Medication">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            ` : '';

            return `
                <tr>
                    <td><strong>${escapeHtml(m.name)}</strong></td>
                    <td>${escapeHtml(m.generic_name || '—')}</td>
                    <td>${escapeHtml(m.manufacturer || '—')}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-outline-info btn-sm btn-icon btn-view" data-id="${m.medication_id}" title="View Details" aria-label="View Details">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="btn btn-outline-primary btn-sm btn-icon btn-edit" data-id="${m.medication_id}" title="Edit Record" aria-label="Edit Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            ${archiveBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewMedication(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#medications-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> medications</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="medications-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="medications-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#medications-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#medications-next')?.addEventListener('click', () => {
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
        this.container.querySelector('#medication-form').reset();
        this.container.querySelector('#medication-id').value = '';
        this.container.querySelector('#medication-form-title').textContent = 'Add New Medication';
        openModal('medication-form-modal');
    },

    async openEditModal(medicationId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/medication_controller.php', { id: medicationId });
            if (!res.success) throw new Error(res.message);

            const m = res.data.medication;
            this.container.querySelector('#medication-id').value = m.medication_id;
            this.container.querySelector('#medication-name').value = m.name;
            this.container.querySelector('#medication-generic').value = m.generic_name || '';
            this.container.querySelector('#medication-manufacturer').value = m.manufacturer || '';

            this.container.querySelector('#medication-form-title').textContent = `Edit Medication: ${m.name}`;
            openModal('medication-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveMedication() {
        this.clearFormErrors();

        const id = this.container.querySelector('#medication-id').value;
        const name = this.container.querySelector('#medication-name').value.trim();
        const generic = this.container.querySelector('#medication-generic').value.trim();
        const manufacturer = this.container.querySelector('#medication-manufacturer').value.trim();

        let hasErrors = false;
        if (!name) {
            this.showFieldError('medication-name', 'Medication name is required.');
            hasErrors = true;
        }
        if (hasErrors) return;

        const payload = {
            name,
            generic_name: generic,
            manufacturer
        };
        const isEdit = Boolean(id);

        confirmAction({
            title: isEdit ? 'Confirm Medication Update' : 'Confirm New Medication',
            message: isEdit
                ? `Are you sure you want to save changes to medication "${name}"?`
                : `Are you sure you want to add "${name}" to the medication formulary?`,
            btnText: isEdit ? 'Save Changes' : 'Add Medication',
            btnClass: 'btn btn-primary',
            cancelBtnText: 'Keep Editing',
            onConfirm: async () => {
                const saveBtn = this.container.querySelector('#btn-save-medication');
                saveBtn.disabled = true;

                try {
                    let res;
                    if (id) {
                        res = await api.put(`api/medication_controller.php?id=${id}`, payload);
                    } else {
                        res = await api.post('api/medication_controller.php', payload);
                    }

                    if (res.success) {
                        showToast(res.message, 'success');
                        closeModal('medication-form-modal', true);
                        this.loadData();
                    } else {
                        throw new Error(res.message);
                    }
                } catch (err) {
                    const data = err.response?.data;
                    if (data?.errors) {
                        const fieldMap = {
                            name: 'medication-name',
                            generic_name: 'medication-generic',
                            manufacturer: 'medication-manufacturer'
                        };
                        for (const [f, msg] of Object.entries(data.errors)) {
                            const targetId = fieldMap[f] || `medication-${f.replace(/_/g, '-')}`;
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

    async viewMedication(medicationId) {
        try {
            const res = await api.get('api/medication_controller.php', { id: medicationId });
            if (!res.success) throw new Error(res.message);

            const m = res.data.medication;
            const body = this.container.querySelector('#medication-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Medication Name</th><td><strong>${escapeHtml(m.name)}</strong></td></tr>
                    <tr><th>Generic Name</th><td>${escapeHtml(m.generic_name || '—')}</td></tr>
                    <tr><th>Manufacturer</th><td>${escapeHtml(m.manufacturer || '—')}</td></tr>
                    <tr><th>Status</th><td><span class="badge badge-active">Active</span></td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(m.created_at || 'N/A')}</td></tr>
                </table>
            `;
            openModal('medication-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to archive medication "${name}"? Archived medications cannot be selected in new prescriptions.`,
            onConfirm: async () => {
                const res = await api.put(`api/medication_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    }
};
