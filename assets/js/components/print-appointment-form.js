// assets/js/components/print-appointment-form.js
// Builds and prints the combined "Patient Registration & Appointment Form":
// patient demographics plus the appointment details (and triage vitals) in a
// single self-contained, print-ready A4 document rendered in a hidden iframe.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record
// (single appointment fetched by primary key) & 02 DOM and UI/dom_create_and_remove_elements
// (temporary iframe created, used, then removed)

import api from '../api.js?v=8';
import { escapeHtml, showToast } from '../ui.js?v=28';

export async function printAppointmentForm(appointmentId) {
    try {
        const res = await api.get('api/appointment_controller.php', { id: appointmentId });
        if (!res.success || !res.data || !res.data.item) {
            throw new Error(res.message || 'Failed to load appointment details.');
        }

        openPrintFrame(buildPrintableForm(res.data.item));
        return true;
    } catch (err) {
        const message = err.response?.data?.message || err.message || 'Failed to prepare the printable form.';
        showToast(message, 'error');
        return false;
    }
}

// Prints the blank (hand-fill) version of the same form for walk-in patients.
export function printBlankForm() {
    openPrintFrame(buildBlankForm());
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fullName(last, first, middle) {
    const mi = middle ? ` ${middle}.` : '';
    return `${last || ''}, ${first || ''}${mi}`.trim();
}

function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatLongDate(value) {
    if (!value) return '—';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(value) {
    if (!value) return '—';
    const [hours, minutes] = String(value).split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value) {
    if (!value) return '—';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatNow() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
}

function computeAge(dateOfBirth) {
    if (!dateOfBirth) return '';
    const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return '';
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
    }
    return age >= 0 ? `${age} y/o` : '';
}

function orDash(value) {
    return value === null || value === undefined || value === '' ? '—' : value;
}

function capitalize(value) {
    if (!value) return 'Unknown';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

// ---------------------------------------------------------------------------
// Document builder
// ---------------------------------------------------------------------------

function printStyles() {
    return `
    @page { size: A4 portrait; margin: 13mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.35; }
    .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px double #111; padding-bottom: 10px; }
    .header img { height: 58px; width: auto; }
    .header .org { font-size: 14pt; font-weight: 700; letter-spacing: 0.4px; }
    .header .sub { font-size: 9pt; color: #333; }
    .header .doc-number { margin-left: auto; text-align: right; font-size: 9pt; }
    .header .doc-number strong { display: block; font-size: 11pt; }
    .doc-title { text-align: center; margin: 14px 0 3px; font-size: 12.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta { text-align: center; font-size: 8.5pt; color: #444; margin-bottom: 14px; }
    .instructions { border: 1px solid #111; background: #fafafa; padding: 7px 10px; font-size: 9pt; margin-bottom: 13px; }
    .section { margin-bottom: 13px; page-break-inside: avoid; }
    .section-title { background: #ececec; border: 1px solid #111; border-bottom: 0; padding: 4px 8px; font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    table.fields { width: 100%; border-collapse: collapse; }
    table.fields td { border: 1px solid #111; padding: 5px 8px; vertical-align: top; }
    table.fields td.label { width: 18%; background: #f5f5f5; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    table.fields td.value { height: 30px; }
    table.fields.vitals td.label { width: auto; }
    .vitals-empty { border: 1px solid #111; border-top: 0; padding: 6px 8px; font-size: 9.5pt; color: #444; font-style: italic; }
    .signatures { display: flex; gap: 34px; margin-top: 30px; page-break-inside: avoid; }
    .sig { flex: 1; text-align: center; font-size: 9pt; }
    .sig-line { border-top: 1px solid #111; margin-top: 42px; padding-top: 4px; }
    .footer { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #999; padding-top: 5px; font-size: 7.5pt; color: #555; }
    .checkbox { display: inline-block; width: 11px; height: 11px; border: 1px solid #111; vertical-align: -1px; margin: 0 4px 0 0; }
    .write-line { display: inline-block; min-width: 120px; border-bottom: 1px dotted #555; height: 13px; vertical-align: -2px; }
    .hint { color: #888; font-size: 8pt; }
`;
}

export function buildPrintableForm(appt) {
    const logoUrl = new URL('logo.png?v=3', window.location.href).href;
    const patientNo = `PAT-${String(appt.patient_id).padStart(4, '0')}`;
    const appointmentNo = `APP-${String(appt.appointment_id).padStart(4, '0')}`;
    const doctorName = `Dr. ${fullName(appt.doctor_last, appt.doctor_first, appt.doctor_middle)}`;
    const age = computeAge(appt.date_of_birth);

    const patientName = escapeHtml(fullName(appt.patient_last, appt.patient_first, appt.patient_middle));
    const patientDob = `${escapeHtml(formatDate(appt.date_of_birth))}${age ? ` (${escapeHtml(age)})` : ''}`;
    const doctorSpecialty = escapeHtml(orDash(appt.doctor_specialties));
    const status = escapeHtml(String(orDash(appt.status)).toUpperCase());

    const vitalsRecorded = hasValue(appt.blood_pressure) || hasValue(appt.temperature) || hasValue(appt.oxygen_saturation);

    const vitalsHtml = vitalsRecorded ? `
        <table class="fields vitals">
            <tr>
                <td class="label">Blood Pressure</td>
                <td>${hasValue(appt.blood_pressure) ? escapeHtml(appt.blood_pressure) + ' mmHg' : '—'}</td>
                <td class="label">Temperature</td>
                <td>${hasValue(appt.temperature) ? escapeHtml(Number(appt.temperature).toFixed(1)) + ' &deg;C' : '—'}</td>
                <td class="label">Oxygen Saturation</td>
                <td>${hasValue(appt.oxygen_saturation) ? escapeHtml(Number(appt.oxygen_saturation).toFixed(0)) + ' %' : '—'}</td>
            </tr>
        </table>
    ` : `<div class="vitals-empty">No triage vital signs were recorded for this appointment.</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${patientNo} - Patient Registration &amp; Appointment Form</title>
<style>${printStyles()}</style>
</head>
<body>
    <div class="header">
        <img src="${logoUrl}" alt="CAPRS Logo">
        <div>
            <div class="org">CLINIC APPOINTMENT AND PATIENT RECORDS SYSTEM (CAPRS)</div>
            <div class="sub">Front Desk &middot; Patient Registration &amp; Appointment Services</div>
        </div>
        <div class="doc-number">
            <strong>${appointmentNo}</strong>
            ${patientNo}
        </div>
    </div>

    <div class="doc-title">Patient Registration &amp; Appointment Form</div>
    <div class="doc-meta">Printed on ${escapeHtml(formatNow())}</div>

    <div class="section">
        <div class="section-title">A. Patient Information</div>
        <table class="fields">
            <tr>
                <td class="label">Patient No.</td>
                <td>${patientNo}</td>
                <td class="label">Date Registered</td>
                <td>${escapeHtml(formatDate(appt.patient_created_at))}</td>
            </tr>
            <tr>
                <td class="label">Full Name</td>
                <td colspan="3"><strong>${patientName}</strong></td>
            </tr>
            <tr>
                <td class="label">Gender</td>
                <td>${escapeHtml(capitalize(appt.patient_gender))}</td>
                <td class="label">Date of Birth</td>
                <td>${patientDob}</td>
            </tr>
            <tr>
                <td class="label">Contact No.</td>
                <td colspan="3">${escapeHtml(orDash(appt.contact_no))}</td>
            </tr>
            <tr>
                <td class="label">Address</td>
                <td colspan="3">${escapeHtml(orDash(appt.address))}</td>
            </tr>
            <tr>
                <td class="label">Allergies / Alerts</td>
                <td colspan="3">
                    ${appt.allergies_alerts && appt.allergies_alerts.trim() !== '' ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span style="font-weight: 700; color: #991b1b; display: inline-flex; align-items: center; gap: 5px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                ALLERGY ALERT: ${escapeHtml(appt.allergies_alerts)}
                            </span>
                            <span style="display: inline-block; padding: 2px 6px; font-size: 8pt; font-weight: 700; border-radius: 3px; background: ${appt.allergies_confirmed_by_doctor ? '#dcfce7' : '#fef3c7'}; color: ${appt.allergies_confirmed_by_doctor ? '#15803d' : '#b45309'}; border: 1px solid ${appt.allergies_confirmed_by_doctor ? '#bbf7d0' : '#fde68a'}; text-transform: uppercase;">
                                ${appt.allergies_confirmed_by_doctor ? 'Doctor Confirmed' : 'Unconfirmed Intake Note'}
                            </span>
                        </div>
                    ` : '<span style="color: #4b5563;">No known allergies reported at front-desk intake.</span>'}
                </td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">B. Appointment Details</div>
        <table class="fields">
            <tr>
                <td class="label">Appointment No.</td>
                <td>${appointmentNo}</td>
                <td class="label">Status</td>
                <td>${status}</td>
            </tr>
            <tr>
                <td class="label">Attending Doctor</td>
                <td><strong>${escapeHtml(doctorName)}</strong></td>
                <td class="label">Specialty</td>
                <td>${doctorSpecialty}</td>
            </tr>
            <tr>
                <td class="label">Schedule</td>
                <td>${escapeHtml(formatLongDate(appt.appointment_date))}</td>
                <td class="label">Time</td>
                <td>${escapeHtml(formatTime(appt.appointment_time))}</td>
            </tr>
            <tr>
                <td class="label">Chief Complaint</td>
                <td colspan="3">${escapeHtml(orDash(appt.chief_complaint))}</td>
            </tr>
            <tr>
                <td class="label">Booked On</td>
                <td colspan="3">${escapeHtml(formatDateTime(appt.created_at))}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">C. Triage Vital Signs</div>
        ${vitalsHtml}
    </div>

    <div class="signatures">
        <div class="sig"><div class="sig-line">Patient / Guardian Signature</div></div>
        <div class="sig"><div class="sig-line">Received by (Front Desk)</div></div>
        <div class="sig"><div class="sig-line">Date</div></div>
    </div>

    <div class="footer">
        <span>System-generated form. Please present this slip on your scheduled visit.</span>
        <span>${appointmentNo} &middot; ${patientNo}</span>
    </div>
</body>
</html>`;
}

// Blank version of the same sheet, meant to be printed and filled by hand
// before a walk-in patient is encoded into the system.
export function buildBlankForm() {
    const logoUrl = new URL('logo.png?v=3', window.location.href).href;
    const blank = '&nbsp;';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Patient Registration &amp; Appointment Form (Blank)</title>
<style>${printStyles()}</style>
</head>
<body>
    <div class="header">
        <img src="${logoUrl}" alt="CAPRS Logo">
        <div>
            <div class="org">CLINIC APPOINTMENT AND PATIENT RECORDS SYSTEM (CAPRS)</div>
            <div class="sub">Front Desk &middot; Patient Registration &amp; Appointment Services</div>
        </div>
        <div class="doc-number">
            <strong>Form No. <span class="write-line" style="min-width: 110px;"></span></strong>
            PAT-<span class="write-line" style="min-width: 80px;"></span>
        </div>
    </div>

    <div class="doc-title">Patient Registration &amp; Appointment Form</div>
    <div class="doc-meta">Blank form &middot; Printed on ${escapeHtml(formatNow())}</div>

    <div class="instructions">
        <strong>Instructions:</strong> Please write legibly in block letters and fill out Section A completely.
        Leave Sections B and C for the front desk staff. Submit the accomplished form at the front desk.
    </div>

    <div class="section">
        <div class="section-title">A. Patient Information (To be filled out by the patient)</div>
        <table class="fields">
            <tr>
                <td class="label">Patient No.</td>
                <td class="value"><span class="hint">For front desk use</span></td>
                <td class="label">Date Registered</td>
                <td class="value"><span class="hint">For front desk use</span></td>
            </tr>
            <tr>
                <td class="label">Full Name</td>
                <td colspan="3" class="value"><span class="hint">Last Name, First Name, Middle Name</span></td>
            </tr>
            <tr>
                <td class="label">Gender</td>
                <td class="value">
                    <span class="checkbox"></span>Male &nbsp;&nbsp;
                    <span class="checkbox"></span>Female &nbsp;&nbsp;
                    <span class="checkbox"></span>Other: <span class="write-line"></span>
                </td>
                <td class="label">Date of Birth</td>
                <td class="value"><span class="hint">MM / DD / YYYY</span></td>
            </tr>
            <tr>
                <td class="label">Contact No.</td>
                <td colspan="3" class="value"><span class="hint">e.g. 0917 123 4567</span></td>
            </tr>
            <tr>
                <td class="label">Address</td>
                <td colspan="3" class="value" style="height: 36px;">${blank}</td>
            </tr>
            <tr>
                <td class="label">Allergies / Alerts</td>
                <td colspan="3" class="value"><span class="hint">Known drug, food, latex allergies or &quot;None Known&quot;</span></td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">B. Appointment Details (For front desk use)</div>
        <table class="fields">
            <tr>
                <td class="label">Appointment No.</td>
                <td class="value">${blank}</td>
                <td class="label">Status</td>
                <td class="value">
                    <span class="checkbox"></span>Scheduled &nbsp;&nbsp;
                    <span class="checkbox"></span>Confirmed &nbsp;&nbsp;
                    <span class="checkbox"></span>Completed
                </td>
            </tr>
            <tr>
                <td class="label">Attending Doctor</td>
                <td class="value">${blank}</td>
                <td class="label">Specialty</td>
                <td class="value">${blank}</td>
            </tr>
            <tr>
                <td class="label">Schedule</td>
                <td class="value"><span class="hint">MM / DD / YYYY</span></td>
                <td class="label">Time</td>
                <td class="value"><span class="hint">HH : MM AM / PM</span></td>
            </tr>
            <tr>
                <td class="label">Chief Complaint</td>
                <td colspan="3" class="value" style="height: 60px;">${blank}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">C. Triage Vital Signs (For front desk use)</div>
        <table class="fields vitals">
            <tr>
                <td class="label">Blood Pressure</td>
                <td class="value">${blank}</td>
                <td class="label">Temperature (&deg;C)</td>
                <td class="value">${blank}</td>
                <td class="label">Oxygen Saturation (%)</td>
                <td class="value">${blank}</td>
            </tr>
        </table>
    </div>

    <div class="signatures">
        <div class="sig"><div class="sig-line">Patient / Guardian Signature</div></div>
        <div class="sig"><div class="sig-line">Received by (Front Desk)</div></div>
        <div class="sig"><div class="sig-line">Date</div></div>
    </div>

    <div class="footer">
        <span>Blank intake form. Please present the accomplished form at the front desk.</span>
        <span>Patient Registration &amp; Appointment Form</span>
    </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Hidden-iframe printing (avoids popup blockers and keeps global styles intact)
// ---------------------------------------------------------------------------

function openPrintFrame(html) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 1px; height: 1px; border: 0; opacity: 0; pointer-events: none; z-index: -1;';
    document.body.appendChild(frame);

    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    let removed = false;
    const removeFrame = () => {
        if (removed) return;
        removed = true;
        if (frame.parentNode) {
            frame.parentNode.removeChild(frame);
        }
    };

    const triggerPrint = () => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } finally {
            setTimeout(removeFrame, 1000);
        }
    };

    // Wait for the logo (and any other subresources) before printing
    const images = Array.from(frameDoc.images || []);
    Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    }))).then(() => setTimeout(triggerPrint, 150));

    // Safety net so a stuck resource never leaves the iframe in the DOM
    setTimeout(removeFrame, 60000);
}
