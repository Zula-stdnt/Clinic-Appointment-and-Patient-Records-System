// assets/js/components/print-lab-request.js
// Builds and prints the laboratory / diagnostic request slip. The doctor hands
// it to the patient, who presents it to the laboratory or diagnostic area.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record
// (consultation detail fetched by appointment key) & 02 DOM and UI/dom_create_and_remove_elements

import api from '../api.js?v=8';
import { escapeHtml, showToast } from '../ui.js?v=26';
import { openPrintFrame, fullName, computeAge, formatDate, formatNow, orDash, capitalize } from './print-utils.js?v=1';

export async function printLabRequest(appointmentId) {
    try {
        const res = await api.get(`api/consultation_controller.php?appointment_id=${appointmentId}`);
        if (!res.success || !res.data) {
            throw new Error(res.message || 'Failed to load consultation details.');
        }
        if (!res.data.consultation) {
            throw new Error('Save the consultation first before printing the lab request.');
        }
        if (!res.data.lab_requests || res.data.lab_requests.length === 0) {
            throw new Error('This consultation has no laboratory requests to print.');
        }

        openPrintFrame(buildLabRequest(res.data));
        return true;
    } catch (err) {
        showToast(err.response?.data?.message || err.message || 'Failed to prepare the lab request.', 'error');
        return false;
    }
}

export function buildLabRequest(data) {
    const logoUrl = new URL('logo.png', window.location.href).href;
    const appt = data.appointment || {};
    const doctorName = `Dr. ${fullName(appt.doctor_last, appt.doctor_first, appt.doctor_middle)}`;
    const patientName = escapeHtml(fullName(appt.patient_last, appt.patient_first, appt.patient_middle));
    const age = computeAge(appt.date_of_birth);
    const patientNo = `PAT-${String(appt.patient_id).padStart(4, '0')}`;
    const requestNo = `LAB-${String(appt.appointment_id).padStart(4, '0')}`;

    const rows = data.lab_requests.map((l, index) => `
        <tr>
            <td class="center">${index + 1}</td>
            <td><strong>${escapeHtml(orDash(l.test_name))}</strong></td>
            <td>${escapeHtml(formatDate(l.request_date))}</td>
            <td class="center"><span class="checkbox"></span></td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${patientNo} - Laboratory Request</title>
<style>${labRequestStyles()}</style>
</head>
<body>
    <div class="header">
        <img src="${logoUrl}" alt="CPRMS Logo">
        <div>
            <div class="org">CLINIC APPOINTMENT AND PATIENT RECORDS SYSTEM (CAPRS)</div>
            <div class="sub">Out-Patient Department &middot; Laboratory &amp; Diagnostic Request</div>
        </div>
        <div class="doc-number">
            <strong>${requestNo}</strong>
            ${patientNo}
        </div>
    </div>

    <div class="doc-title">Laboratory &amp; Diagnostic Request</div>
    <div class="doc-meta">Printed on ${escapeHtml(formatNow())}</div>

    <div class="section">
        <table class="fields">
            <tr>
                <td class="label">Patient Name</td>
                <td colspan="3"><strong>${patientName}</strong></td>
            </tr>
            <tr>
                <td class="label">Age / Sex</td>
                <td>${escapeHtml(age || '—')} / ${escapeHtml(capitalize(appt.patient_gender))}</td>
                <td class="label">Date Ordered</td>
                <td>${escapeHtml(formatDate(appt.appointment_date))}</td>
            </tr>
            <tr>
                <td class="label">Ordering Doctor</td>
                <td colspan="3">${escapeHtml(doctorName)} &middot; ${escapeHtml(orDash(appt.doctor_specialties))}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Requested Tests / Procedures</div>
        <table class="tests">
            <thead>
                <tr>
                    <th style="width: 8%;">#</th>
                    <th>Test / Procedure</th>
                    <th style="width: 20%;">Date</th>
                    <th style="width: 12%;">Done</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>

    <div class="instructions">
        <strong>For the patient:</strong> Present this request to the laboratory or diagnostic area.
        Bring a valid ID.
    </div>

    <div class="signatures">
        <div class="sig">
            <div class="sig-line">${escapeHtml(doctorName)}</div>
            <div class="sig-sub">Ordering Physician</div>
        </div>
        <div class="sig">
            <div class="sig-line">Patient / Guardian Signature</div>
            <div class="sig-sub">Received copy of request</div>
        </div>
    </div>

    <div class="footer">
        <span>System-generated request. Please keep this slip and bring it to your scheduled procedure.</span>
        <span>${requestNo} &middot; ${patientNo}</span>
    </div>
</body>
</html>`;
}

function labRequestStyles() {
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
    .doc-title { text-align: center; margin: 14px 0 3px; font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta { text-align: center; font-size: 8.5pt; color: #444; margin-bottom: 14px; }
    .section { margin-bottom: 13px; page-break-inside: avoid; }
    .section-title { background: #ececec; border: 1px solid #111; border-bottom: 0; padding: 4px 8px; font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    table.fields { width: 100%; border-collapse: collapse; }
    table.fields td { border: 1px solid #111; padding: 5px 8px; vertical-align: top; }
    table.fields td.label { width: 18%; background: #f5f5f5; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    table.tests { width: 100%; border-collapse: collapse; }
    table.tests th, table.tests td { border: 1px solid #111; padding: 6px 8px; text-align: left; }
    table.tests th { background: #f5f5f5; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; }
    table.tests td.center, table.tests th.center { text-align: center; }
    .instructions { border: 1px solid #111; background: #fafafa; padding: 8px 10px; font-size: 9.5pt; margin: 14px 0; }
    .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #111; vertical-align: -2px; }
    .signatures { display: flex; gap: 34px; margin-top: 40px; page-break-inside: avoid; }
    .sig { flex: 1; text-align: center; font-size: 9pt; }
    .sig-line { border-top: 1px solid #111; margin-top: 44px; padding-top: 4px; font-weight: 700; }
    .sig-sub { color: #555; font-size: 8.5pt; }
    .footer { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #999; padding-top: 5px; font-size: 7.5pt; color: #555; }
`;
}
