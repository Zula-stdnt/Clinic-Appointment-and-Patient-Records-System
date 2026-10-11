### **System Improvement To-Do List**

#### **1. Receptionist Portal – Patient Records & Demographics Form** `[COMPLETED]`
* **Remove Patient IDs:**
  - **What:** Removed visible database IDs (`PAT-0001`, etc.) from both the Receptionist Patient Records table and the "View Patient Details" screen.
  - **Why:** Database primary keys are internal computer IDs that cause clutter and confusion for front-desk staff.
  - **Where:** [`assets/js/modules/receptionist_patients.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/receptionist_patients.js) and [`assets/js/components/patient-record-view.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/components/patient-record-view.js).
  - **How:** Replaced raw IDs with real-world identifiers (Patient Full Name, Date of Birth, Phone Number). Database IDs are safely stored in hidden data attributes for background API communication.
* **Pre-populate Demographic Edit Form:**
  - **What:** Fixed the "Edit Patient Demographics" modal form so it automatically populates with the patient’s existing details (first name, middle initial, last name, gender, contact number, date of birth, home address) instead of opening blank.
  - **Why:** The API previously nested patient attributes under `{ patient: { ... } }` while the form looked at `res.data.first_name`, leading to blank fields.
  - **Where:** [`api/patient_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/patient_controller.php) and [`assets/js/modules/receptionist_patients.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/receptionist_patients.js).
  - **How:** Flattened response payload keys and updated frontend data bindings so existing patient demographics immediately pre-fill into form inputs.

---

#### **2. Receptionist Portal – Privacy & Layout Separation** `[COMPLETED]`
* **Strict Clinical Privacy:**
  - **What:** Completely removed medical record panels, encounter timelines, diagnosis history, lab orders, and prescriptions from the Receptionist portal.
  - **Why:** Front-desk receptionists are administrative staff and do not have clinical authority to read private medical encounters and doctor consultation notes.
  - **Where:** [`assets/js/components/patient-record-view.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/components/patient-record-view.js) and [`api/patient_record_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/patient_record_controller.php).
  - **How:** Added an `isReceptionist` role check on frontend rendering and server responses. When a receptionist views a patient, clinical history is blocked on both client and server sides.
* **Demographics-Only Layout:**
  - **What:** Designed a clean, dedicated front-desk demographics card featuring contact details, address, emergency contact information, registration date, and front-desk action buttons.
  - **Why:** Gives receptionists exactly the information they need to verify patient identity and schedule visits without exposing private clinical notes.
  - **Where:** [`assets/js/components/patient-record-view.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/components/patient-record-view.js).
  - **How:** Created a specialized front-desk profile view displaying personal and contact cards with quick actions to Edit Demographics or return to the directory.

---

#### **3. Doctor & Receptionist Portals – Universal ID Masking** `[COMPLETED]`
* **Hide Technical / Database IDs:**
  - **What:** Completely removed database primary keys and technical IDs (such as `PAT-0001`, `APT-0042`, or raw numerical IDs) across all screens, headers, dialogs, form inputs, and pickers in both Doctor and Receptionist interfaces.
  - **Why:** Displaying technical database keys exposes internal computer structures and creates visual clutter.
  - **Where:** Across `receptionist_patients.js`, `receptionist_appointments.js`, `doctor_consultation.js`, `doctor_patients.js`, and `patient-record-view.js`.
  - **How:** All visible UI labels now use human-friendly identifiers: Patient Full Name, Date of Birth, and Phone Number. Primary keys are kept safely in hidden HTML inputs and background JavaScript states.

---

#### **4. Doctor Portal – Directory Access & Break-Glass Protocol Workflow** `[COMPLETED]`
* **Universal Patient Directory:**
  - **What:** Allowed doctors to browse all registered hospital patients in the Patient Records directory rather than restricting the list only to previously assigned patients.
  - **Why:** Doctors need to verify if an arriving patient already exists in the hospital system or look up hospital directory entries.
  - **Where:** [`api/doctor_patients_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/doctor_patients_controller.php) and [`assets/js/modules/doctor_patients.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/doctor_patients.js).
  - **How:** Updated the directory query to list all active patients while displaying status badges indicating whether each patient is currently "Assigned" or "Unassigned".
* **Access Boundary:**
  - **What:** If a doctor does not have an active appointment with a patient, access to their clinical medical chart is locked by default.
  - **Why:** Protects patient privacy by preventing casual or unauthorized browsing of sensitive medical records.
  - **Where:** [`api/patient_record_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/patient_record_controller.php).
  - **How:** The API enforces ownership gating: unassigned access requests are blocked with `403 Forbidden` unless an authorized emergency override exists.
