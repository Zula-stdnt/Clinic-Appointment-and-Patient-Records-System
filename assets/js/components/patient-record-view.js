// assets/js/components/patient-record-view.js
// Shared, read-only patient record screen used by the Administrator, Receptionist,
// and Doctor portals: demographics, visit summary, searchable and collapsible
// color-coded encounter timeline, and per-visit printing.
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (view is
// built, replaced, and torn down by the hosting module)

import { escapeHtml } from '../ui.js?v=24';
import { printPrescription } from './print-prescription.js?v=2';
import { printLabRequest } from './print-lab-request.js?v=1';
import { printAppointmentForm } from './print-appointment-form.js?v=2';

const APPOINTMENT_STATUS = {
    scheduled: { label: 'Scheduled', className: 'badge-info' },
    confirmed: { label: 'Confirmed', className: 'badge-primary' },
    completed: { label: 'Completed', className: 'badge-success' },
    cancelled: { label: 'Cancelled', className: 'badge-deleted' },
    no_show:   { label: 'No-show', className: 'badge-warning' }
};

const LAB_STATUS = {
    requested:   { label: 'Requested', className: 'badge-warning' },
    in_progress: { label: 'In Progress', className: 'badge-info' },
    completed:   { label: 'Completed', className: 'badge-success' },
    cancelled:   { label: 'Cancelled', className: 'badge-secondary' }
};

const FILTERS = [
    { key: 'all', label: 'All Visits' },
    { key: 'completed', label: 'Completed' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'cancelled', label: 'Cancelled' }
];

export function renderPatientRecord(container, data, options = {}) {
    const state = { filter: 'all', search: '' };
    const p = data.patient || {};
    const summary = data.summary || {};
    const encounters = data.encounters || [];
    const pid = `PAT-${String(p.patient_id).padStart(4, '0')}`;
    const patientName = `${p.last_name || ''}, ${p.first_name || ''}${p.middle_initial ? ' ' + p.middle_initial + '.' : ''}`;

    renderShell();
    renderTimeline();
    bindControls();

    function renderShell() {
        const archived = p.deleted_at
            ? '<span class="badge badge-warning">Archived</span>'
            : '<span class="badge badge-success">Active</span>';

        const stats = [
            { label: 'Total Visits', value: summary.total_visits ?? encounters.length },
            { label: 'Completed', value: summary.completed ?? 0 },
            { label: 'Upcoming', value: summary.upcoming ?? 0 },
            { label: 'Last Visit', value: formatDate(summary.last_visit) },
            { label: 'Next Visit', value: formatDate(summary.next_visit) }
        ];
        if (!summary.next_visit) stats.pop();

        container.innerHTML = `
            <div class="patient-record-toolbar">
                ${options.onBack ? `
                    <button type="button" class="btn btn-secondary" id="pr-back">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 0.5rem;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back to List
                    </button>` : '<span></span>'}
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <span class="text-muted" style="font-size: 0.85rem;">${options.onEdit ? 'Patient record' : 'Read-only clinical record'}</span>
                    ${options.onEdit ? '<button type="button" class="btn btn-primary btn-sm" id="pr-edit">Edit Patient Info</button>' : ''}
                </div>
            </div>

            <div class="card patient-record-header">
                <div class="patient-record-avatar">${escapeHtml((p.first_name || '?').charAt(0).toUpperCase())}</div>
                <div class="patient-record-identity">
                    <h2>${escapeHtml(patientName)} ${archived}</h2>
                    <div class="patient-record-meta">
                        <span><strong>ID:</strong> ${pid}</span>
                        <span><strong>Age:</strong> ${escapeHtml(p.age ?? '—')}</span>
                        <span><strong>Gender:</strong> ${escapeHtml(p.gender || 'Unknown')}</span>
                        <span><strong>DOB:</strong> ${escapeHtml(formatDate(p.date_of_birth))}</span>
                        <span><strong>Contact:</strong> ${escapeHtml(p.contact_no || '—')}</span>
                        <span><strong>Address:</strong> ${escapeHtml(p.address || '—')}</span>
                    </div>
                </div>
            </div>

            <div class="patient-record-summary">
                ${stats.map(s => `
                    <div class="record-stat">
                        <div class="label">${escapeHtml(s.label)}</div>
                        <div class="value">${escapeHtml(String(s.value))}</div>
                    </div>`).join('')}
            </div>

            <div class="record-controls">
                <div class="search-input-wrapper record-search">
                    <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="pr-search" class="form-control" placeholder="Search diagnosis, medicine, lab test, doctor, or date..." value="${escapeHtml(state.search)}">
                </div>
                <div class="record-filters" id="pr-filters">
                    ${FILTERS.map(f => `
                        <button type="button" class="record-filter ${state.filter === f.key ? 'active' : ''}" data-filter="${f.key}">
                            ${escapeHtml(f.label)}
                        </button>`).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="pr-toggle-all">Collapse All</button>
            </div>

            <div class="record-count" id="pr-count"></div>

            <div class="record-timeline" id="pr-timeline"></div>
        `;

        container.querySelector('#pr-back')?.addEventListener('click', () => options.onBack && options.onBack());
        container.querySelector('#pr-edit')?.addEventListener('click', () => options.onEdit && options.onEdit());
    }

    function bindControls() {
        const searchInput = container.querySelector('#pr-search');
        searchInput?.addEventListener('input', () => {
            state.search = searchInput.value.trim();
            renderTimeline();
        });

        container.querySelector('#pr-filters')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            state.filter = btn.getAttribute('data-filter');
            container.querySelectorAll('#pr-filters .record-filter').forEach(el => {
                el.classList.toggle('active', el.getAttribute('data-filter') === state.filter);
            });
            renderTimeline();
        });

        const toggleAll = container.querySelector('#pr-toggle-all');
        toggleAll?.addEventListener('click', () => {
            const cards = container.querySelectorAll('.encounter-card');
            const anyExpanded = Array.from(cards).some(card => !card.classList.contains('collapsed'));
            cards.forEach(card => {
                card.classList.toggle('collapsed', anyExpanded);
                setExpanded(card, !anyExpanded);
            });
            toggleAll.textContent = anyExpanded ? 'Expand All' : 'Collapse All';
        });

        container.querySelector('#pr-timeline')?.addEventListener('click', (e) => {
            const printRx = e.target.closest('.btn-print-rx');
            if (printRx) return printPrescription(parseInt(printRx.getAttribute('data-id'), 10));

            const printLab = e.target.closest('.btn-print-lab');
            if (printLab) return printLabRequest(parseInt(printLab.getAttribute('data-id'), 10));

            const printForm = e.target.closest('.btn-print-form');
            if (printForm) return printAppointmentForm(parseInt(printForm.getAttribute('data-id'), 10));

            const head = e.target.closest('.encounter-head[data-toggle]');
            if (head) {
                const card = head.closest('.encounter-card');
                const collapsed = card.classList.toggle('collapsed');
                setExpanded(card, !collapsed);
            }
        });

        container.querySelector('#pr-timeline')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const head = e.target.closest('.encounter-head[data-toggle]');
            if (head) {
                e.preventDefault();
                const card = head.closest('.encounter-card');
                const collapsed = card.classList.toggle('collapsed');
                setExpanded(card, !collapsed);
            }
        });
    }

    function visibleEncounters() {
        const query = state.search.toLowerCase();
        return encounters.filter(enc => {
            if (state.filter === 'completed' && enc.status !== 'completed') return false;
            if (state.filter === 'scheduled' && enc.status !== 'scheduled' && enc.status !== 'confirmed') return false;
            if (state.filter === 'cancelled' && enc.status !== 'cancelled' && enc.status !== 'no_show') return false;
            if (query && !encounterText(enc).includes(query)) return false;
            return true;
        });
    }

    function renderTimeline() {
        const timeline = container.querySelector('#pr-timeline');
        const count = container.querySelector('#pr-count');
        if (!timeline) return;

        const visible = visibleEncounters();
        timeline.innerHTML = visible.length
            ? visible.map(renderEncounter).join('')
            : '<div class="card record-empty">No visits match your search or filter.</div>';

        if (count) {
            const suffix = state.search ? ` matching “${state.search}”` : '';
            count.textContent = `Showing ${visible.length} of ${encounters.length} visits${suffix}`;
        }

        const toggleAll = container.querySelector('#pr-toggle-all');
        if (toggleAll) toggleAll.textContent = 'Collapse All';
    }

    function renderEncounter(enc) {
        const status = APPOINTMENT_STATUS[enc.status] || { label: enc.status, className: 'badge-secondary' };
        const isCompleted = enc.status === 'completed';
        const hasConsultation = !!enc.consultation_id;
        const doctor = fullDoctorName(enc);
        const canSeeNotes = options.viewerRole !== 'Receptionist';
        const diagnoses = enc.diagnoses || [];
        const prescriptions = enc.prescriptions || [];
        const labs = enc.lab_requests || [];

        const counters = [];
        if (diagnoses.length) counters.push(`${diagnoses.length} diagnosis${diagnoses.length > 1 ? 'es' : ''}`);
        if (prescriptions.length) counters.push(`${prescriptions.length} prescription${prescriptions.length > 1 ? 's' : ''}`);
        if (labs.length) counters.push(`${labs.length} lab request${labs.length > 1 ? 's' : ''}`);

        let body = '';
        if (isCompleted && hasConsultation) {
            const vitals = [
                enc.blood_pressure ? `<span class="record-vital"><strong>BP:</strong> ${escapeHtml(enc.blood_pressure)}</span>` : '',
                enc.temperature ? `<span class="record-vital"><strong>Temp:</strong> ${escapeHtml(enc.temperature)} &deg;C</span>` : '',
                enc.oxygen_saturation ? `<span class="record-vital"><strong>SpO2:</strong> ${escapeHtml(enc.oxygen_saturation)}%</span>` : ''
            ].filter(Boolean).join('');

            const diagnosesHtml = diagnoses.length
                ? `<div class="encounter-block">
                        <h5>Diagnoses</h5>
                        <ul class="record-list">
                            ${diagnoses.map(d => `<li>${escapeHtml(d.diagnosis_name)}${d.icd10_code ? ` <span class="badge badge-secondary">${escapeHtml(d.icd10_code)}</span>` : ''}</li>`).join('')}
                        </ul>
                   </div>`
                : '<div class="encounter-block"><h5>Diagnoses</h5><span class="text-muted">None recorded.</span></div>';

            const labsHtml = labs.length
                ? `<div class="encounter-block">
                        <h5>Laboratory &amp; Diagnostic Requests</h5>
                        <table class="record-table">
                            <thead><tr><th>Test / Procedure</th><th style="width: 30%;">Status</th><th style="width: 24%;">Date</th></tr></thead>
                            <tbody>
                                ${labs.map(l => {
                                    const ls = LAB_STATUS[l.status] || { label: l.status, className: 'badge-secondary' };
                                    return `<tr>
                                        <td>${escapeHtml(l.test_name)}</td>
                                        <td><span class="badge ${ls.className}">${escapeHtml(ls.label)}</span></td>
                                        <td>${escapeHtml(formatDate(l.request_date))}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                   </div>`
                : '<div class="encounter-block"><h5>Laboratory &amp; Diagnostic Requests</h5><span class="text-muted">None requested.</span></div>';

            const rxHtml = prescriptions.length
                ? `<div class="encounter-block">
                        <h5>Prescriptions</h5>
                        <table class="record-table">
                            <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Time to Take</th></tr></thead>
                            <tbody>
                                ${prescriptions.map(rx => `<tr>
                                    <td><strong>${escapeHtml(rx.medication_name)}</strong>${rx.generic_name ? `<div class="text-muted" style="font-size: 0.78rem;">${escapeHtml(rx.generic_name)}</div>` : ''}</td>
                                    <td>${escapeHtml(rx.dosage)}</td>
                                    <td>${escapeHtml(rx.frequency)}</td>
                                    <td>${escapeHtml(rx.time_to_take || '—')}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                   </div>`
                : '<div class="encounter-block"><h5>Prescriptions</h5><span class="text-muted">None prescribed.</span></div>';

            const notes = canSeeNotes && enc.notes
                ? `<div class="encounter-block">
                        <h5>Clinical Notes</h5>
                        <div class="record-notes">${escapeHtml(enc.notes)}</div>
                   </div>`
                : '';

            body = `
                ${vitals ? `<div class="record-vitals">${vitals}</div>` : ''}
                ${notes}
                <div class="encounter-grid">
                    <div>${diagnosesHtml}${labsHtml}</div>
                    <div>${rxHtml}</div>
                </div>`;
        } else {
            const message = enc.status === 'cancelled'
                ? 'This visit was cancelled.'
                : enc.status === 'no_show'
                    ? 'The patient did not show up for this visit.'
                    : 'Visit is scheduled. Clinical details will appear once the encounter is completed.';
            body = `<div class="text-muted">${escapeHtml(message)}</div>`;
        }

        const printActions = [
            hasConsultation
                ? `<button type="button" class="btn btn-secondary btn-sm btn-print-rx" data-id="${enc.appointment_id}" ${prescriptions.length ? '' : 'disabled title="No prescription on this visit."'}>Print Prescription</button>`
                : '',
            hasConsultation
                ? `<button type="button" class="btn btn-secondary btn-sm btn-print-lab" data-id="${enc.appointment_id}" ${labs.length ? '' : 'disabled title="No laboratory request on this visit."'}>Print Lab Request</button>`
                : '',
            `<button type="button" class="btn btn-secondary btn-sm btn-print-form" data-id="${enc.appointment_id}">Print Form</button>`
        ].filter(Boolean).join('');

        return `
            <article class="card encounter-card status-${escapeHtml(enc.status)}">
                <div class="encounter-head" data-toggle role="button" tabindex="0" aria-expanded="true">
                    <div class="encounter-head-main">
                        <span class="encounter-chevron">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </span>
                        <div>
                            <h4 class="encounter-title">${escapeHtml(formatDate(enc.appointment_date))}${enc.appointment_time ? ` &middot; ${escapeHtml(formatTime(enc.appointment_time))}` : ''}</h4>
                            <div class="encounter-sub">${doctor ? `Dr. ${escapeHtml(doctor)}` : 'Unassigned doctor'}${enc.chief_complaint ? ` &middot; ${escapeHtml(enc.chief_complaint)}` : ''}${counters.length ? ` &middot; ${escapeHtml(counters.join(' · '))}` : ''}</div>
                        </div>
                    </div>
                    <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
                </div>
                <div class="encounter-body">
                    ${body}
                    <div class="encounter-actions">${printActions}</div>
                </div>
            </article>
        `;
    }

    function setExpanded(card, expanded) {
        const head = card.querySelector('.encounter-head');
        if (head) head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function encounterText(enc) {
        const parts = [
            enc.appointment_date, formatDate(enc.appointment_date), enc.appointment_time,
            enc.status, enc.chief_complaint, enc.notes,
            enc.doctor_first, enc.doctor_last
        ];
        (enc.diagnoses || []).forEach(d => parts.push(d.diagnosis_name, d.icd10_code));
        (enc.prescriptions || []).forEach(r => parts.push(r.medication_name, r.generic_name, r.dosage, r.frequency, r.time_to_take));
        (enc.lab_requests || []).forEach(l => parts.push(l.test_name, l.status, l.request_date, formatDate(l.request_date)));
        return parts.filter(Boolean).join(' ').toLowerCase();
    }
}

function fullDoctorName(enc) {
    const parts = [enc.doctor_first, enc.doctor_last].filter(Boolean);
    if (!parts.length) return '';
    const mi = enc.doctor_middle ? ` ${enc.doctor_middle}.` : '';
    return `${enc.doctor_last}, ${enc.doctor_first}${mi}`;
}

function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value) {
    if (!value) return '';
    const parts = String(value).split(':');
    if (parts.length < 2) return String(value);
    const date = new Date();
    date.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
