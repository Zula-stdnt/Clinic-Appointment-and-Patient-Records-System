// assets/js/modules/doctor_patients.js
// Doctor Dashboard - Patient Records Module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record (Summary table with primary-key drill-down to full record) & 02 DOM and UI/dom_create_and_remove_elements (Container reset before re-render)

import api from '../api.js?v=8';
import { escapeHtml, showToast, openModal, closeModal } from '../ui.js?v=24';
import { renderPatientRecord } from '../components/patient-record-view.js?v=4';

export default {
    state: {
        patients: [],
        total: 0,
        page: 1,
        pageSize: 10,
        search: '',
        assignmentStatus: 'all',
        gender: '',
        sortBy: 'last_name',
        sortOrder: 'ASC',
        viewingHistory: false,
        activeRecord: null,
        targetBreakGlassPatientId: null
    },

    async init(container) {
        this.container = container;
        this.state.viewingHistory = false;
        this.state.activeRecord = null;
        this.state.targetBreakGlassPatientId = null;
        
        this.renderTableSkeleton();
        this.attachEventListeners();
        await this.loadPatients();
    },

    renderTableSkeleton() {
        this.container.innerHTML = `
            <div id="patients-list-view">
                <div class="card" style="margin-bottom: 1rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--surface); flex-wrap: wrap; gap: 0.75rem;">
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--text);">Patient Records</h2>
                    <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                        <input type="text" id="patients-search" class="form-control" placeholder="Search by name, contact, address..." value="${escapeHtml(this.state.search)}" style="width: 260px;">
                        <select id="patients-assignment-filter" class="form-control" style="width: auto;">
                            <option value="all"${this.state.assignmentStatus === 'all' ? ' selected' : ''}>All Patients</option>
                            <option value="assigned"${this.state.assignmentStatus === 'assigned' ? ' selected' : ''}>Assigned Patients</option>
                            <option value="unassigned"${this.state.assignmentStatus === 'unassigned' ? ' selected' : ''}>Unassigned (Break-Glass)</option>
                        </select>
                        <select id="patients-gender-filter" class="form-control" style="width: auto; min-width: 130px;">
                            <option value=""${this.state.gender === '' ? ' selected' : ''}>All Genders</option>
                            <option value="male"${this.state.gender === 'male' ? ' selected' : ''}>Male</option>
                            <option value="female"${this.state.gender === 'female' ? ' selected' : ''}>Female</option>
                            <option value="other"${this.state.gender === 'other' ? ' selected' : ''}>Other</option>
                            <option value="unknown"${this.state.gender === 'unknown' ? ' selected' : ''}>Unknown</option>
                        </select>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">Rows:</span>
                            <select id="patients-page-size" class="form-control" style="width: auto;">
                                <option value="5"${this.state.pageSize === 5 ? ' selected' : ''}>5</option>
                                <option value="10"${this.state.pageSize === 10 ? ' selected' : ''}>10</option>
                                <option value="25"${this.state.pageSize === 25 ? ' selected' : ''}>25</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th data-sort="last_name">Patient Name</th>
                                    <th data-sort="date_of_birth">Date of Birth</th>
                                    <th data-sort="gender">Age / Gender</th>
                                    <th data-sort="contact_no">Contact No</th>
                                    <th style="width: 150px; text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="patients-tbody">
                                <tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading patients...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pagination-controls" id="patients-pagination" style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border);"></div>
                </div>
            </div>
            <div id="patient-record-view" style="display: none;"></div>

            <div class="modal" id="break-glass-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="break-glass-title" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content" style="border-top: 4px solid var(--danger, #ef4444);">
                        <div class="modal-header">
                            <h3 class="modal-title" id="break-glass-title" style="color: var(--danger, #dc2626); display: flex; align-items: center; gap: 0.5rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                Break-Glass Emergency Access
                            </h3>
                            <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.875rem; margin-bottom: 1rem;">
                                <strong>Security Notice:</strong> You do not have an active scheduled appointment with this patient. Opening this chart bypasses standard clinical relationship bounds and will be <strong>permanently logged in the compliance audit trail</strong>.
                            </div>
                            <div class="form-group" style="margin-bottom: 0.75rem;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Quick-Select Justification Tag:</label>
                                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                                    <button type="button" class="btn btn-secondary btn-sm break-glass-tag" data-tag="Emergency Trauma / Unconscious Patient">Emergency Trauma / Unconscious Patient</button>
                                    <button type="button" class="btn btn-secondary btn-sm break-glass-tag" data-tag="On-call Shift Coverage">On-call Shift Coverage</button>
                                    <button type="button" class="btn btn-secondary btn-sm break-glass-tag" data-tag="Urgent Chart Review">Urgent Chart Review</button>
                                    <button type="button" class="btn btn-secondary btn-sm break-glass-tag" data-tag="Inpatient / Referral Consultation">Inpatient / Referral Consultation</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="break-glass-reason" style="font-weight: 600; font-size: 0.85rem;">Clinical Justification Narrative * (Min. 10 chars)</label>
                                <textarea id="break-glass-reason" class="form-control" rows="3" placeholder="Provide detailed clinical justification for emergency chart override..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="btn-confirm-break-glass">Activate Emergency Access</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    updateSortHeaders() {
        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.getAttribute('data-sort') === this.state.sortBy) {
                th.classList.add(this.state.sortOrder === 'ASC' ? 'sort-asc' : 'sort-desc');
            }
        });
    },

    async loadPatients() {
        const tbody = this.container.querySelector('#patients-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading patients...</td></tr>`;
        
        try {
            const url = `api/doctor_patients_controller.php?action=list&page=${this.state.page}&page_size=${this.state.pageSize}&search=${encodeURIComponent(this.state.search)}&assignment_status=${encodeURIComponent(this.state.assignmentStatus)}&gender=${encodeURIComponent(this.state.gender)}&sort_by=${encodeURIComponent(this.state.sortBy)}&sort_order=${encodeURIComponent(this.state.sortOrder)}`;
            const res = await api.get(url);
            
            if (res.success && res.data) {
                this.state.patients = res.data.items || [];
                this.state.total = res.data.total || 0;
                this.renderPatientsTable();
                this.renderPagination();
                this.updateSortHeaders();
            } else {
                showToast(res.message || 'Failed to load patients', 'error');
            }
        } catch (err) {
            console.error('Error loading patients', err);
            showToast('Error loading patients', 'error');
        }
    },

    renderPatientsTable() {
        const tbody = this.container.querySelector('#patients-tbody');
        if (!tbody) return;

        if (this.state.patients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No patients found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.state.patients.map(p => {
            const isArchived = p.deleted_at ? '<span class="badge badge-status-deleted" style="margin-left: 0.5rem; font-size: 0.72rem;">Archived</span>' : '';
            const assignmentBadge = p.is_assigned
                ? '<span class="badge badge-status-active" style="margin-left: 0.4rem; font-size: 0.72rem;">Assigned</span>'
                : '<span class="badge badge-status-secondary" style="margin-left: 0.4rem; font-size: 0.72rem;" title="Unassigned (Emergency Break-Glass required to view medical chart)">Unassigned</span>';

            const btnClass = p.is_assigned ? 'btn-primary' : 'btn-outline-danger';
            const btnText = p.is_assigned ? 'View Record' : 'Break-Glass';
            const btnTitle = p.is_assigned ? 'View Medical Record' : 'Emergency Access (Break-Glass Override)';

            return `
                <tr>
                    <td style="vertical-align: middle;">
                        <div style="font-weight: 500; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
                            <span>${escapeHtml(p.last_name)}, ${escapeHtml(p.first_name)}</span>
                            ${assignmentBadge}
                            ${isArchived}
                        </div>
                    </td>
                    <td style="vertical-align: middle;">${escapeHtml(p.date_of_birth || '--')}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.age)} / ${escapeHtml(p.gender || 'Unknown')}</td>
                    <td style="vertical-align: middle;">${escapeHtml(p.contact_no || '--')}</td>
                    <td style="text-align: center; vertical-align: middle;">
                        <div class="actions-cell" style="justify-content: center;">
                            <button type="button" class="btn ${btnClass} btn-sm btn-view-record" data-id="${p.patient_id}" data-assigned="${p.is_assigned ? '1' : '0'}" title="${btnTitle}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                ${btnText}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    renderPagination() {
        const pag = this.container.querySelector('#patients-pagination');
        if (!pag) return;

        const totalPages = Math.ceil(this.state.total / this.state.pageSize) || 1;
        let html = `<div class="text-muted">Showing ${this.state.patients.length} of ${this.state.total} patients</div>`;
        
        html += `<div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" id="btn-prev-page" ${this.state.page === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: inline-flex; align-items: center; padding: 0 0.5rem;">Page ${this.state.page} of ${totalPages}</span>
            <button class="btn btn-secondary btn-sm" id="btn-next-page" ${this.state.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>`;
        
        pag.innerHTML = html;
    },

    async viewMedicalRecord(patientId, breakGlassReason = null) {
        this.state.viewingHistory = true;
        const listDiv = this.container.querySelector('#patients-list-view');
        const recDiv = this.container.querySelector('#patient-record-view');
        
        if (listDiv) listDiv.style.display = 'none';
        if (recDiv) {
            recDiv.style.display = 'block';
            recDiv.innerHTML = `
                <div class="card" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    Loading medical record...
                </div>
            `;
        }

        try {
            let url = `api/patient_record_controller.php?action=history&patient_id=${patientId}`;
            if (breakGlassReason) {
                url += `&break_glass=true&break_glass_reason=${encodeURIComponent(breakGlassReason)}`;
            }

            const res = await api.get(url);
            if (res.success && res.data) {
                this.state.activeRecord = res.data;
                this.renderMedicalRecord();
            } else {
                showToast(res.message || 'Failed to load record.', 'error');
                this.backToList();
            }
        } catch (err) {
            const errData = err.response?.data;
            if (err.response?.status === 403 && (errData?.errors?.break_glass_required || errData?.data?.break_glass_required || (errData?.message && errData.message.includes('Break-Glass')))) {
                this.backToList();
                this.promptBreakGlass(patientId);
            } else {
                console.error('Error loading patient record', err);
                showToast(errData?.message || 'Error loading patient record.', 'error');
                this.backToList();
            }
        }
    },

    promptBreakGlass(patientId) {
        this.state.targetBreakGlassPatientId = patientId;
        const reasonInput = this.container.querySelector('#break-glass-reason');
        if (reasonInput) reasonInput.value = '';
        openModal('break-glass-modal');
    },

    renderMedicalRecord() {
        const recDiv = this.container.querySelector('#patient-record-view');
        if (!recDiv) return;

        renderPatientRecord(recDiv, this.state.activeRecord, {
            viewerRole: 'Doctor',
            onBack: () => this.backToList()
        });
    },

    backToList() {
        this.state.viewingHistory = false;
        this.state.activeRecord = null;
        const listDiv = this.container.querySelector('#patients-list-view');
        const recDiv = this.container.querySelector('#patient-record-view');
        
        if (recDiv) {
            recDiv.style.display = 'none';
            recDiv.innerHTML = '';
        }
        if (listDiv) listDiv.style.display = 'block';
    },

    attachEventListeners() {
        if (this._listenersAttached) return;
        this._listenersAttached = true;
        const c = this.container;
        
        // Search
        let timer = null;
        c.addEventListener('input', (e) => {
            if (e.target.id === 'patients-search') {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.state.search = e.target.value.trim();
                    this.state.page = 1;
                    this.loadPatients();
                }, 300);
            }
        });

        // Filter & Page size change
        c.addEventListener('change', (e) => {
            if (e.target.id === 'patients-page-size') {
                this.state.pageSize = parseInt(e.target.value, 10) || 10;
                this.state.page = 1;
                this.loadPatients();
            } else if (e.target.id === 'patients-assignment-filter') {
                this.state.assignmentStatus = e.target.value;
                this.state.page = 1;
                this.loadPatients();
            } else if (e.target.id === 'patients-gender-filter') {
                this.state.gender = e.target.value;
                this.state.page = 1;
                this.loadPatients();
            }
        });

        // Click delegation
        c.addEventListener('click', (e) => {
            // Table column sorting
            const th = e.target.closest('th[data-sort]');
            if (th) {
                const sortField = th.getAttribute('data-sort');
                if (this.state.sortBy === sortField) {
                    this.state.sortOrder = this.state.sortOrder === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    this.state.sortBy = sortField;
                    this.state.sortOrder = 'ASC';
                }
                this.state.page = 1;
                this.loadPatients();
                return;
            }

            // Pagination
            if (e.target.id === 'btn-prev-page') {
                if (this.state.page > 1) {
                    this.state.page--;
                    this.loadPatients();
                }
                return;
            }
            if (e.target.id === 'btn-next-page') {
                const totalPages = Math.ceil(this.state.total / this.state.pageSize);
                if (this.state.page < totalPages) {
                    this.state.page++;
                    this.loadPatients();
                }
                return;
            }

            // View Record or Break-Glass Button
            const viewBtn = e.target.closest('.btn-view-record');
            if (viewBtn) {
                const patientId = viewBtn.getAttribute('data-id');
                const isAssigned = viewBtn.getAttribute('data-assigned') === '1';
                if (!isAssigned) {
                    this.promptBreakGlass(patientId);
                } else {
                    this.viewMedicalRecord(patientId);
                }
                return;
            }

            // Back Button
            const backBtn = e.target.closest('#btn-back-to-list, #pr-back');
            if (backBtn) {
                this.backToList();
                return;
            }

            // Break-Glass Quick-Select Tags
            const tagBtn = e.target.closest('.break-glass-tag');
            if (tagBtn) {
                const tag = tagBtn.getAttribute('data-tag');
                const reasonInput = c.querySelector('#break-glass-reason');
                if (reasonInput) {
                    if (reasonInput.value.trim() === '') {
                        reasonInput.value = tag + ': ';
                    } else {
                        reasonInput.value += '; ' + tag;
                    }
                    reasonInput.focus();
                }
                return;
            }

            // Break-Glass Submit
            const confirmBtn = e.target.closest('#btn-confirm-break-glass');
            if (confirmBtn) {
                const reasonInput = c.querySelector('#break-glass-reason');
                const reason = reasonInput ? reasonInput.value.trim() : '';
                if (!reason || reason.length < 10) {
                    showToast('Please enter a clinical justification of at least 10 characters.', 'warning');
                    return;
                }
                const targetPatientId = this.state.targetBreakGlassPatientId;
                closeModal('break-glass-modal');
                if (targetPatientId) {
                    this.viewMedicalRecord(targetPatientId, reason);
                }
                return;
            }
        });
    }
};
