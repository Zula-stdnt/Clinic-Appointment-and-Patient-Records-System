// assets/js/modules/patients.js
// Manage Patients module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record (Reusable View/Edit modals populated by ID) & mysql_update_records (Reflexive UI refresh on save)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmRestore, confirmHardDelete } from '../ui.js?v=27';
import { renderPatientRecord } from '../components/patient-record-view.js?v=5';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        gender: '',
        sortBy: 'patient_id',
        sortOrder: 'ASC',
        total: 0,
        recordPatientId: null
    },

    async init(container) {
        this.container = container;
        this.renderStructure();
        this.attachEventListeners();
        await this.loadData();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card" id="patients-manage-card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Patients</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Patient directory and account governance</p>
                    </div>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="patients-search" class="form-control" placeholder="Search by name, contact, address...">
                        </div>

                        <select id="patients-gender-filter" class="form-control" style="width: auto; min-width: 140px;">
                            <option value="">All Genders</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                        </select>

                        <select id="patients-status-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="active">Active</option>
                            <option value="deleted">Archived</option>
                            <option value="all">All Statuses</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="patients-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="last_name">Patient Name</th>
                                <th data-sort="gender">Gender</th>
                                <th data-sort="date_of_birth">Date of Birth</th>
                                <th data-sort="contact_no">Contact No</th>
                                <th data-sort="deleted_at">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="patients-table-body">
                            <tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading patients...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="patients-pagination"></div>
            </div>

            <div id="patient-record-container" style="display: none;"></div>
        `;
    },

    attachEventListeners() {
        let timer = null;
        const searchInput = this.container.querySelector('#patients-search');
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.search = searchInput.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });


        this.container.querySelector('#patients-gender-filter').addEventListener('change', (e) => {
            this.state.gender = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        

        this.container.querySelector('#patients-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#patients-page-size').addEventListener('change', (e) => {
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
        const tbody = this.container.querySelector('#patients-table-body');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading patients...</td></tr>';

        try {
            const res = await api.get('api/patient_controller.php', {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                gender: this.state.gender,
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
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Failed to load patients: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#patients-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <strong>No patients found</strong>
                            <p>Try modifying your search or filter settings.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(p => {
            const fullName = `${p.last_name}, ${p.first_name}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;
            const genderFormatted = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'Unknown';
            const statusBadge = p.deleted_at
                ? '<span class="badge badge-status-deleted">Archived</span>'
                : '<span class="badge badge-status-active">Active</span>';

            const archiveBtn = !p.deleted_at ? `
                <button class="btn btn-outline-warning btn-sm btn-icon btn-archive" data-id="${p.patient_id}" data-name="${escapeHtml(fullName)}" title="Archive Patient" aria-label="Archive Patient">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            ` : `
                <button class="btn btn-outline-success btn-sm btn-icon btn-restore" data-id="${p.patient_id}" data-name="${escapeHtml(fullName)}" title="Restore Patient" aria-label="Restore Patient">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="16 1 21 5 16 9"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><polyline points="8 23 3 19 8 15"></polyline></svg>
                </button>
            `;

            return `
                <tr>
                    <td style="vertical-align: middle;"><strong>${escapeHtml(fullName)}</strong></td>
                    <td style="vertical-align: middle;">${escapeHtml(genderFormatted)}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.date_of_birth)}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.contact_no || '-')}</td>
                    <td style="vertical-align: middle;">${statusBadge}</td>
                    <td style="text-align: right; vertical-align: middle;">
                        <div class="actions-cell" style="justify-content: flex-end; display: flex; gap: 0.35rem;">
                            <button class="btn btn-outline-primary btn-sm btn-icon btn-record" data-id="${p.patient_id}" title="View Patient Record" aria-label="View Patient Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </button>
                            ${archiveBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-record').forEach(btn => {
            btn.addEventListener('click', () => this.viewPatientRecord(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        tbody.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', () => this.handleRestore(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#patients-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> patients</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="patients-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="patients-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#patients-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#patients-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    async viewPatientRecord(patientId) {
        const manageCard = this.container.querySelector('#patients-manage-card');
        const recContainer = this.container.querySelector('#patient-record-container');
        if (!manageCard || !recContainer) return;

        manageCard.style.display = 'none';
        recContainer.style.display = 'block';
        this.state.recordPatientId = patientId;
        recContainer.innerHTML = '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading patient record...</div>';

        try {
            const res = await api.get(`api/patient_record_controller.php?action=history&patient_id=${patientId}`);
            if (!res.success || !res.data) {
                throw new Error(res.message || 'Failed to load patient record.');
            }
            renderPatientRecord(recContainer, res.data, {
                viewerRole: 'Administrator',
                onBack: () => {
                    this.state.recordPatientId = null;
                    recContainer.style.display = 'none';
                    recContainer.innerHTML = '';
                    manageCard.style.display = 'block';
                }
            });
        } catch (err) {
            recContainer.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: var(--danger);">${escapeHtml(err.response?.data?.message || err.message || 'Failed to load patient record.')}</div>`;
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to archive patient record for "${name}"?`,
            onConfirm: async () => {
                try {
                    const res = await api.put(`api/patient_controller.php?action=soft_delete&id=${id}`);
                    showToast(res.message, 'warning');
                    this.loadData();
                } catch (err) {
                    showToast(err.response?.data?.message || err.message || 'Failed to archive patient record.', 'danger');
                    throw err;
                }
            }
        });
    },

    handleRestore(id, name) {
        confirmRestore({
            title: 'Restore Patient Record',
            itemName: name,
            message: `Are you sure you want to restore patient record for "${name}"?`,
            btnText: 'Restore',
            onConfirm: async () => {
                try {
                    const res = await api.put(`api/patient_controller.php?action=restore&id=${id}`);
                    showToast(res.message, 'success');
                    this.loadData();
                } catch (err) {
                    showToast(err.response?.data?.message || err.message || 'Failed to restore patient record.', 'danger');
                    throw err;
                }
            }
        });
    }
};


