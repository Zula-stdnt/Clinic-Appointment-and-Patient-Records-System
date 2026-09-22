// assets/js/modules/doctors.js
// Manage Doctors module (with active specialty selection and FK appointment delete handling)

import api from '../api.js?v=7';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=7';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        specialtyId: '',
        sortBy: 'doctor_id',
        sortOrder: 'ASC',
        total: 0,
        specialties: []
    },

    async init(container) {
        this.container = container;
        await this.loadSpecialties();
        this.renderStructure();
        this.attachEventListeners();
        await this.loadData();
    },

    async loadSpecialties() {
        try {
            const res = await api.get('api/doctor_controller.php', { meta: 'specialties' });
            if (res.success && res.data.specialties) {
                this.state.specialties = res.data.specialties;
            }
        } catch (err) {
            console.error('Failed to load active specialties', err);
        }
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Doctors</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Manage hospital medical staff and clinical specialties</p>
                    </div>
                    <button id="btn-add-doctor" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Doctor
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="doctors-search" class="form-control" placeholder="Search doctor by name, specialty...">
                        </div>

                        <select id="doctors-specialty-filter" class="form-control" style="width: auto; min-width: 170px;">
                            <option value="">All Specialties</option>
                            ${this.state.specialties.map(s => `<option value="${s.specialty_id}">${escapeHtml(s.specialty_name)}</option>`).join('')}
                        </select>

                        
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="doctors-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="last_name">Doctor Name</th>
                                <th data-sort="specialty_name">Specialty</th>
                                <th>Contact No</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="doctors-table-body">
                            <tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading doctors...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="doctors-pagination"></div>
            </div>

            <!-- Add/Edit Doctor Modal -->
            <div class="modal-backdrop" id="doctor-form-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title" id="doctor-form-title">Add New Doctor</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <form id="doctor-form" novalidate>
                        <div class="modal-body">
                            <input type="hidden" id="doctor-id">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="doctor-first-name">First Name <span class="required-star">*</span></label>
                                    <input type="text" id="doctor-first-name" class="form-control" required placeholder="First name">
                                    <div class="invalid-feedback" id="doctor-first-name-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="doctor-last-name">Last Name <span class="required-star">*</span></label>
                                    <input type="text" id="doctor-last-name" class="form-control" required placeholder="Last name">
                                    <div class="invalid-feedback" id="doctor-last-name-error"></div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="doctor-middle-initial">Middle Initial</label>
                                    <input type="text" id="doctor-middle-initial" class="form-control" maxlength="5" placeholder="M.I.">
                                    <div class="invalid-feedback" id="doctor-middle-initial-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="doctor-gender">Gender <span class="required-star">*</span></label>
                                    <select id="doctor-gender" class="form-control" required>
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div class="invalid-feedback" id="doctor-gender-error"></div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="doctor-specialty-id">Clinical Specialties <span class="required-star">*</span></label>
                                <select id="doctor-specialty-id" class="form-control" multiple size="6">
                                    ${this.state.specialties.map(s => `<option value="${s.specialty_id}">${escapeHtml(s.specialty_name)}</option>`).join('')}
                                </select>
                                <small class="text-muted" style="display: block; margin-top: 0.25rem;">Hold Ctrl (Windows) or Cmd (Mac) to select more than one specialty.</small>
                                <div class="invalid-feedback" id="doctor-specialty-id-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="doctor-contact">Contact Number</label>
                                <input type="text" id="doctor-contact" class="form-control" placeholder="e.g. 09171234567">
                                <div class="invalid-feedback" id="doctor-contact-error"></div>
                            </div>

                            <hr style="margin: 1.5rem 0; border: 0; border-top: 1px solid var(--border);">
                            <h4 style="margin-bottom: 1rem; font-size: 1rem;">Login Credentials</h4>
                            
                            <div class="form-group">
                                <label for="doctor-username">Username <span class="required-star">*</span></label>
                                <input type="text" id="doctor-username" class="form-control" required placeholder="e.g. dr.johndoe">
                                <div class="invalid-feedback" id="doctor-username-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="doctor-password" id="doctor-password-label">Password <span class="required-star">*</span></label>
                                <input type="password" id="doctor-password" class="form-control" placeholder="Min. 6 characters">
                                <div class="invalid-feedback" id="doctor-password-error"></div>
                                <small class="text-muted" id="doctor-password-hint" style="display: none; margin-top: 0.25rem;">Leave blank to keep password unchanged.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
                            <button type="submit" id="btn-save-doctor" class="btn btn-primary">Save Doctor</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- View Doctor Modal -->
            <div class="modal-backdrop" id="doctor-view-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Doctor Details</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" id="doctor-view-body"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-close-modal>Close</button>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        let timer = null;
        const searchInput = this.container.querySelector('#doctors-search');
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.search = searchInput.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        this.container.querySelector('#doctors-specialty-filter').addEventListener('change', (e) => {
            this.state.specialtyId = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        

        this.container.querySelector('#doctors-page-size').addEventListener('change', (e) => {
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

        this.container.querySelector('#btn-add-doctor').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#doctor-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDoctor();
        });
    },

    async loadData() {
        const tbody = this.container.querySelector('#doctors-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading doctors...</td></tr>';

        try {
            const res = await api.get('api/doctor_controller.php', {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                specialty_id: this.state.specialtyId,
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Failed to load doctors: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#doctors-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <strong>No doctors found</strong>
                            <p>Try modifying your search or specialty filters.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(d => {
            const fullName = `${d.last_name}, ${d.first_name}${d.middle_initial ? ' ' + d.middle_initial + '.' : ''}`;

            return `
                <tr>
                    <td><strong>${escapeHtml(fullName)}</strong></td>
                    <td><span class="badge badge-role">${escapeHtml(d.specialty_names || 'General Medicine')}</span></td>
                    <td>${escapeHtml(d.contact_no || '—')}</td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-secondary btn-sm btn-view" data-id="${d.doctor_id}" title="View Record">View</button>
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${d.doctor_id}" title="Edit Record">Edit</button>
                            <button class="btn btn-warning btn-sm btn-archive" data-id="${d.doctor_id}" data-name="${escapeHtml(fullName)}" title="Archive">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewDoctor(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        
        
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#doctors-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> doctors</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="doctors-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="doctors-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        pagContainer.querySelector('#doctors-prev')?.addEventListener('click', () => {
            if (this.state.page > 1) {
                this.state.page--;
                this.loadData();
            }
        });
        pagContainer.querySelector('#doctors-next')?.addEventListener('click', () => {
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
        this.container.querySelector('#doctor-form').reset();
        this.container.querySelector('#doctor-id').value = '';
        this.container.querySelector('#doctor-form-title').textContent = 'Add New Doctor';
        
        this.container.querySelector('#doctor-password-label').innerHTML = 'Password <span class="required-star">*</span>';
        this.container.querySelector('#doctor-password-hint').style.display = 'none';

        openModal('doctor-form-modal');
    },

    async openEditModal(doctorId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/doctor_controller.php', { id: doctorId });
            if (!res.success) throw new Error(res.message);

            const d = res.data.doctor;
            this.container.querySelector('#doctor-id').value = d.doctor_id;
            this.container.querySelector('#doctor-first-name').value = d.first_name || '';
            this.container.querySelector('#doctor-last-name').value = d.last_name || '';
            this.container.querySelector('#doctor-middle-initial').value = d.middle_initial || '';
            this.container.querySelector('#doctor-gender').value = d.gender || 'Other';
            this.container.querySelector('#doctor-contact').value = d.contact_no || '';
            this.container.querySelector('#doctor-username').value = d.username || '';
            this.container.querySelector('#doctor-password').value = '';

            const selectedSpecialtyIds = d.specialty_ids ? String(d.specialty_ids).split(',') : [];
            const specialtySelect = this.container.querySelector('#doctor-specialty-id');
            Array.from(specialtySelect.options).forEach(option => {
                option.selected = selectedSpecialtyIds.includes(option.value);
            });

            const fullName = `${d.last_name}, ${d.first_name}${d.middle_initial ? ' ' + d.middle_initial + '.' : ''}`;
            this.container.querySelector('#doctor-form-title').textContent = `Edit Doctor: ${fullName}`;
            this.container.querySelector('#doctor-password-label').innerHTML = 'Password';
            this.container.querySelector('#doctor-password-hint').style.display = 'block';

            openModal('doctor-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveDoctor() {
        this.clearFormErrors();

        const id = this.container.querySelector('#doctor-id').value;
        const firstName = this.container.querySelector('#doctor-first-name').value.trim();
        const lastName = this.container.querySelector('#doctor-last-name').value.trim();
        const middleInitial = this.container.querySelector('#doctor-middle-initial').value.trim();
        const gender = this.container.querySelector('#doctor-gender').value;
        const specialtyIds = Array.from(this.container.querySelector('#doctor-specialty-id').selectedOptions).map(o => parseInt(o.value, 10));
        const contact = this.container.querySelector('#doctor-contact').value.trim();
        const username = this.container.querySelector('#doctor-username').value.trim();
        const password = this.container.querySelector('#doctor-password').value;

        let hasErrors = false;
        if (!firstName) {
            this.showFieldError('doctor-first-name', 'First name is required.');
            hasErrors = true;
        }
        if (!lastName) {
            this.showFieldError('doctor-last-name', 'Last name is required.');
            hasErrors = true;
        }
        if (!gender) {
            this.showFieldError('doctor-gender', 'Gender is required.');
            hasErrors = true;
        }
        if (specialtyIds.length === 0) {
            this.showFieldError('doctor-specialty-id', 'Please select at least one specialty.');
            hasErrors = true;
        }
        if (!username) {
            this.showFieldError('doctor-username', 'Username is required.');
            hasErrors = true;
        }
        if (!id && (!password || password.length < 6)) {
            this.showFieldError('doctor-password', 'Password is required and must be at least 6 characters.');
            hasErrors = true;
        } else if (id && password && password.length < 6) {
            this.showFieldError('doctor-password', 'Password must be at least 6 characters.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            first_name: firstName,
            last_name: lastName,
            middle_initial: middleInitial,
            gender: gender,
            specialty_ids: specialtyIds,
            contact_no: contact,
            username: username,
            password: password
        };

        const saveBtn = this.container.querySelector('#btn-save-doctor');
        saveBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await api.put(`api/doctor_controller.php?id=${id}`, payload);
            } else {
                res = await api.post('api/doctor_controller.php', payload);
            }

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('doctor-form-modal');
                this.loadData();
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [f, msg] of Object.entries(data.errors)) {
                    this.showFieldError(`doctor-${f.replace('_', '-')}`, msg);
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

    async viewDoctor(doctorId) {
        try {
            const res = await api.get('api/doctor_controller.php', { id: doctorId });
            if (!res.success) throw new Error(res.message);

            const d = res.data.doctor;
            const fullName = `${d.last_name}, ${d.first_name}${d.middle_initial ? ' ' + d.middle_initial + '.' : ''}`;
            const body = this.container.querySelector('#doctor-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Name</th><td><strong>${escapeHtml(fullName)}</strong></td></tr>
                    <tr><th>Username</th><td><code>${escapeHtml(d.username || 'N/A')}</code></td></tr>
                    <tr><th>Gender</th><td>${escapeHtml(d.gender || 'N/A')}</td></tr>
                    <tr><th>Specialty</th><td><span class="badge badge-role">${escapeHtml(d.specialty_names || 'General Medicine')}</span></td></tr>
                    <tr><th>Contact No</th><td>${escapeHtml(d.contact_no || 'N/A')}</td></tr>
                    <tr><th>Status</th><td>${d.deleted_at ? '<span class="badge badge-deleted">Deactivated</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(d.created_at || 'N/A')}</td></tr>
                    ${d.deleted_at ? `<tr><th>Deactivated At</th><td style="color: var(--danger);">${escapeHtml(d.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('doctor-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to archive "${name}"? Soft-deleted doctors cannot be assigned to new appointments.`,
            onConfirm: async () => {
                const res = await api.put(`api/doctor_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


