// assets/js/modules/receptionist_patients.js
// Front-desk Patient Register: search the patient directory and register new patients
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_records (paginated, filterable SELECT)
// & mysql_insert_records (registration through the shared patient form component)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=26';
import { confirmDialog } from '../components/confirm-dialog.js?v=1';
import { PatientRegisterForm } from '../components/patient-register.js?v=1';
import { printBlankForm } from '../components/print-appointment-form.js?v=2';
import { renderPatientRecord } from '../components/patient-record-view.js?v=5';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        gender: '',
        status: 'active',
        sortBy: 'patient_id',
        sortOrder: 'ASC',
        total: 0,
        editingPatientOriginal: null
    },

    async init(container) {
        this.container = container;
        this.state.page = 1;
        this.state.search = '';
        this.state.gender = '';
        this.state.status = 'active';
        this.state.sortBy = 'patient_id';
        this.state.sortOrder = 'ASC';
        this.state.editingPatientOriginal = null;

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
                                <th data-sort="last_name">Patient Name</th>
                                <th data-sort="gender">Gender</th>
                                <th data-sort="date_of_birth">Date of Birth</th>
                                <th data-sort="contact_no">Contact No</th>
                                <th data-sort="created_at">Registered</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="register-table-body">
                            <tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading patients...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="register-pagination"></div>
            </div>

            <div id="patient-record-container" style="display: none;"></div>

            <!-- Edit Patient Modal -->
            <div class="modal" id="edit-patient-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <form id="edit-patient-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="edit-patient-title">Edit Patient Demographics</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <input type="hidden" id="edit-patient-id">
                                <div style="display: grid; grid-template-columns: 1fr 120px 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label for="edit-first-name">First Name <span class="required-star">*</span></label>
                                        <input type="text" id="edit-first-name" class="form-control" placeholder="First name" required>
                                        <div class="invalid-feedback" id="edit-first-name-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-middle-initial">M.I. <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                        <input type="text" id="edit-middle-initial" class="form-control" maxlength="10" placeholder="e.g. A">
                                        <div class="invalid-feedback" id="edit-middle-initial-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-last-name">Last Name <span class="required-star">*</span></label>
                                        <input type="text" id="edit-last-name" class="form-control" placeholder="Last name" required>
                                        <div class="invalid-feedback" id="edit-last-name-error"></div>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label for="edit-gender">Gender <span class="required-star">*</span></label>
                                        <select id="edit-gender" class="form-control" required>
                                            <option value="" disabled>Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                            <option value="Unknown">Unknown</option>
                                        </select>
                                        <div class="invalid-feedback" id="edit-gender-error"></div>
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-dob">Date of Birth <span class="required-star">*</span></label>
                                        <input type="date" id="edit-dob" class="form-control" required>
                                        <div class="invalid-feedback" id="edit-dob-error"></div>
                                    </div>
                                </div>

                                <div class="form-group" id="edit-custom-gender-group" style="display: none;">
                                    <label for="edit-custom-gender">Specify Gender <span class="required-star">*</span></label>
                                    <input type="text" id="edit-custom-gender" class="form-control" placeholder="Please specify gender">
                                    <div class="invalid-feedback" id="edit-custom-gender-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="edit-contact">Contact Number</label>
                                    <input type="text" id="edit-contact" class="form-control" placeholder="e.g. 09171234567">
                                    <div class="invalid-feedback" id="edit-contact-error"></div>
                                </div>

                                <div class="form-group">
                                    <label for="edit-allergies">Allergies &amp; Clinical Alerts <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="edit-allergies" class="form-control" placeholder="e.g. Penicillin, Sulfa drugs, Peanuts, or leave blank">
                                    <div class="invalid-feedback" id="edit-allergies-error"></div>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="edit-address">Address</label>
                                    <textarea id="edit-address" class="form-control" rows="2" placeholder="Residential / Street Address"></textarea>
                                    <div class="invalid-feedback" id="edit-address-error"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-edit-patient" class="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
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
                this.state.page = 1;
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
            const editBtn = e.target.closest('.btn-edit-patient');
            if (editBtn) {
                this.openEditModal(editBtn.getAttribute('data-id'));
            }
        });

        // Edit form gender toggle
        const editGender = this.container.querySelector('#edit-gender');
        const editCustomGenderGroup = this.container.querySelector('#edit-custom-gender-group');
        if (editGender && editCustomGenderGroup) {
            editGender.addEventListener('change', (e) => {
                if (e.target.value === 'Other') {
                    editCustomGenderGroup.style.display = 'block';
                } else {
                    editCustomGenderGroup.style.display = 'none';
                    this.container.querySelector('#edit-custom-gender').value = '';
                }
            });
        }

        // Contact formatting for edit
        const editContact = this.container.querySelector('#edit-contact');
        if (editContact) {
            editContact.addEventListener('input', () => {
                let val = editContact.value.replace(/\D/g, '');
                if (val.length > 11) val = val.slice(0, 11);
                let formatted = '';
                for (let i = 0; i < val.length; i++) {
                    if (i === 4 || i === 7) formatted += ' ';
                    formatted += val[i];
                }
                editContact.value = formatted;
            });
        }

        // Edit form submit
        const editForm = this.container.querySelector('#edit-patient-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSavePatientEdit();
            });
        }
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
        const tbody = this.container.querySelector('#register-table-body');
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
                throw new Error(res.message || 'Failed to load patients.');
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to load patients.';
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#register-table-body');

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
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
                    <td style="vertical-align: middle;"><strong>${escapeHtml(fullName)}</strong></td>
                    <td style="vertical-align: middle;">${escapeHtml(gender)}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.date_of_birth || '-')}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.contact_no || '-')}</td>
                    <td style="vertical-align: middle;">${escapeHtml(this.formatDate(p.created_at))}</td>
                    <td style="text-align: right; vertical-align: middle;">
                        <div class="actions-cell" style="justify-content: flex-end; display: flex; gap: 0.35rem;">
                            <button type="button" class="btn btn-outline-info btn-sm btn-icon btn-view-patient" data-id="${p.patient_id}" title="View Patient Record" aria-label="View Patient Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button type="button" class="btn btn-outline-primary btn-sm btn-icon btn-edit-patient" data-id="${p.patient_id}" title="Edit Demographics" aria-label="Edit Demographics">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        </div>
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
                onEdit: () => this.openEditModal(patientId),
                onBack: () => {
                    recContainer.style.display = 'none';
                    recContainer.innerHTML = '';
                    registerCard.style.display = 'block';
                }
            });
        } catch (err) {
            recContainer.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: var(--danger);">${escapeHtml(err.response?.data?.message || err.message || 'Failed to load patient record.')}</div>`;
        }
    },

    async openEditModal(patientId) {
        try {
            const res = await api.get(`api/patient_controller.php?id=${patientId}`);
            if (!res.success || !res.data) {
                showToast(res.message || 'Could not load patient details.', 'error');
                return;
            }
            const p = (res.data && res.data.patient) ? res.data.patient : (res.data || {});
            this.state.editingPatientOriginal = { ...p };

            this.container.querySelector('#edit-patient-id').value = p.patient_id;
            this.container.querySelector('#edit-first-name').value = p.first_name || '';
            this.container.querySelector('#edit-middle-initial').value = p.middle_initial || '';
            this.container.querySelector('#edit-last-name').value = p.last_name || '';

            const genderSelect = this.container.querySelector('#edit-gender');
            const customGroup = this.container.querySelector('#edit-custom-gender-group');
            const customInput = this.container.querySelector('#edit-custom-gender');
            const stdGenders = ['Male', 'Female', 'Other', 'Unknown'];
            if (stdGenders.includes(p.gender)) {
                genderSelect.value = p.gender;
                customGroup.style.display = 'none';
                customInput.value = '';
            } else if (p.gender) {
                genderSelect.value = 'Other';
                customGroup.style.display = 'block';
                customInput.value = p.gender;
            } else {
                genderSelect.value = 'Unknown';
                customGroup.style.display = 'none';
                customInput.value = '';
            }

            this.container.querySelector('#edit-dob').value = p.date_of_birth || '';
            this.container.querySelector('#edit-contact').value = p.contact_no || '';
            this.container.querySelector('#edit-allergies').value = p.allergies_alerts || '';
            this.container.querySelector('#edit-address').value = p.address || '';

            openModal('edit-patient-modal');
        } catch (err) {
            console.error('Error fetching patient for edit', err);
            showToast(err.response?.data?.message || 'Failed to fetch patient details.', 'error');
        }
    },

    handleSavePatientEdit() {
        const c = this.container;
        const patientId = c.querySelector('#edit-patient-id').value;
        const firstName = c.querySelector('#edit-first-name').value.trim();
        const middleInitial = c.querySelector('#edit-middle-initial').value.trim();
        const lastName = c.querySelector('#edit-last-name').value.trim();
        let gender = c.querySelector('#edit-gender').value;
        const customGender = c.querySelector('#edit-custom-gender').value.trim();
        const dob = c.querySelector('#edit-dob').value;
        const contact = c.querySelector('#edit-contact').value.replace(/\s+/g, '');
        const allergies = c.querySelector('#edit-allergies').value.trim() || null;
        const address = c.querySelector('#edit-address').value.trim();

        if (gender === 'Other') {
            if (!customGender) {
                showToast('Please specify the gender.', 'warning');
                return;
            }
            gender = customGender;
        }

        if (!firstName || !lastName || !dob || !gender) {
            showToast('First Name, Last Name, Gender, and Date of Birth are required.', 'warning');
            return;
        }

        const payload = {
            patient_id: patientId,
            first_name: firstName,
            middle_initial: middleInitial,
            last_name: lastName,
            gender: gender,
            date_of_birth: dob,
            contact_no: contact,
            allergies_alerts: allergies,
            address: address
        };

        const orig = this.state.editingPatientOriginal || {};
        const diffs = [];
        if ((orig.first_name || '').trim().toLowerCase() !== firstName.toLowerCase()) {
            diffs.push(`First Name: "${orig.first_name || ''}" → "${firstName}"`);
        }
        if ((orig.last_name || '').trim().toLowerCase() !== lastName.toLowerCase()) {
            diffs.push(`Last Name: "${orig.last_name || ''}" → "${lastName}"`);
        }
        if ((orig.date_of_birth || '') !== dob) {
            diffs.push(`Date of Birth: "${orig.date_of_birth || ''}" → "${dob}"`);
        }
        if ((orig.gender || '').toLowerCase() !== gender.toLowerCase()) {
            diffs.push(`Gender: "${orig.gender || ''}" → "${gender}"`);
        }

        if (diffs.length > 0) {
            confirmDialog({
                title: 'Confirm Critical Identity Changes',
                message: `You are modifying core patient demographic identity details:\n\n• ${diffs.join('\n• ')}\n\nThis identity amendment will be permanently logged in the audit trail. Are you sure you want to proceed?`,
                btnText: 'Confirm & Save Changes',
                btnClass: 'btn btn-primary',
                cancelText: 'Keep Editing',
                onConfirm: async () => {
                    await this.executePatientUpdate(payload);
                }
            });
        } else {
            confirmDialog({
                title: 'Confirm Patient Update',
                message: `Are you sure you want to save the updated demographic details for "${firstName} ${lastName}"?`,
                btnText: 'Save Changes',
                btnClass: 'btn btn-primary',
                cancelText: 'Keep Editing',
                onConfirm: async () => {
                    await this.executePatientUpdate(payload);
                }
            });
        }
    },

    async executePatientUpdate(payload) {
        const btnSave = this.container.querySelector('#btn-save-edit-patient');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = 'Saving...';
        }
        try {
            const res = await api.put(`api/patient_controller.php?id=${payload.patient_id}`, payload);
            if (res.success) {
                showToast('Patient record updated successfully.', 'success');
                closeModal('edit-patient-modal', true);
                await this.loadData();
                const recContainer = this.container.querySelector('#patient-record-container');
                if (recContainer && recContainer.style.display !== 'none') {
                    this.viewPatientRecord(payload.patient_id);
                }
            } else {
                showToast(res.message || 'Failed to update patient record.', 'error');
            }
        } catch (err) {
            console.error('Error updating patient', err);
            showToast(err.response?.data?.message || err.message || 'Failed to update patient.', 'error');
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = 'Save Changes';
            }
        }
    }
};
