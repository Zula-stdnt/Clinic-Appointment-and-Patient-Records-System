// assets/js/modules/patients.js
// Manage Patients module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record (Reusable View/Edit modals populated by ID) & mysql_update_records (Reflexive UI refresh on save)

import api from '../api.js?v=7';
import { escapeHtml, showToast, openModal, closeModal, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=24';
import { renderPatientRecord } from '../components/patient-record-view.js?v=2';

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
                        <p class="text-muted" style="font-size: 0.85rem;">Manage patient records and personal medical profile directory</p>
                    </div>
                    <button id="btn-add-patient" class="btn btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add New Patient
                    </button>
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
                                <th>Contact No</th>
                                <th>Status</th>
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

            <!-- Add/Edit Patient Modal -->
            <div class="modal" id="patient-form-modal" tabindex="-1" aria-labelledby="patient-form-title" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <form id="patient-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="patient-form-title">Add New Patient</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                        <div class="modal-body">
                            <input type="hidden" id="patient-id">
                            <div style="display: grid; grid-template-columns: 1fr 120px 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="patient-first-name">First Name <span class="required-star">*</span></label>
                                    <input type="text" id="patient-first-name" class="form-control" required placeholder="First name">
                                    <div class="invalid-feedback" id="patient-first-name-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="patient-middle-initial">M.I. <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="patient-middle-initial" class="form-control" maxlength="10" placeholder="e.g. A">
                                    <div class="invalid-feedback" id="patient-middle-initial-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="patient-last-name">Last Name <span class="required-star">*</span></label>
                                    <input type="text" id="patient-last-name" class="form-control" required placeholder="Last name">
                                    <div class="invalid-feedback" id="patient-last-name-error"></div>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label for="patient-gender">Gender <span class="required-star">*</span></label>
                                    <select id="patient-gender" class="form-control" required>
                                        <option value="" disabled selected>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Unknown">Unknown</option>
                                    </select>
                                    <div class="invalid-feedback" id="patient-gender-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="patient-dob">Date of Birth <span class="required-star">*</span></label>
                                    <input type="date" id="patient-dob" class="form-control" required>
                                    <div class="invalid-feedback" id="patient-dob-error"></div>
                                </div>
                            </div>

                            <div class="form-group" id="patient-custom-gender-group" style="display: none;">
                                <label for="patient-custom-gender">Specify Gender <span class="required-star">*</span></label>
                                <input type="text" id="patient-custom-gender" class="form-control" placeholder="Please specify your gender">
                                <div class="invalid-feedback" id="patient-custom-gender-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="patient-contact">Contact Number</label>
                                <input type="text" id="patient-contact" class="form-control" placeholder="e.g. 09171234567">
                                <div class="invalid-feedback" id="patient-contact-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="patient-address">Address</label>
                                <textarea id="patient-address" class="form-control" rows="3" placeholder="Residential / Street Address"></textarea>
                                <div class="invalid-feedback" id="patient-address-error"></div>
                            </div>
                        </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-patient" class="btn btn-primary">Save Patient</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- View Patient Modal -->
            <div class="modal" id="patient-view-modal" tabindex="-1" aria-labelledby="patient-view-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="patient-view-title">Patient Profile</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="patient-view-body"></div>
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
        const searchInput = this.container.querySelector('#patients-search');
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.search = searchInput.value.trim();
                this.state.page = 1;
                this.loadData();
            }, 300);
        });

        // Custom gender toggle
        const genderSelect = this.container.querySelector('#patient-gender');
        const customGenderGroup = this.container.querySelector('#patient-custom-gender-group');
        if (genderSelect && customGenderGroup) {
            genderSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Other') {
                    customGenderGroup.style.display = 'block';
                } else {
                    customGenderGroup.style.display = 'none';
                    this.container.querySelector('#patient-custom-gender').value = '';
                }
            });
        }

        // Contact Number format (09XX XXX XXXX)
        const contactInput = this.container.querySelector('#patient-contact');
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
                
                if (document.activeElement === input) {
                    input.setSelectionRange(newCursor, newCursor);
                }
            });
        }

        this.container.querySelector('#patients-gender-filter').addEventListener('change', (e) => {
            this.state.gender = e.target.value;
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
                this.loadData();
            });
        });

        this.container.querySelector('#btn-add-patient').addEventListener('click', () => {
            this.openAddModal();
        });

        const form = this.container.querySelector('#patient-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePatient();
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

            return `
                <tr>
                    <td><strong>${escapeHtml(fullName)}</strong></td>
                    <td>${escapeHtml(genderFormatted)}</td>
                    <td>${escapeHtml(p.date_of_birth)}</td>
                    <td>${escapeHtml(p.contact_no || '-')}</td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-primary btn-sm btn-record" data-id="${p.patient_id}" title="View Patient Record">Record</button>
                            <button class="btn btn-secondary btn-sm btn-view" data-id="${p.patient_id}" title="View Profile">View</button>
                            <button class="btn btn-secondary btn-sm btn-edit" data-id="${p.patient_id}" title="Edit Record">Edit</button>
                            <button class="btn btn-warning btn-sm btn-archive" data-id="${p.patient_id}" data-name="${escapeHtml(fullName)}" title="Archive">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                                Archive
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewPatient(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-record').forEach(btn => {
            btn.addEventListener('click', () => this.viewPatientRecord(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => this.handleSoftDelete(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
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

    clearFormErrors() {
        this.container.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
        this.container.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    },

    openAddModal() {
        this.clearFormErrors();
        this.container.querySelector('#patient-form').reset();
        this.container.querySelector('#patient-id').value = '';
        this.container.querySelector('#patient-middle-initial').value = '';
        this.container.querySelector('#patient-gender').value = '';
        this.container.querySelector('#patient-custom-gender-group').style.display = 'none';
        this.container.querySelector('#patient-custom-gender').value = '';
        this.container.querySelector('#patient-form-title').textContent = 'Add New Patient';
        openModal('patient-form-modal');
    },

    async openEditModal(patientId) {
        this.clearFormErrors();
        try {
            const res = await api.get('api/patient_controller.php', { id: patientId });
            if (!res.success) throw new Error(res.message);

            const p = res.data.patient;
            this.container.querySelector('#patient-id').value = p.patient_id;
            this.container.querySelector('#patient-first-name').value = p.first_name;
            this.container.querySelector('#patient-middle-initial').value = p.middle_initial || '';
            this.container.querySelector('#patient-last-name').value = p.last_name;
            
            const genderVal = p.gender || '';
            const normalizedGender = genderVal.charAt(0).toUpperCase() + genderVal.slice(1).toLowerCase();
            if (['Male', 'Female', 'Unknown'].includes(normalizedGender)) {
                this.container.querySelector('#patient-gender').value = normalizedGender;
                this.container.querySelector('#patient-custom-gender-group').style.display = 'none';
                this.container.querySelector('#patient-custom-gender').value = '';
            } else {
                this.container.querySelector('#patient-gender').value = 'Other';
                this.container.querySelector('#patient-custom-gender-group').style.display = 'block';
                this.container.querySelector('#patient-custom-gender').value = genderVal;
            }

            this.container.querySelector('#patient-dob').value = p.date_of_birth;
            
            let val = (p.contact_no || '').replace(/\D/g, '');
            if (val.length > 11) val = val.slice(0, 11);
            let formatted = '';
            for (let i = 0; i < val.length; i++) {
                if (i === 4 || i === 7) formatted += ' ';
                formatted += val[i];
            }
            this.container.querySelector('#patient-contact').value = formatted;

            this.container.querySelector('#patient-address').value = p.address || '';

            const fullName = `${p.last_name}, ${p.first_name}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;
            this.container.querySelector('#patient-form-title').textContent = `Edit Patient: ${fullName}`;
            openModal('patient-form-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
    },

    async savePatient() {
        this.clearFormErrors();

        const id = this.container.querySelector('#patient-id').value;
        const firstName = this.container.querySelector('#patient-first-name').value.trim();
        const middleInitial = this.container.querySelector('#patient-middle-initial').value.trim();
        const lastName = this.container.querySelector('#patient-last-name').value.trim();
        let gender = this.container.querySelector('#patient-gender').value;
        const customGender = this.container.querySelector('#patient-custom-gender').value.trim();
        const dob = this.container.querySelector('#patient-dob').value;
        const contact = this.container.querySelector('#patient-contact').value.trim();
        const address = this.container.querySelector('#patient-address').value.trim();

        let hasErrors = false;
        if (!firstName) {
            this.showFieldError('patient-first-name', 'First name is required.');
            hasErrors = true;
        }
        if (!lastName) {
            this.showFieldError('patient-last-name', 'Last name is required.');
            hasErrors = true;
        }
        if (!gender) {
            this.showFieldError('patient-gender', 'Gender is required.');
            hasErrors = true;
        } else if (gender === 'Other') {
            if (!customGender) {
                this.showFieldError('patient-custom-gender', 'Please specify the custom gender.');
                hasErrors = true;
            } else {
                gender = customGender;
            }
        }
        if (!dob) {
            this.showFieldError('patient-dob', 'Date of birth is required.');
            hasErrors = true;
        }
        
        const rawContact = contact.replace(/\s+/g, '');
        if (rawContact && (rawContact.length !== 11 || !rawContact.startsWith('09'))) {
            this.showFieldError('patient-contact', 'Contact number must be exactly 11 digits and start with 09.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            first_name: firstName,
            middle_initial: middleInitial,
            last_name: lastName,
            gender: gender,
            date_of_birth: dob,
            contact_no: rawContact,
            address: address
        };

        const saveBtn = this.container.querySelector('#btn-save-patient');
        saveBtn.disabled = true;

        try {
            let res;
            if (id) {
                res = await api.put(`api/patient_controller.php?id=${id}`, payload);
            } else {
                res = await api.post('api/patient_controller.php', payload);
            }

            if (res.success) {
                showToast(res.message, 'success');
                closeModal('patient-form-modal');
                if (this.state.recordPatientId) {
                    this.viewPatientRecord(this.state.recordPatientId);
                } else {
                    this.loadData();
                }
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                for (const [f, msg] of Object.entries(data.errors)) {
                    this.showFieldError(`patient-${f.replace('_', '-')}`, msg);
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

    async viewPatient(patientId) {
        try {
            const res = await api.get('api/patient_controller.php', { id: patientId });
            if (!res.success) throw new Error(res.message);

            const p = res.data.patient;
            const fullName = `${p.last_name}, ${p.first_name}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;
            const body = this.container.querySelector('#patient-view-body');
            body.innerHTML = `
                <table class="data-table">
                    <tr><th style="width: 35%;">Full Name</th><td><strong>${escapeHtml(fullName)}</strong></td></tr>
                    <tr><th>Gender</th><td>${escapeHtml(p.gender)}</td></tr>
                    <tr><th>Date of Birth</th><td>${escapeHtml(p.date_of_birth)}</td></tr>
                    <tr><th>Contact No</th><td>${escapeHtml(p.contact_no || 'N/A')}</td></tr>
                    <tr><th>Address</th><td>${escapeHtml(p.address || 'N/A')}</td></tr>
                    <tr><th>Status</th><td>${p.deleted_at ? '<span class="badge badge-deleted">archived</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>
                    <tr><th>Registered Date</th><td>${escapeHtml(p.created_at || 'N/A')}</td></tr>
                    ${p.deleted_at ? `<tr><th>archived At</th><td style="color: var(--danger);">${escapeHtml(p.deleted_at)}</td></tr>` : ''}
                </table>
            `;
            openModal('patient-view-modal');
        } catch (err) {
            showToast(err.response?.data?.message || err.message, 'danger');
        }
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
                onEdit: () => this.openEditModal(patientId),
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
            message: `Are you sure you want to deactivate patient record for "${name}"?`,
            onConfirm: async () => {
                const res = await api.put(`api/patient_controller.php?action=soft_delete&id=${id}`);
                showToast(res.message, 'warning');
                this.loadData();
            }
        });
    },

    

    
};


