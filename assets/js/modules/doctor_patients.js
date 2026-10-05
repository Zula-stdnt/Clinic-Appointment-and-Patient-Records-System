// assets/js/modules/doctor_patients.js
// Doctor Dashboard - Patient Records Module
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record (Summary table with primary-key drill-down to full record) & 02 DOM and UI/dom_create_and_remove_elements (Container reset before re-render)

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';
import { renderPatientRecord } from '../components/patient-record-view.js?v=3';

export default {
    state: {
        patients: [],
        total: 0,
        page: 1,
        pageSize: 10,
        search: '',
        viewingHistory: false,
        activeRecord: null
    },

    async init(container) {
        this.container = container;
        this.state.viewingHistory = false;
        this.state.activeRecord = null;
        
        this.renderTableSkeleton();
        await this.loadPatients();
        this.attachEventListeners();
    },

    renderTableSkeleton() {
        this.container.innerHTML = `
            <div id="patients-list-view">
                <div class="card" style="margin-bottom: 1rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--text);">Patient Records</h2>
                    <div style="display: flex; gap: 1rem;">
                        <input type="text" id="patients-search" class="form-control" placeholder="Search patients..." value="${escapeHtml(this.state.search)}" style="width: 250px;">
                    </div>
                </div>
                <div class="card" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Patient ID</th>
                                    <th>Name</th>
                                    <th>Age/Gender</th>
                                    <th>Contact No</th>
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
        `;
    },

    async loadPatients() {
        const tbody = this.container.querySelector('#patients-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading patients...</td></tr>`;
        
        try {
            const res = await api.get(`api/doctor_patients_controller.php?action=list&page=${this.state.page}&page_size=${this.state.pageSize}&search=${encodeURIComponent(this.state.search)}`);
            
            if (res.success && res.data) {
                this.state.patients = res.data.items || [];
                this.state.total = res.data.total || 0;
                this.renderPatientsTable();
                this.renderPagination();
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
            const pid = `PAT-${p.patient_id.toString().padStart(4, '0')}`;
            const isArchived = p.deleted_at ? '<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.75rem;">Archived</span>' : '';
            return `
                <tr>
                    <td><strong>${pid}</strong></td>
                    <td>
                        <div style="font-weight: 500;">${escapeHtml(p.last_name)}, ${escapeHtml(p.first_name)}</div>
                        ${isArchived}
                    </td>
                    <td>${escapeHtml(p.age)} / ${escapeHtml(p.gender || 'Unknown')}</td>
                    <td>${escapeHtml(p.contact_no || '--')}</td>
                    <td class="actions-cell" style="text-align: center;">
                        <button type="button" class="btn btn-primary btn-sm btn-view-record" data-id="${p.patient_id}" title="View Medical Record">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            View Record
                        </button>
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

    async viewMedicalRecord(patientId) {
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
            const res = await api.get(`api/patient_record_controller.php?action=history&patient_id=${patientId}`);
            if (res.success && res.data) {
                this.state.activeRecord = res.data;
                this.renderMedicalRecord();
            } else {
                showToast(res.message || 'Failed to load record.', 'error');
                this.backToList();
            }
        } catch (err) {
            console.error('Error loading record', err);
            showToast('Error loading patient record.', 'error');
            this.backToList();
        }
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

        // Pagination
        c.addEventListener('click', (e) => {
            if (e.target.id === 'btn-prev-page') {
                if (this.state.page > 1) {
                    this.state.page--;
                    this.loadPatients();
                }
            } else if (e.target.id === 'btn-next-page') {
                const totalPages = Math.ceil(this.state.total / this.state.pageSize);
                if (this.state.page < totalPages) {
                    this.state.page++;
                    this.loadPatients();
                }
            }
        });

        // View Record Button
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view-record');
            if (btn) {
                const patientId = btn.getAttribute('data-id');
                this.viewMedicalRecord(patientId);
            }
        });

        // Back Button
        c.addEventListener('click', (e) => {
            const btn = e.target.closest('#btn-back-to-list');
            if (btn) {
                this.backToList();
            }
        });
    }
};