* **Emergency Override (Break-Glass Protocol):**
  - **What:** In emergency trauma or urgent coverage situations, doctors can activate the Break-Glass protocol by entering a clinical justification (at least 10 characters or preset emergency tags) to gain immediate access to the medical chart.
  - **Why:** Clinicians must be able to access critical health history in life-threatening emergencies, while ensuring all emergency overrides are strictly audited.
  - **Where:** [`assets/js/modules/doctor_patients.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/doctor_patients.js), [`api/patient_record_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/patient_record_controller.php), and [`includes/audit.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/includes/audit.php).
  - **How:** Clicking "Break-Glass" opens a dedicated modal dialog without screen flicker or network errors. Upon submission with a valid justification, emergency access is granted, an audited warning banner appears on the medical chart, and a permanent entry is recorded in `audit_logs`.

---

#### **5. Administrator Portal – Human-Readable Audit Logs & Entity Enrichment** `[COMPLETED]`
* **Human-Readable Event Descriptions:**
  - **What:** Converted the "Details / Reason" column in the Compliance & Audit Logs table from raw JSON strings, database identifiers, and technical code into clear, simple, human-readable English sentences that non-coders and hospital administrators can easily understand.
  - **Why:** Displaying raw JSON payloads (`{"username":"dr.house","role_name":"Doctor"}` or `{"patient_id":91,"doctor_id":1,...}`) and technical diff codes created visual confusion for administrators inspecting system compliance.
  - **Where:** [`assets/js/modules/audit_logs.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/audit_logs.js) and [`api/audit_log_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/audit_log_controller.php).
  - **How:** Built a dedicated `formatAuditDetails(item)` formatter handling all 26 distinct actions in the hospital system. Automatically translates actions into clean sentences (e.g., "Doctor logged in", "Appointment created for patient Jose Rizal and assigned to Dr. Gregory House", "Appointment status changed from Scheduled to Confirmed").
* **Backend Entity Name Enrichment:**
  - **What:** Enriched paginated audit log responses with real-world person names (`target_patient_name`, `target_doctor_name`, and `target_name`) instead of displaying cryptic numerical database IDs.
  - **Why:** Hospital administrators need to know which patient and doctor an appointment or medical record belongs to without cross-referencing internal database tables.
  - **Where:** [`api/audit_log_controller.php`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/api/audit_log_controller.php).
  - **How:** Performs batch entity lookups on the 10-50 paginated rows to retrieve patient full names and doctor full names, providing smooth fallbacks ("the patient", "the doctor") if records were permanently purged.
* **On-Demand Technical Diff Preview:**
  - **What:** Added a subtle, collapsible "View technical details" `<details>` toggle under any audit row that contains raw JSON data or field diffs.
  - **Why:** Keeps the primary table view 100% clean and readable for non-coders while allowing software developers and IT forensic auditors to inspect raw JSON data when needed.
  - **Where:** [`assets/js/modules/audit_logs.js`](file:///c:/xampp/htdocs/3rd%20Year/ITE%20387/Hospital%20Billing%20And%20Patient%20Information%20System/assets/js/modules/audit_logs.js).
  - **How:** Evaluates `old_values` and `new_values`. If present, renders an expandable summary that exposes the raw JSON diff without cluttering the main cell. The underlying database table `audit_logs` remains strictly immutable.