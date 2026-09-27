// assets/js/modules/users.js
// Manage Users module (Strictly restricted to Receptionist)

import api from '../api.js?v=7';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=7';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        role: '',
        sortBy: 'user_id',
        sortOrder: 'ASC',
        total: 0,
        roles: [],
        specialties: []
    },

    async init(container) {
        this.container = container;
        await this.loadRoles();
        await this.loadSpecialties();
        this.renderStructure();
        this.attachEventListeners();
        await this.loadData();
    },

    async loadRoles() {
        try {
            const res = await api.get('api/user_controller.php', { meta: 'roles' });
            if (res.success && res.data.roles) {
                this.state.roles = res.data.roles;
            }
        } catch (err) {
            console.error('Failed to load roles', err);
        }
    },

    async loadSpecialties() {
        try {
            const res = await api.get('api/user_controller.php', { meta: 'specialties' });
            if (res.success && res.data.specialties) {
                this.state.specialties = res.data.specialties;
            }
        } catch (err) {
            console.error('Failed to load specialties', err);
        }
    },

    renderStructure() {
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Manage Users</h2>
                        <p class="text-muted" style="font-size: 0.85rem;">Manage hospital user accounts (Doctors and Receptionists).</p>
                    </div>
                    <button id="btn-add-user" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New User
                    </button>
                </div>

                <div class="toolbar">
                    <div class="toolbar-filters">
                        <div class="search-input-wrapper">
                            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" id="users-search" class="form-control" placeholder="Search by name or username...">
                        </div>

                        <select id="users-role-filter" class="form-control" style="width: auto; min-width: 150px;">
                            <option value="">All Roles</option>
                            <option value="Doctor">Doctor</option>
                            <option value="Receptionist">Receptionist</option>
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                        <select id="users-page-size" class="form-control" style="width: auto;">
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
                                <th data-sort="full_name">Full Name</th>
                                <th data-sort="username">Username</th>
                                <th data-sort="role_name">Role</th>
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                            <tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading users...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="users-pagination"></div>
            </div>

            <!-- Add/Edit User Modal -->
            <div class="modal-backdrop" id="user-form-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title" id="user-form-title">Add New User</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <form id="user-form" novalidate>
                        <div class="modal-body">
                            <input type="hidden" id="user-id">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="user-first-name">First Name <span class="required-star">*</span></label>
                                    <input type="text" id="user-first-name" class="form-control" required placeholder="First name">
                                    <div class="invalid-feedback" id="user-first-name-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="user-last-name">Last Name <span class="required-star">*</span></label>
                                    <input type="text" id="user-last-name" class="form-control" required placeholder="Last name">
                                    <div class="invalid-feedback" id="user-last-name-error"></div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="user-middle-initial">Middle Initial <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="user-middle-initial" class="form-control" maxlength="5" placeholder="M.I.">
                                    <div class="invalid-feedback" id="user-middle-initial-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="user-gender">Gender <span class="required-star">*</span></label>
                                    <select id="user-gender" class="form-control" required>
                                        <option value="" disabled selected>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div class="invalid-feedback" id="user-gender-error"></div>
                                </div>
                            </div>

                            <div class="form-group" id="user-custom-gender-group" style="display: none;">
                                <label for="user-custom-gender">Specify Gender <span class="required-star">*</span></label>
                                <input type="text" id="user-custom-gender" class="form-control" placeholder="Please specify your gender">
                                <div class="invalid-feedback" id="user-custom-gender-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="user-role-id">Role <span class="required-star">*</span></label>
                                <select id="user-role-id" class="form-control" required>
                                    <option value="" disabled selected>Select Role</option>
                                    ${this.state.roles.map(r => `<option value="${r.role_id}" data-name="${escapeHtml(r.role_name)}">${escapeHtml(r.role_name)}</option>`).join('')}
                                </select>
                                <div class="invalid-feedback" id="user-role-id-error"></div>
                            </div>

                            <div class="form-group" id="user-specialty-group" style="display: none;">
                                <label for="user-specialty-id">Clinical Specialties <span class="required-star">*</span></label>
                                <select id="user-specialty-id" class="form-control" multiple size="6">
                                    ${this.state.specialties.map(s => `<option value="${s.specialty_id}">${escapeHtml(s.specialty_name)}</option>`).join('')}
                                </select>
                                <small class="text-muted" style="display: block; margin-top: 0.25rem;">Hold Ctrl (Windows) or Cmd (Mac) to select more than one specialty.</small>
                                <div class="invalid-feedback" id="user-specialty-id-error"></div>
                            </div>

                            <div class="form-group" id="user-contact-group" style="display: none;">
                                <label for="user-contact-no">Contact Number</label>
                                <input type="text" id="user-contact-no" class="form-control" placeholder="09XX XXX XXXX">
                                <div class="invalid-feedback" id="user-contact-no-error"></div>
                            </div>

                            <hr style="margin: 1.5rem 0; border: 0; border-top: 1px solid var(--border);">
                            <h4 style="margin-bottom: 1rem; font-size: 1rem;">Login Credentials</h4>

                            <div class="form-group">
                                <label for="user-username">Username <span class="required-star">*</span></label>
                                <input type="text" id="user-username" class="form-control" required placeholder="e.g. jdoe">
                                <div class="invalid-feedback" id="user-username-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="user-password" id="user-password-label">Password <span class="required-star">*</span></label>
                                <div style="position: relative;">
                                    <input type="password" id="user-password" class="form-control" placeholder="Enter password" style="padding-right: 40px;">
                                    <button type="button" class="btn-toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0; color: var(--text-muted);" aria-label="Toggle password visibility">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                                <div class="invalid-feedback" id="user-password-error"></div>
                                <small class="text-muted" style="display: block; margin-top: 0.25rem;">Must contain an uppercase letter, lowercase letter, number, and special character.</small>
                                <small class="text-muted" id="user-password-hint" style="display: none; margin-top: 0.25rem;">Leave blank to keep password unchanged.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
                            <button type="submit" id="btn-save-user" class="btn btn-primary">Save User</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- View User Modal -->
            <div class="modal-backdrop" id="user-view-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">User Account Details</h3>
                        <button type="button" class="btn-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" id="user-view-body"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-close-modal>Close</button>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Search debounce
        let timer = null;
        const searchInput = this.container.querySelector('#users-search');
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.search = searchInput.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        // Filter handlers
        this.container.querySelector('#users-role-filter').addEventListener('change', (e) => {
            this.state.role = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#users-page-size').addEventListener('change', (e) => {
            this.state.pageSize = parseInt(e.target.value, 10);
            this.state.page = 1;
            this.loadData();
        });

        // Sorting
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

        // Add button
        this.container.querySelector('#btn-add-user').addEventListener('click', () => {
            this.openAddModal();
        });

        const roleSelect = this.container.querySelector('#user-role-id');
        roleSelect.addEventListener('change', () => {
            const selectedOpt = roleSelect.options[roleSelect.selectedIndex];
            const roleName = selectedOpt ? selectedOpt.getAttribute('data-name') : '';
            this.toggleDoctorFields(roleName === 'Doctor');
        });

        // Gender other toggle
        const genderSelect = this.container.querySelector('#user-gender');
        const customGenderGroup = this.container.querySelector('#user-custom-gender-group');
        const customGenderInput = this.container.querySelector('#user-custom-gender');
        genderSelect.addEventListener('change', () => {
            if (genderSelect.value === 'Other') {
                customGenderGroup.style.display = 'block';
                customGenderInput.setAttribute('required', 'required');
            } else {
                customGenderGroup.style.display = 'none';
                customGenderInput.removeAttribute('required');
                customGenderInput.value = '';
            }
        });

        const contactInput = this.container.querySelector('#user-contact-no');
        if (contactInput) {
            contactInput.addEventListener('input', (e) => {
                const input = e.target;
                const oldSelectionStart = input.selectionStart;
                const oldVal = input.value;
                
                let val = oldVal.replace(/\D/g, ''); // strip non-numeric
                if (val.length > 11) val = val.slice(0, 11);
                
                let formatted = '';
                for (let i = 0; i < val.length; i++) {
                    if (i === 4 || i === 7) {
                        formatted += ' ';
                    }
                    formatted += val[i];
                }
                
                input.value = formatted;

                let newCursor = 0;
                let digitsFound = 0;
                const digitsBeforeCursor = oldVal.slice(0, oldSelectionStart).replace(/\D/g, '').length;
                
                for (let i = 0; i < formatted.length; i++) {
                    if (digitsFound === digitsBeforeCursor) break;
                    if (/\d/.test(formatted[i])) digitsFound++;
                    newCursor++;
                }
                
                // Only set selection if the element is focused to avoid unwanted scrolling or focus issues
                if (document.activeElement === input) {
                    input.setSelectionRange(newCursor, newCursor);
                }
            });
        }

        // Password toggle
        const toggleBtn = this.container.querySelector('.btn-toggle-password');
        const pwdInput = this.container.querySelector('#user-password');
        if (toggleBtn && pwdInput) {
            toggleBtn.addEventListener('click', () => {
                if (pwdInput.type === 'password') {
                    pwdInput.type = 'text';
                    toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'; // eye-off
                } else {
                    pwdInput.type = 'password';
                    toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'; // eye
                }
            });
        }

        // Form submit
        const form = this.container.querySelector('#user-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });
    },

    toggleDoctorFields(isDoctor) {
        const specGroup = this.container.querySelector('#user-specialty-group');
        const specSelect = this.container.querySelector('#user-specialty-id');
        const contactGroup = this.container.querySelector('#user-contact-group');
        const contactInput = this.container.querySelector('#user-contact-no');
        
        if (isDoctor) {
            specGroup.style.display = 'block';
            specSelect.setAttribute('required', 'required');
            contactGroup.style.display = 'block';
            // Contact is optional but visible
            contactInput.removeAttribute('disabled');
        } else {
            specGroup.style.display = 'none';
            specSelect.removeAttribute('required');
            // Clear all selected options (multiple select)
            Array.from(specSelect.options).forEach(option => { option.selected = false; });
            
            contactGroup.style.display = 'none';
            contactInput.value = ''; // clear value
            contactInput.setAttribute('disabled', 'disabled');
        }
    },

    async loadData() {
        const tbody = this.container.querySelector('#users-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">Loading users...</td></tr>';

        try {
            const res = await api.get('api/user_controller.php', {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                role: this.state.role,
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#users-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <strong>No users found</strong>
                            <p>Try adjusting your search criteria or filter options.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(user => {
            return `
                <tr>
                    <td>${escapeHtml(user.full_name)}</td>
                    <td><code>${escapeHtml(user.username)}</code></td>
                    <td><span class="badge badge-role">${escapeHtml(user.role_name)}</span></td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-secondary btn-sm btn-view" data-id="${user.user_id}" title="View Details">View</button>
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${user.user_id}" title="Edit User">Edit</button>
                            <button class="btn btn-warning btn-sm btn-archive" data-id="${user.user_id}" data-name="${escapeHtml(user.full_name)}" title="Archive">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach action handlers
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewUser(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
    },

    renderPagination(data) {
        const pagContainer = this.container.querySelector('#users-pagination');
        const { total, page, page_size, pages } = data;

        if (total === 0) {
            pagContainer.innerHTML = '<span>No records</span>';
            return;
        }

        const start = (page - 1) * page_size + 1;
        const end = Math.min(page * page_size, total);

        pagContainer.innerHTML = `
            <div>Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> users</div>
            <div class="pagination-controls">
                <button class="btn btn-secondary btn-sm" id="users-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span style="margin: 0 0.5rem;">Page <strong>${page}</strong> of <strong>${pages || 1}</strong></span>
                <button class="btn btn-secondary btn-sm" id="users-next" ${page >= pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        const prevBtn = pagContainer.querySelector('#users-prev');
        const nextBtn = pagContainer.querySelector('#users-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.state.page > 1) {
                    this.state.page--;
                    this.loadData();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.state.page < pages) {
                    this.state.page++;
                    this.loadData();
                }
            });
        }
    },

    clearFormErrors() {
        this.container.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
        this.container.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    },

    openAddModal() {
        this.clearFormErrors();
        const form = this.container.querySelector('#user-form');
        form.reset();
        this.container.querySelector('#user-id').value = '';
        this.container.querySelector('#user-form-title').textContent = 'Add New User';
        this.container.querySelector('#user-password-label').innerHTML = 'Password <span class="required-star">*</span>';
        this.container.querySelector('#user-password').setAttribute('required', 'required');
        this.container.querySelector('#user-password-hint').style.display = 'none';
        this.toggleDoctorFields(false);
        openModal('user-form-modal');
    },

    async openEditModal(userId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/user_controller.php', { id: userId });
            if (!res.success) throw new Error(res.message);

            const user = res.data.user;
            this.container.querySelector('#user-id').value = user.user_id;
            this.container.querySelector('#user-first-name').value = user.first_name || '';
            this.container.querySelector('#user-last-name').value = user.last_name || '';
            this.container.querySelector('#user-middle-initial').value = user.middle_initial || '';
            
            const genderVal = user.gender || '';
            if (['Male', 'Female'].includes(genderVal)) {
                this.container.querySelector('#user-gender').value = genderVal;
                this.container.querySelector('#user-custom-gender-group').style.display = 'none';
                this.container.querySelector('#user-custom-gender').value = '';
            } else {
                this.container.querySelector('#user-gender').value = 'Other';
                this.container.querySelector('#user-custom-gender-group').style.display = 'block';
                this.container.querySelector('#user-custom-gender').value = genderVal;
            }

            this.container.querySelector('#user-username').value = user.username;
            this.container.querySelector('#user-role-id').value = user.role_id;
            
            const isDoctor = user.role_name === 'Doctor';
            this.toggleDoctorFields(isDoctor);
            if (isDoctor) {
                const selectedSpecialtyIds = user.specialty_ids ? String(user.specialty_ids).split(',') : [];
                const specialtySelect = this.container.querySelector('#user-specialty-id');
                Array.from(specialtySelect.options).forEach(option => {
                    option.selected = selectedSpecialtyIds.includes(option.value);
                });
                // Reformat contact number
                let val = (user.contact_no || '').replace(/\D/g, '');
                if (val.length > 11) val = val.slice(0, 11);
                
                let formatted = '';
                for (let i = 0; i < val.length; i++) {
                    if (i === 4 || i === 7) {
                        formatted += ' ';
                    }
                    formatted += val[i];
                }
                this.container.querySelector('#user-contact-no').value = formatted;
            }

            this.container.querySelector('#user-password').value = '';
            this.container.querySelector('#user-password').removeAttribute('required');

            this.container.querySelector('#user-form-title').textContent = `Edit User: ${user.username}`;
            this.container.querySelector('#user-password-label').innerHTML = 'Password';
            this.container.querySelector('#user-password-hint').style.display = 'block';

            openModal('user-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async saveUser() {
        this.clearFormErrors();

        const id = this.container.querySelector('#user-id').value;
        const firstName = this.container.querySelector('#user-first-name').value.trim();
        const lastName = this.container.querySelector('#user-last-name').value.trim();
        const middleInitial = this.container.querySelector('#user-middle-initial').value.trim();
        let gender = this.container.querySelector('#user-gender').value;
        const customGender = this.container.querySelector('#user-custom-gender').value.trim();
        const username = this.container.querySelector('#user-username').value.trim();
        const roleSelect = this.container.querySelector('#user-role-id');
        const roleId = roleSelect.value;
        const roleName = roleSelect.options[roleSelect.selectedIndex]?.getAttribute('data-name');
        const specialtyIds = Array.from(this.container.querySelector('#user-specialty-id').selectedOptions).map(o => parseInt(o.value, 10));
        const contactNo = this.container.querySelector('#user-contact-no').value.trim();
        const password = this.container.querySelector('#user-password').value;

        // Client-side validation
        let hasErrors = false;
        if (!firstName) {
            this.showFieldError('user-first-name', 'First name is required.');
            hasErrors = true;
        }
        if (!lastName) {
            this.showFieldError('user-last-name', 'Last name is required.');
            hasErrors = true;
        }
        if (!gender) {
            this.showFieldError('user-gender', 'Gender is required.');
            hasErrors = true;
        } else if (gender === 'Other') {
            if (!customGender) {
                this.showFieldError('user-custom-gender', 'Please specify the custom gender.');
                hasErrors = true;
            } else {
                gender = customGender;
            }
        }
        if (!username) {
            this.showFieldError('user-username', 'Username is required.');
            hasErrors = true;
        }
        if (!roleId) {
            this.showFieldError('user-role-id', 'Role is required.');
            hasErrors = true;
        }
        if (roleName === 'Doctor' && specialtyIds.length === 0) {
            this.showFieldError('user-specialty-id', 'Please select at least one specialty.');
            hasErrors = true;
        }

        const rawContact = contactNo.replace(/\s+/g, '');
        if (rawContact && (rawContact.length !== 11 || !rawContact.startsWith('09'))) {
            this.showFieldError('user-contact-no', 'Contact number must be exactly 11 digits and start with 09.');
            hasErrors = true;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{6,}$/;
        if (!id && !password) {
            this.showFieldError('user-password', 'Password is required.');
            hasErrors = true;
        } else if (password && !passwordRegex.test(password)) {
            this.showFieldError('user-password', 'Password must meet all complexity requirements.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            first_name: firstName,
            last_name: lastName,
            middle_initial: middleInitial,
            gender: gender,
            username: username,
            role_id: parseInt(roleId, 10),
            specialty_ids: specialtyIds,
            contact_no: rawContact,
            password: password
        };

        const saveBtn = this.container.querySelector('#btn-save-user');
        saveBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await api.put(`api/user_controller.php?id=${id}`, payload);
            } else {
                res = await api.post('api/user_controller.php', payload);
            }

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('user-form-modal');
                this.loadData();
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [f, msg] of Object.entries(data.errors)) {
                    this.showFieldError(`user-${f.replace('_', '-')}`, msg);
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

    async viewUser(userId) {
        try {
            const res = await api.get('api/user_controller.php', { id: userId });
            if (!res.success) throw new Error(res.message);

            const u = res.data.user;
            const body = this.container.querySelector('#user-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Full Name</th><td><strong>${escapeHtml(u.full_name)}</strong></td></tr>
                    <tr><th>Username</th><td><code>${escapeHtml(u.username)}</code></td></tr>
                    <tr><th>Gender</th><td>${escapeHtml(u.gender || 'N/A')}</td></tr>
                    <tr><th>Role</th><td><span class="badge badge-role">${escapeHtml(u.role_name)}</span></td></tr>
                    <tr><th>Status</th><td>${u.deleted_at ? '<span class="badge badge-deleted">Deactivated</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Created At</th><td>${escapeHtml(u.created_at || 'N/A')}</td></tr>
                    <tr><th>Updated At</th><td>${escapeHtml(u.updated_at || 'N/A')}</td></tr>
                    ${u.deleted_at ? `<tr><th>Deactivated At</th><td style="color: var(--danger);">${escapeHtml(u.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('user-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    handleSoftDelete(id, name) {
        confirmSoftDelete({
            itemName: name,
            message: `Are you sure you want to archive user account "${name}"? They will not be able to log in.`,
            onConfirm: async () => {
                const res = await api.put(`api/user_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message.replace('deactivated', 'archived'), 'warning');
                this.loadData();
            }
        });
    }
};

