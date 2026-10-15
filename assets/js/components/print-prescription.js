// assets/js/components/print-prescription.js
// Builds and prints the prescription (Rx) slip handed to the patient after a
// consultation, using the saved encounter from the consultation controller.
// ITE 387 Lessons applied: 03 APIs and Database Operations/mysql_retrieve_specific_record
// (consultation detail fetched by appointment key) & 02 DOM and UI/dom_create_and_remove_elements

import api from '../api.js?v=7';
import { escapeHtml, showToast } from '../ui.js?v=24';
import { openPrintFrame, fullName, computeAge, formatDate, formatNow, orDash, capitalize } from './print-utils.js?v=1';

export async function printPrescription(appointmentId) {
    try {
        const res = await api.get(`api/consultation_controller.php?appointment_id=${appointmentId}`);
        if (!res.success || !res.data) {
            throw new Error(res.message || 'Failed to load consultation details.');
        }
        if (!res.data.consultation) {
            throw new Error('Save the consultation first before printing the prescription.');
        }
        if (!res.data.prescriptions || res.data.prescriptions.length === 0) {
            throw new Error('This consultation has no prescriptions to print.');
        }

        openPrintFrame(buildPrescription(res.data));
        return true;
    } catch (err) {
        showToast(err.response?.data?.message || err.message || 'Failed to prepare the prescription.', 'error');
        return false;
    }
}

