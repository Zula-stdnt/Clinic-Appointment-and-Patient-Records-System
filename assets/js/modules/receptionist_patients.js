// assets/js/modules/receptionist_patients.js
// Front-desk Patient Register: search the patient directory and register new patients
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records (paginated, filterable SELECT)
// & mysql_insert_records (registration through the shared patient form component)

import api from '../api.js?v=7';
import { escapeHtml } from '../ui.js?v=24';
import { PatientRegisterForm } from '../components/patient-register.js?v=1';
import { printBlankForm } from '../components/print-appointment-form.js?v=2';
import { renderPatientRecord } from '../components/patient-record-view.js?v=3';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        gender: '',
        status: 'active',
        sortBy: 'patient_id',
        sortOrder: 'ASC',
        total: 0
    },

    async init(container) {
        this.container = container;
        this.state.page = 1;
        this.state.search = '';
        this.state.gender = '';
        this.state.status = 'active';
        this.state.sortBy = 'patient_id';
        this.state.sortOrder = 'ASC';

        this.renderStructure();
        this.setupRegisterForm();
        this.attachEventListeners();
        await this.loadData();
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card" id="patient-register-card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Patient Records</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Look up existing patients, view their visit records, and register new ones at the front desk.</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button id="btn-print-blank-form" class="btn btn-secondary" title="Print a blank form for the patient to fill out by hand">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Blank Form
                        </button>
                        <button id="btn-register-new-patient" class="btn btn-primary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                            Register Patient
                        </button>
                    </div>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="register-search" class="form-control" placeholder="Search by name, contact, address...">
                        </div>

                        <select id="register-gender-filter" class="form-control" style="width: auto; min-width: 140px;">
                            <option value="">All Genders</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="register-page-size" class="form-control" style="width: auto;">
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
                                <th>Patient ID</th>
                                <th data-sort="last_name">Patient Name</th>
                                <th>Gender</th>
                                <th data-sort="date_of_birth">Date of Birth</th>
                                <th>Contact No</th>
                                <th data-sort="created_at">Registered</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="register-table-body">
                            <tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading patients...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="register-pagination"></div>
            </div>

            <div id="patient-record-container" style="display: none;"></div>
        `;
    },

    setupRegisterForm() {
        this.registerForm = new PatientRegisterForm({
            container: this.container,
            modalId: 'register-patient-modal',
            onRegistered: () => {
                this.state.page = 1;
                this.loadData();
            }
        });
    },

    attachEventListeners() {
        let searchTimer = null;
        const searchInput = this.container.querySelector('#register-search');
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this.state.search = searchInput.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        this.container.querySelector('#register-gender-filter').addEventListener('change', (e) => {
            this.state.gender = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#register-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-register-new-patient').addEventListener('click', () => {
            this.registerForm.open();
        });

        this.container.querySelector('#btn-print-blank-form').addEventListener('click', () => {
            printBlankForm();
        });

        this.container.querySelector('#register-table-body').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view-patient');
            if (btn) {
                this.viewPatientRecord(btn.getAttribute('data-id'));
            }
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#register-table-body');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">Loading patients...</td></tr>';

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
            } else {
                throw new Error(res.message || 'Failed to load patients.');
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to load patients.';
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#register-table-body');

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <strong>No patients found</strong>
                            <p>Register a new patient or adjust your search and filters.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(p => {
            const fullName = `${p.last_name}, ${p.first_name}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;
            const gender = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'Unknown';

            return `
                <tr>
                    <td><strong>PAT-${String(p.patient_id).padStart(4, '0')}</strong></td>
                    <td><strong>${escapeHtml(fullName)}</strong></td>
                    <td>${escapeHtml(gender)}</td>
                    <td>${escapeHtml(p.date_of_birth || '-')}</td>
                    <td>${escapeHtml(p.contact_no || '-')}</td>
                    <td>${escapeHtml(this.formatDate(p.created_at))}</td>
                    <td style="text-align: right;">
                        <button type="button" class="btn btn-secondary btn-sm btn-view-patient" data-id="${p.patient_id}" title="View Record">View</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    formatDate(value) {
        if (!value) return '-';
        const parsed = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#register-pagination');
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
                <button class="btn btn-secondary btn-sm" id="register-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="register-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#register-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#register-next')?.addEventListener('click', () => {
            if (this.state.page < pages) {
                this.state.page++;
                this.loadData();
            }
        });
    },

    async viewPatientRecord(patientId) {
        const registerCard = this.container.querySelector('#patient-register-card');
        const recContainer = this.container.querySelector('#patient-record-container');
        if (!registerCard || !recContainer) return;

        registerCard.style.display = 'none';
        recContainer.style.display = 'block';
        recContainer.innerHTML = '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading patient record...</div>';

        try {
            const res = await api.get(`api/patient_record_controller.php?action=history&patient_id=${patientId}`);
            if (!res.success || !res.data) {
                throw new Error(res.message || 'Failed to load patient record.');
            }
            renderPatientRecord(recContainer, res.data, {
                viewerRole: 'Receptionist',
                onBack: () => {
                    recContainer.style.display = 'none';
                    recContainer.innerHTML = '';
                    registerCard.style.display = 'block';
                }
            });
        } catch (err) {
            recContainer.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: var(--danger);">${escapeHtml(err.response?.data?.message || err.message || 'Failed to load patient record.')}</div>`;
        }
    }
};
