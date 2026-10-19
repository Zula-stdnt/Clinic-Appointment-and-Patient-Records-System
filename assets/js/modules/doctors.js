// assets/js/modules/doctors.js
// Manage Doctors module (with active specialty selection and FK appointment delete handling)
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_objects_and_arrays (Mapping specialty objects to <option> text/value) & 03 APIs and Database Operations/mysql_update_records

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal, confirmAction, confirmSoftDelete, confirmHardDelete } from '../ui.js?v=28';

export default {
    state: {
        page: 1,
        pageSize: 10,
        search: '',
        status: 'active',
        gender: '',
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
                        <p class="text-muted" style="font-size: 0.85rem;">Manage clinic medical staff and clinical specialties</p>
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

                        <select id="doctors-gender-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="">All Genders</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                        </select>

                        <select id="doctors-status-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value="active">Active</option>
                            <option value="deleted">Archived</option>
                            <option value="all">All Statuses</option>
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
                                <th>Weekly Schedule</th>
                                <th data-sort="contact_no">Contact No</th>
                                <th data-sort="deleted_at">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="doctors-table-body">
                            <tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading doctors...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination-wrapper" id="doctors-pagination"></div>
            </div>

            <!-- Add/Edit Doctor Modal -->
            <div class="modal" id="doctor-form-modal" tabindex="-1" aria-labelledby="doctor-form-title" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <form id="doctor-form" novalidate>
                            <div class="modal-header">
                                <h3 class="modal-title" id="doctor-form-title">Add New Doctor</h3>
                                <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                            </div>
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
                                    <label for="doctor-middle-initial">Middle Initial <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(Optional)</span></label>
                                    <input type="text" id="doctor-middle-initial" class="form-control" maxlength="1" placeholder="M.I.">
                                    <div class="invalid-feedback" id="doctor-middle-initial-error"></div>
                                </div>
                                <div class="form-group">
                                    <label for="doctor-gender">Gender <span class="required-star">*</span></label>
                                    <select id="doctor-gender" class="form-control" required>
                                        <option value="" disabled selected>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div class="invalid-feedback" id="doctor-gender-error"></div>
                                </div>
                            </div>

                            <div class="form-group" id="doctor-custom-gender-group" style="display: none;">
                                <label for="doctor-custom-gender">Specify Gender <span class="required-star">*</span></label>
                                <input type="text" id="doctor-custom-gender" class="form-control" placeholder="Please specify your gender">
                                <div class="invalid-feedback" id="doctor-custom-gender-error"></div>
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
                                <input type="text" id="doctor-contact" class="form-control" placeholder="e.g. 0917 123 4567">
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
                                <div style="position: relative;">
                                    <input type="password" id="doctor-password" class="form-control" placeholder="Min. 6 characters" style="padding-right: 40px;">
                                    <button type="button" id="btn-toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d; padding: 0;">
                                        <svg id="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        <svg id="icon-eye-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                                <small class="text-muted" style="display: block; margin-top: 0.25rem;">Must contain an uppercase letter, lowercase letter, number, and special character.</small>
                                <div class="invalid-feedback" id="doctor-password-error"></div>
                                <small class="text-muted" id="doctor-password-hint" style="display: none; margin-top: 0.25rem;">Leave blank to keep password unchanged.</small>
                            </div>
                        </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="submit" id="btn-save-doctor" class="btn btn-primary">Save Doctor</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- View Doctor Modal -->
            <div class="modal" id="doctor-view-modal" tabindex="-1" aria-labelledby="doctor-view-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title" id="doctor-view-title">Doctor Details</h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="doctor-view-body"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Manage Doctor Schedule Modal -->
            <div class="modal" id="doctor-schedule-modal" tabindex="-1" aria-labelledby="doc-sched-modal-title" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div>
                                <h3 class="modal-title" id="doc-sched-modal-title" style="margin-bottom: 0.2rem;">Assign Doctor Duty Schedule</h3>
                                <p class="text-muted" style="margin: 0; font-size: 0.85rem;" id="doc-sched-doctor-name">Doctor Name</p>
                            </div>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="sched-doctor-id">
                            
                            <!-- Quick Schedule Presets -->
                            <div style="margin-bottom: 1.25rem; padding: 0.85rem; background: var(--bg-alt); border-radius: var(--radius-md); border: 1px solid var(--border);">
                                <label style="display: block; font-weight: 600; font-size: 0.82rem; margin-bottom: 0.4rem; color: var(--text);">Clinic Rotation Presets:</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                    <button type="button" class="btn btn-sm btn-secondary btn-sched-preset" data-preset="house">Mon &amp; Tue (Dr. House)</button>
                                    <button type="button" class="btn btn-sm btn-secondary btn-sched-preset" data-preset="grey">Wed &amp; Thu (Dr. Grey)</button>
                                    <button type="button" class="btn btn-sm btn-secondary btn-sched-preset" data-preset="strange">Fri &amp; Sat (Dr. Strange)</button>
                                    <button type="button" class="btn btn-sm btn-secondary btn-sched-preset" data-preset="full">Mon &ndash; Sat (Full Week)</button>
                                    <button type="button" class="btn btn-sm btn-secondary btn-sched-preset" data-preset="clear" style="color: var(--danger);">Clear All</button>
                                </div>
                            </div>

                            <!-- Day of Week Rows Container -->
                            <div id="sched-days-container" style="display: flex; flex-direction: column; gap: 0.6rem;">
                                <!-- Rendered dynamically by openScheduleModal -->
                            </div>

                            <!-- Sunday Policy Note -->
                            <div style="margin-top: 0.85rem; padding: 0.65rem 0.85rem; background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <span><strong>Sunday Policy:</strong> The clinic is closed on Sundays for sanitization and weekly maintenance. Consultations are conducted Monday through Saturday.</span>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="btn-save-doctor-schedule">Save Schedule</button>
                        </div>
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

        // Custom gender toggle
        const genderSelect = this.container.querySelector('#doctor-gender');
        const customGenderGroup = this.container.querySelector('#doctor-custom-gender-group');
        if (genderSelect && customGenderGroup) {
            genderSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Other') {
                    customGenderGroup.style.display = 'block';
                } else {
                    customGenderGroup.style.display = 'none';
                    this.container.querySelector('#doctor-custom-gender').value = '';
                }
            });
        }

        // Contact Number format (09XX XXX XXXX)
        const contactInput = this.container.querySelector('#doctor-contact');
        if (contactInput) {
            contactInput.addEventListener('input', (e) => {
                const input = e.target;
                const oldSelectionStart = input.selectionStart;
                const oldVal = input.value;
                
                let val = oldVal.replace(/\D/g, ''); // strip non-numeric
                if (val.length > 11) val = val.slice(0, 11);
                
                let formatted = '';
                for (let i = 0; i < val.length; i++) {
                    if (i === 4 || i === 7) formatted += ' ';
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

        // Middle Initial real-time validation and feedback
        const miInput = this.container.querySelector('#doctor-middle-initial');
        if (miInput) {
            miInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                const errEl = this.container.querySelector('#doctor-middle-initial-error');
                if (val !== '' && !/^[A-Za-z]$/.test(val)) {
                    miInput.classList.add('is-invalid');
                    if (errEl) errEl.textContent = 'Middle initial must be a single letter (A-Z).';
                } else {
                    miInput.classList.remove('is-invalid');
                    if (errEl) errEl.textContent = '';
                }
            });
        }

        // Password visibility toggle
        const toggleBtn = this.container.querySelector('#btn-toggle-password');
        const passInput = this.container.querySelector('#doctor-password');
        if (toggleBtn && passInput) {
            toggleBtn.addEventListener('click', () => {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    this.container.querySelector('#icon-eye-off').style.display = 'none';
                    this.container.querySelector('#icon-eye-on').style.display = 'block';
                } else {
                    passInput.type = 'password';
                    this.container.querySelector('#icon-eye-on').style.display = 'none';
                    this.container.querySelector('#icon-eye-off').style.display = 'block';
                }
            });
        }

        this.container.querySelector('#doctors-specialty-filter').addEventListener('change', (e) => {
            this.state.specialtyId = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#doctors-gender-filter').addEventListener('change', (e) => {
            this.state.gender = e.target.value;
            this.state.page = 1;
            this.loadData();
        });

        this.container.querySelector('#doctors-status-filter').addEventListener('change', (e) => {
            this.state.status = e.target.value;
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
                this.state.page = 1;
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

        // Schedule modal preset buttons
        this.container.querySelectorAll('.btn-sched-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applySchedulePreset(btn.getAttribute('data-preset'));
            });
        });

        // Save doctor schedule button
        this.container.querySelector('#btn-save-doctor-schedule')?.addEventListener('click', () => {
            this.saveDoctorSchedule();
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
        const tbody = this.container.querySelector('#doctors-table-body');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Loading doctors...</td></tr>';

        try {
            const res = await api.get('api/doctor_controller.php', {
                page: this.state.page,
                page_size: this.state.pageSize,
                search: this.state.search,
                status: this.state.status,
                gender: this.state.gender,
                specialty_id: this.state.specialtyId,
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
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Failed to load doctors: ${escapeHtml(err.message)}</td></tr>`;
        }
    },

    renderTable(items) {
        const tbody = this.container.querySelector('#doctors-table-body');
        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
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

            let specialtyHtml = '<span class="badge badge-status-scheduled">General Medicine</span>';
            if (d.specialty_names) {
                specialtyHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 250px;">
                    ${d.specialty_names.split(',').map(s => `<span class="badge badge-status-scheduled">${escapeHtml(s.trim())}</span>`).join('')}
                </div>`;
            }

            const scheduleBadge = (d.schedule_summary && d.schedule_summary !== 'Not Set')
                ? `<span class="badge badge-info" style="font-size: 0.78rem;">${escapeHtml(d.schedule_summary)}</span>`
                : '<span class="badge badge-secondary" style="font-size: 0.78rem;">Not Configured</span>';

            const statusBadge = d.deleted_at
                ? '<span class="badge badge-status-deleted">Archived</span>'
                : '<span class="badge badge-status-active">Active</span>';

            const scheduleBtn = !d.deleted_at ? `
                <button class="btn btn-outline-success btn-sm btn-icon btn-schedule" data-id="${d.doctor_id}" data-name="${escapeHtml(fullName)}" title="Assign / Edit Weekly Schedule" aria-label="Assign / Edit Weekly Schedule">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </button>
            ` : '';

            const archiveBtn = !d.deleted_at ? `
                <button class="btn btn-outline-warning btn-sm btn-icon btn-archive" data-id="${d.doctor_id}" data-name="${escapeHtml(fullName)}" title="Archive Doctor" aria-label="Archive Doctor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
            ` : '';

            return `
                <tr>
                    <td><strong>${escapeHtml(fullName)}</strong></td>
                    <td>${specialtyHtml}</td>
                    <td>${scheduleBadge}</td>
                    <td>${escapeHtml(d.contact_no || '-')}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn btn-outline-info btn-sm btn-icon btn-view" data-id="${d.doctor_id}" title="View Record" aria-label="View Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            ${scheduleBtn}
                            <button class="btn btn-outline-primary btn-sm btn-icon btn-edit" data-id="${d.doctor_id}" title="Edit Record" aria-label="Edit Record">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            ${archiveBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.viewDoctor(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.btn-schedule').forEach(btn => {
            btn.addEventListener('click', () => this.openScheduleModal(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
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
        this.container.querySelector('#doctor-gender').value = '';
        this.container.querySelector('#doctor-custom-gender-group').style.display = 'none';
        this.container.querySelector('#doctor-custom-gender').value = '';
        this.container.querySelector('#doctor-form-title').textContent = 'Add New Doctor';
        
        this.container.querySelector('#doctor-password-label').innerHTML = 'Password <span class="required-star">*</span>';
        this.container.querySelector('#doctor-password-hint').style.display = 'none';

        // Reset password visibility to hidden
        const passInput = this.container.querySelector('#doctor-password');
        if (passInput) passInput.type = 'password';
        this.container.querySelector('#icon-eye-on').style.display = 'none';
        this.container.querySelector('#icon-eye-off').style.display = 'block';

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
            
            const genderVal = d.gender || '';
            const normalizedGender = genderVal.charAt(0).toUpperCase() + genderVal.slice(1).toLowerCase();
            if (['Male', 'Female'].includes(normalizedGender)) {
                this.container.querySelector('#doctor-gender').value = normalizedGender;
                this.container.querySelector('#doctor-custom-gender-group').style.display = 'none';
                this.container.querySelector('#doctor-custom-gender').value = '';
            } else {
                this.container.querySelector('#doctor-gender').value = 'Other';
                this.container.querySelector('#doctor-custom-gender-group').style.display = 'block';
                this.container.querySelector('#doctor-custom-gender').value = genderVal;
            }

            let val = (d.contact_no || '').replace(/\D/g, '');
            if (val.length > 11) val = val.slice(0, 11);
            let formatted = '';
            for (let i = 0; i < val.length; i++) {
                if (i === 4 || i === 7) formatted += ' ';
                formatted += val[i];
            }
            this.container.querySelector('#doctor-contact').value = formatted;

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

            // Reset password visibility to hidden
            const passInput = this.container.querySelector('#doctor-password');
            if (passInput) passInput.type = 'password';
            this.container.querySelector('#icon-eye-on').style.display = 'none';
            this.container.querySelector('#icon-eye-off').style.display = 'block';

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
        
        let gender = this.container.querySelector('#doctor-gender').value;
        const customGender = this.container.querySelector('#doctor-custom-gender').value.trim();
        
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
        if (middleInitial !== '' && !/^[A-Za-z]$/.test(middleInitial)) {
            this.showFieldError('doctor-middle-initial', 'Middle initial must be a single letter (A-Z).');
            hasErrors = true;
        }
        
        if (!gender) {
            this.showFieldError('doctor-gender', 'Gender is required.');
            hasErrors = true;
        } else if (gender === 'Other') {
            if (!customGender) {
                this.showFieldError('doctor-custom-gender', 'Please specify the custom gender.');
                hasErrors = true;
            } else {
                gender = customGender;
            }
        }
        
        if (specialtyIds.length === 0) {
            this.showFieldError('doctor-specialty-id', 'Please select at least one specialty.');
            hasErrors = true;
        }
        
        const rawContact = contact.replace(/\s+/g, '');
        if (rawContact && (rawContact.length !== 11 || !rawContact.startsWith('09'))) {
            this.showFieldError('doctor-contact', 'Contact number must be exactly 11 digits and start with 09.');
            hasErrors = true;
        }

        if (!username) {
            this.showFieldError('doctor-username', 'Username is required.');
            hasErrors = true;
        }
        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
        if (!id && !password) {
            this.showFieldError('doctor-password', 'Password is required.');
            hasErrors = true;
        } else if (password && !passwordRegex.test(password)) {
            this.showFieldError('doctor-password', 'Password must be at least 6 characters, and include uppercase, lowercase, number, and special character.');
            hasErrors = true;
        }

        if (hasErrors) return;

        const payload = {
            first_name: firstName,
            last_name: lastName,
            middle_initial: middleInitial,
            gender: gender,
            specialty_ids: specialtyIds,
            contact_no: rawContact,
            username: username,
            password: password
        };

        const isEdit = Boolean(id);
        confirmAction({
            title: isEdit ? 'Confirm Doctor Update' : 'Confirm Doctor Registration',
            message: isEdit
                ? `Are you sure you want to save changes to Dr. ${firstName} ${lastName}'s profile?`
                : `Are you sure you want to register Dr. ${firstName} ${lastName}?`,
            btnText: isEdit ? 'Save Changes' : 'Register Doctor',
            btnClass: 'btn btn-primary',
            cancelBtnText: 'Keep Editing',
            onConfirm: async () => {
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
                        closeModal('doctor-form-modal', true);
                        this.loadData();
                    } else {
                        throw new Error(res.message);
                    }
                } catch (err) {
                    const data = err.response?.data;
                    if (data?.errors) {
                        const fieldMap = {
                            contact_no: 'doctor-contact',
                            first_name: 'doctor-first-name',
                            middle_initial: 'doctor-middle-initial',
                            last_name: 'doctor-last-name',
                            gender: 'doctor-gender',
                            custom_gender: 'doctor-custom-gender',
                            specialty_id: 'doctor-specialty-id',
                            specialty_ids: 'doctor-specialty-id',
                            username: 'doctor-username',
                            password: 'doctor-password'
                        };
                        for (const [f, msg] of Object.entries(data.errors)) {
                            const targetId = fieldMap[f] || `doctor-${f.replace(/_/g, '-')}`;
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

    async openScheduleModal(doctorId, doctorName) {
        const idInput = this.container.querySelector('#sched-doctor-id');
        const nameEl = this.container.querySelector('#doc-sched-doctor-name');
        if (idInput) idInput.value = doctorId;
        if (nameEl) nameEl.textContent = `Configuring weekly duty schedule for Dr. ${doctorName}`;

        const container = this.container.querySelector('#sched-days-container');
        if (container) {
            container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Loading doctor schedule...</div>';
        }

        openModal('doctor-schedule-modal');

        try {
            const res = await api.get('api/doctor_schedule_controller.php', { doctor_id: doctorId });
            const schedules = (res && res.success && res.data && res.data.items) ? res.data.items : [];
            this.renderScheduleModalDays(schedules);
        } catch (err) {
            console.error('Failed to load doctor schedule', err);
            this.renderScheduleModalDays([]);
            showToast('Failed to load doctor schedule.', 'warning');
        }
    },

    renderScheduleModalDays(schedules) {
        const container = this.container.querySelector('#sched-days-container');
        if (!container) return;

        const dayNames = {
            1: 'Monday',
            2: 'Tuesday',
            3: 'Wednesday',
            4: 'Thursday',
            5: 'Friday',
            6: 'Saturday'
        };

        const activeMap = {};
        schedules.forEach(s => {
            activeMap[parseInt(s.day_of_week, 10)] = s;
        });

        let html = '';
        for (let dow = 1; dow <= 6; dow++) {
            const existing = activeMap[dow];
            const isActive = !!existing && existing.is_active != 0;
            const startVal = existing ? (existing.start_time || '08:00:00').slice(0, 5) : '08:00';
            const endVal = existing ? (existing.end_time || '17:00:00').slice(0, 5) : '17:00';

            html += `
                <div class="schedule-day-row" data-day="${dow}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.85rem; background: ${isActive ? 'rgba(16, 124, 65, 0.04)' : 'var(--bg)'}; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-sm); gap: 0.75rem; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 0.55rem; margin: 0; min-width: 130px; font-weight: 600; cursor: pointer; color: var(--text);">
                        <input type="checkbox" class="sched-day-check" data-day="${dow}" ${isActive ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                        <span>${dayNames[dow]}</span>
                    </label>

                    <div class="sched-time-inputs" style="display: flex; align-items: center; gap: 0.5rem; opacity: ${isActive ? '1' : '0.45'}; pointer-events: ${isActive ? 'auto' : 'none'};">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">From:</span>
                        <input type="time" class="form-control form-control-sm sched-start-time" value="${startVal}" min="08:00" max="17:00" style="width: 110px; height: 30px; font-size: 0.82rem;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">To:</span>
                        <input type="time" class="form-control form-control-sm sched-end-time" value="${endVal}" min="08:00" max="17:00" style="width: 110px; height: 30px; font-size: 0.82rem;">
                    </div>

                    <span class="badge sched-status-badge ${isActive ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.74rem; min-width: 75px; text-align: center;">
                        ${isActive ? 'Active Duty' : 'Off Duty'}
                    </span>
                </div>
            `;
        }

        container.innerHTML = html;

        container.querySelectorAll('.sched-day-check').forEach(chk => {
            chk.addEventListener('change', () => {
                const row = chk.closest('.schedule-day-row');
                const timeInputs = row.querySelector('.sched-time-inputs');
                const badge = row.querySelector('.sched-status-badge');
                if (chk.checked) {
                    row.style.background = 'rgba(16, 124, 65, 0.04)';
                    row.style.borderColor = 'var(--primary)';
                    timeInputs.style.opacity = '1';
                    timeInputs.style.pointerEvents = 'auto';
                    badge.classList.remove('badge-secondary');
                    badge.classList.add('badge', 'sched-status-badge', 'badge-success');
                    badge.textContent = 'Active Duty';
                } else {
                    row.style.background = 'var(--bg)';
                    row.style.borderColor = 'var(--border)';
                    timeInputs.style.opacity = '0.45';
                    timeInputs.style.pointerEvents = 'none';
                    badge.classList.remove('badge-success');
                    badge.classList.add('badge', 'sched-status-badge', 'badge-secondary');
                    badge.textContent = 'Off Duty';
                }
            });
        });
    },

    applySchedulePreset(presetType) {
        const container = this.container.querySelector('#sched-days-container');
        if (!container) return;

        const targetDays = {
            house: [1, 2],       // Monday & Tuesday
            grey: [3, 4],        // Wednesday & Thursday
            strange: [5, 6],     // Friday & Saturday
            full: [1, 2, 3, 4, 5, 6], // Full week
            clear: []            // Clear all
        }[presetType] || [];

        container.querySelectorAll('.schedule-day-row').forEach(row => {
            const dow = parseInt(row.getAttribute('data-day'), 10);
            const chk = row.querySelector('.sched-day-check');
            const startTime = row.querySelector('.sched-start-time');
            const endTime = row.querySelector('.sched-end-time');

            const shouldBeActive = targetDays.includes(dow);
            chk.checked = shouldBeActive;
            if (shouldBeActive) {
                startTime.value = '08:00';
                endTime.value = '17:00';
            }
            chk.dispatchEvent(new Event('change'));
        });
    },

    async saveDoctorSchedule() {
        const idInput = this.container.querySelector('#sched-doctor-id');
        const doctorId = parseInt(idInput?.value || '0', 10);
        if (!doctorId) {
            showToast('No doctor selected.', 'danger');
            return;
        }

        const container = this.container.querySelector('#sched-days-container');
        const saveBtn = this.container.querySelector('#btn-save-doctor-schedule');
        const schedules = [];

        container.querySelectorAll('.schedule-day-row').forEach(row => {
            const dow = parseInt(row.getAttribute('data-day'), 10);
            const chk = row.querySelector('.sched-day-check');
            if (chk && chk.checked) {
                let start = row.querySelector('.sched-start-time').value || '08:00';
                let end = row.querySelector('.sched-end-time').value || '17:00';
                if (start.length === 5) start += ':00';
                if (end.length === 5) end += ':00';
                schedules.push({
                    day_of_week: dow,
                    start_time: start,
                    end_time: end
                });
            }
        });

        confirmAction({
            title: 'Confirm Schedule Update',
            message: 'Are you sure you want to save this weekly duty schedule for the doctor?',
            btnText: 'Save Schedule',
            btnClass: 'btn btn-primary',
            cancelBtnText: 'Keep Editing',
            onConfirm: async () => {
                try {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';

                    const res = await api.post('api/doctor_schedule_controller.php', {
                        doctor_id: doctorId,
                        schedules: schedules
                    });

                    if (res.success) {
                        showToast(res.message || 'Doctor schedule updated successfully.', 'success');
                        closeModal('doctor-schedule-modal', true);
                        await this.loadData();
                    } else {
                        throw new Error(res.message || 'Failed to update schedule.');
                    }
                } catch (err) {
                    console.error('Failed to save doctor schedule', err);
                    showToast(err.response?.data?.message || err.message || 'Failed to save schedule.', 'danger');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Schedule';
                }
            }
        });
    }
};