export function buildPrescription(data) {
    const logoUrl = new URL('logo.png', window.location.href).href;
    const appt = data.appointment || {};
    const doctorName = `Dr. ${fullName(appt.doctor_last, appt.doctor_first, appt.doctor_middle)}`;
    const patientName = escapeHtml(fullName(appt.patient_last, appt.patient_first, appt.patient_middle));
    const age = computeAge(appt.date_of_birth);
    const patientNo = `PAT-${String(appt.patient_id).padStart(4, '0')}`;

    const diagnosisHtml = (data.diagnoses && data.diagnoses.length)
        ? `<ul class="plain-list">${data.diagnoses.map(d => `
                <li>
                    <strong>${escapeHtml(orDash(d.diagnosis_name))}</strong>
                    ${d.icd10_code ? `<span class="icd">(ICD-10: ${escapeHtml(d.icd10_code)})</span>` : ''}
                    ${d.notes ? `<div class="note">${escapeHtml(d.notes)}</div>` : ''}
                </li>`).join('')}
           </ul>`
        : '<p class="muted">No diagnosis recorded.</p>';

    const rxHtml = data.prescriptions.map((p, index) => {
        const generic = p.medication_generic ? ` (${escapeHtml(p.medication_generic)})` : '';
        const duration = p.end_date
            ? `${escapeHtml(formatDate(p.start_date))} to ${escapeHtml(formatDate(p.end_date))}`
            : `Starting ${escapeHtml(formatDate(p.start_date))}`;
        const timeToTake = p.time_to_take
            ? `<span><em>Time to take:</em> ${escapeHtml(p.time_to_take)}</span>`
            : '';
        return `
            <div class="rx-item">
                <div class="rx-line">
                    <span class="rx-number">${index + 1}.</span>
                    <strong class="rx-drug">${escapeHtml(orDash(p.medication_name))}${generic}</strong>
                </div>
                <div class="rx-detail">
                    <span><em>Dosage:</em> ${escapeHtml(orDash(p.dosage))}</span>
                    <span><em>Frequency:</em> ${escapeHtml(orDash(p.frequency))}</span>
                    ${timeToTake}
                    <span><em>Duration:</em> ${duration}</span>
                </div>
            </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${patientNo} - Prescription</title>
<style>${prescriptionStyles()}</style>
</head>
<body>
    <div class="header">
        <img src="${logoUrl}" alt="CPRMS Logo">
        <div>
            <div class="org">CLINIC PATIENT RECORDS MANAGEMENT SYSTEM (CPRMS)</div>
            <div class="sub">Out-Patient Department &middot; Prescription</div>
        </div>
        <div class="doc-number">
            <strong>Rx</strong>
            ${patientNo}
        </div>
    </div>

    <div class="doc-title">Prescription</div>
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
                <td class="label">Date</td>
                <td>${escapeHtml(formatDate(appt.appointment_date))}</td>
            </tr>
            <tr>
                <td class="label">Address</td>
                <td colspan="3">${escapeHtml(orDash(appt.address))}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Diagnosis</div>
        <div class="section-body">${diagnosisHtml}</div>
    </div>

    <div class="section">
        <div class="section-title">Medications</div>
        <div class="section-body">
            <div class="rx-symbol">Rx</div>
            ${rxHtml}
        </div>
    </div>

    <div class="signatures">
        <div class="sig">
            <div class="sig-line">${escapeHtml(doctorName)}</div>
            <div class="sig-sub">${escapeHtml(orDash(appt.doctor_specialties))} &middot; Prescribing Physician</div>
        </div>
        <div class="sig">
            <div class="sig-line">Patient / Guardian Signature</div>
            <div class="sig-sub">Received copy of prescription</div>
        </div>
    </div>

    <div class="footer">
        <span>This prescription is valid for the indicated duration only. Keep this copy for your records.</span>
        <span>${patientNo}</span>
    </div>
</body>
</html>`;
}

function prescriptionStyles() {
    return `
    @page { size: A4 portrait; margin: 13mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.35; }
    .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px double #111; padding-bottom: 10px; }
    .header img { height: 58px; width: auto; }
    .header .org { font-size: 14pt; font-weight: 700; letter-spacing: 0.4px; }
    .header .sub { font-size: 9pt; color: #333; }
    .header .doc-number { margin-left: auto; text-align: right; font-size: 9pt; }
    .header .doc-number strong { display: block; font-size: 16pt; }
    .doc-title { text-align: center; margin: 14px 0 3px; font-size: 14pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
    .doc-meta { text-align: center; font-size: 8.5pt; color: #444; margin-bottom: 14px; }
    .section { margin-bottom: 13px; page-break-inside: avoid; }
    .section-title { background: #ececec; border: 1px solid #111; border-bottom: 0; padding: 4px 8px; font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    .section-body { border: 1px solid #111; padding: 8px 10px; }
    table.fields { width: 100%; border-collapse: collapse; }
    table.fields td { border: 1px solid #111; padding: 5px 8px; vertical-align: top; }
    table.fields td.label { width: 18%; background: #f5f5f5; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    .plain-list { margin: 0; padding-left: 18px; }
    .plain-list li { margin-bottom: 4px; }
    .icd { color: #444; font-size: 9pt; }
    .note { font-size: 9pt; color: #444; }
    .muted { color: #666; margin: 0; }
    .rx-symbol { font-family: Georgia, 'Times New Roman', serif; font-size: 22pt; font-weight: 700; line-height: 1; margin-bottom: 6px; }
    .rx-item { border-bottom: 1px dotted #999; padding: 6px 0; page-break-inside: avoid; }
    .rx-item:last-child { border-bottom: 0; }
    .rx-line { display: flex; gap: 6px; align-items: baseline; }
    .rx-number { font-weight: 700; width: 18px; }
    .rx-drug { font-size: 11pt; }
    .rx-detail { display: flex; gap: 22px; flex-wrap: wrap; margin: 2px 0 0 24px; font-size: 9.5pt; color: #222; }
    .signatures { display: flex; gap: 34px; margin-top: 34px; page-break-inside: avoid; }
    .sig { flex: 1; text-align: center; font-size: 9pt; }
    .sig-line { border-top: 1px solid #111; margin-top: 48px; padding-top: 4px; font-weight: 700; }
    .sig-sub { color: #555; font-size: 8.5pt; }
    .footer { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #999; padding-top: 5px; font-size: 7.5pt; color: #555; }
`;
}
