// assets/js/modules/archive.js
// Manage Archive module for viewing, restoring, and permanently deleting archived records

import api from '../api.js';
import { escapeHtml, showToast, confirmRestore, confirmHardDelete } from '../ui.js';

const CONFIG = {
    'users': {
        endpoint: 'api/user_controller.php',
        idField: 'user_id',
        nameField: 'full_name',
        columns: ['ID', 'Full Name', 'Username', 'Role', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.user_id}</strong></td>
            <td>${escapeHtml(item.full_name)}</td>
            <td><code>${escapeHtml(item.username)}</code></td>
            <td><span class="badge badge-role">${escapeHtml(item.role_name)}</span></td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    },
    'patients': {
        endpoint: 'api/patient_controller.php',
        idField: 'patient_id',
        nameField: (item) => `${item.last_name}, ${item.first_name}`,
        columns: ['ID', 'Name', 'Gender', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.patient_id}</strong></td>
            <td><strong>${escapeHtml(item.last_name)}, ${escapeHtml(item.first_name)}</strong></td>
            <td>${escapeHtml(item.gender ? item.gender.charAt(0).toUpperCase() + item.gender.slice(1) : 'Unknown')}</td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    },
    'doctors': {
        endpoint: 'api/doctor_controller.php',
        idField: 'doctor_id',
        nameField: (item) => `${item.last_name}, ${item.first_name}`,
        columns: ['ID', 'Name', 'Specialty', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.doctor_id}</strong></td>
            <td><strong>${escapeHtml(item.last_name)}, ${escapeHtml(item.first_name)}</strong></td>
            <td><span class="badge badge-role">${escapeHtml(item.specialty_names || 'General Medicine')}</span></td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    },
    'services': {
        endpoint: 'api/service_controller.php',
        idField: 'service_id',
        nameField: 'service_name',
        columns: ['ID', 'Service Name', 'Price', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.service_id}</strong></td>
            <td><strong>${escapeHtml(item.service_name)}</strong></td>
            <td>PHP ${escapeHtml(parseFloat(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    },
    'specialties': {
        endpoint: 'api/specialty_controller.php',
        idField: 'specialty_id',
        nameField: 'specialty_name',
        columns: ['ID', 'Specialty Name', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.specialty_id}</strong></td>
            <td><strong>${escapeHtml(item.specialty_name)}</strong></td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    },
    'discounts': {
        endpoint: 'api/discount_controller.php',
        idField: 'discount_id',
        nameField: 'discount_name',
        columns: ['ID', 'Discount Name', 'Percentage', 'Archived At'],
        renderRow: (item) => `
            <td><strong>#${item.discount_id}</strong></td>
            <td><strong>${escapeHtml(item.discount_name)}</strong></td>
            <td><span class="badge badge-role">${escapeHtml(parseFloat(item.percentage).toFixed(2))}%</span></td>
            <td style="color: var(--danger);">${escapeHtml(item.deleted_at)}</td>
        `
    }
};

export default {
    state: {
        currentEntity: 'users',
        page: 1,
        pageSize: 10,
        search: '',
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
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Archive</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Restore or permanently delete archived records</p>
                    </div>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <select id="archive-entity-filter" class="form-control" style="width: auto; min-width: 200px; font-weight: bold;">
                            <option value="users">Users</option>
                            <option value="patients">Patients</option>
                            <option value="doctors">Doctors</option>
                            <option value="services">Services</option>
                            <option value="specialties">Specialties</option>
                            <option value="discounts">Discounts</option>
                        </select>

                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="archive-search" class="form-control" placeholder="Search archived records...">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="archive-page-size" class="form-control" style="width: auto;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                        </select>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead id="archive-table-head">
                            <!-- Dynamic Columns -->
                        </thead>
                        <tbody id="archive-table-body">
                            <tr><td colspan="10" class="text-center" style="padding: 2rem;">Loading archive...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="archive-pagination"></div>
            </div>
        `;
    },

    attachEventListeners() {
        let timer = null;
        const searchInput = this.container.querySelector('#archive-search');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.search = e.target.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        this.container.querySelector('#archive-entity-filter').addEventListener('change', (e) => {
            this.state.currentEntity = e.target.value;
            this.state.search = '';
            searchInput.value = '';
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#archive-page-size').addEventListener('change', (e) => {
            this.state.pageSize = parseInt(e.target.value, 10);
            this.state.page = 1;
            this.loadData();
        });
    },

    async loadData() {
        const thead = this.container.querySelector('#archive-table-head');
        const tbody = this.container.querySelector('#archive-table-body');
        const entityConfig = CONFIG[this.state.currentEntity];

        // Setup headers dynamically
        thead.innerHTML = `<tr>${entityConfig.columns.map(c => `<th>${c}</th>`).join('')}<th style="text-align: right;">Actions</th></tr>`;
        tbody.innerHTML = `<tr><td colspan="${entityConfig.columns.length + 1}" class="text-center" style="padding: 2rem;">Loading ${this.state.currentEntity}...</td></tr>`;

        try {
            const res = await api.get(entityConfig.endpoint, {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: 'deleted'
            });

            if (res.success) {
                this.state.total = res.data.total;
                this.renderTable(res.data.items, entityConfig);
                this.renderPagination(res.data);
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="${entityConfig.columns.length + 1}" class="text-center text-muted" style="padding: 2rem;">Failed to load archive: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items, config) {
        const tbody = this.container.querySelector('#archive-table-body');
        
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${config.columns.length + 1}">
                        <div class="empty-state">
                            <strong>No archived records found</strong>
                            <p>There are no deleted ${this.state.currentEntity} matching your criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => {
            const id = item[config.idField];
            const name = typeof config.nameField === 'function' ? config.nameField(item) : item[config.nameField];

            return `
                <tr class="row-soft-deleted">
                    ${config.renderRow(item)}
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-success btn-sm btn-restore" data-id="${id}" data-name="${escapeHtml(name)}" title="Restore Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="16 1 21 5 16 9"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><polyline points="8 23 3 19 8 15"></polyline></svg>
                                Restore
                            </button>
                            <button class="btn btn-danger btn-sm btn-hard-delete" data-id="${id}" data-name="${escapeHtml(name)}" title="Permanently Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach action handlers
        tbody.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', () => this.handleRestore(btn.getAttribute('data-id'), btn.getAttribute('data-name'), config));
        });
        tbody.querySelectorAll('.btn-hard-delete').forEach(btn => {
            btn.addEventListener('click', () => this.handleHardDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name'), config));
        });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#archive-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> records</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="archive-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="archive-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#archive-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#archive-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    handleRestore(id, name, config) {
        confirmRestore({
            title: 'Restore Record',
            itemName: name,
            message: `Are you sure you want to restore "${name}"? It will become active again in the system.`,
            btnText: 'Restore',
            onConfirm: async () => {
                const res = await api.put(`${config.endpoint}?action=restore&id=${id}`);
                showToast(res.message, 'success');
                this.loadData();
            }
        });
    },

    handleHardDelete(id, name, config) {
        confirmHardDelete({
            itemName: name,
            typeToConfirmText: 'DELETE',
            onConfirm: async () => {
                try {
                    const res = await api.delete(`${config.endpoint}?id=${id}`);
                    showToast(res.message, 'success');
                    this.loadData();
                } catch (err) {
                    showToast(err.response?.data?.message || 'Failed to permanently delete record.', 'danger');
                }
            }
        });
    }
};

