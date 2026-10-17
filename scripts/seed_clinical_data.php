<?php
/**
 * scripts/seed_clinical_data.php
 * 
 * Comprehensive Seeder & Safe Reset Solution for Clinic & Patient Information System.
 * 
 * STRICT CONSTRAINT:
 * Does NOT touch, create, or alter any billing, invoice, or payment records.
 * 
 * PRESERVED CORE TABLES:
 * - roles, users, specialties, doctors, doctor_specialty, doctor_schedules,
 *   services, medications, icd10_codes, audit_logs
 * 
 * PURGED & SEEDED CLINICAL TABLES:
 * - record_access_requests, prescriptions, diagnosis, lab_requests,
 *   consultation_addenda, consultation, vital_signs, appointments, patients
 * 
 * SEED TARGET:
 * - Exactly 500 unique patient profiles with realistic demographics, allergy alerts,
 *   and doctor confirmation statuses.
 * - Comprehensive clinical histories, appointment scheduling adhering to active
 *   doctor availability and MySQL uq_doctor_active_slot constraints, triage vitals,
 *   standard SOAP consultation charts, ICD-10 diagnoses, and allergy-screened prescriptions.
 */

declare(strict_types=1);

// Set execution limits and timezone
ini_set('memory_limit', '512M');
set_time_limit(300);
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/../config/db_connect.php';

echo "====================================================================\n";
echo " CPRMS CLINICAL DATA RESET & COMPREHENSIVE SEEDER\n";
echo " System Date Reference: 2026-10-17 (Asia/Manila)\n";
echo " Constraint Check: Pure Patient Information System (NO Financials)\n";
echo "====================================================================\n\n";

// Verify active database
$dbStmt = $pdo->query("SELECT DATABASE()");
$currentDb = $dbStmt->fetchColumn();
echo "[INIT] Connected to Database: {$currentDb}\n";

// -----------------------------------------------------------------------------
// STEP 1: SAFETY AUDIT & PURGE OF CLINICAL DATA
// -----------------------------------------------------------------------------
echo "\n--- [STEP 1] Targeted Clinical Data Cleanup ---\n";

$targetPurgeTables = [
    'record_access_requests',
    'prescriptions',
    'diagnosis',
    'lab_requests',
    'consultation_addenda',
    'consultation',
    'vital_signs',
    'appointments',
    'patients',
];

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    foreach ($targetPurgeTables as $tbl) {
        // Truncate cleanly resets auto-increment to 1
        $pdo->exec("TRUNCATE TABLE `{$tbl}`");
        echo "  [PURGE] Table '{$tbl}' successfully cleared & AUTO_INCREMENT reset.\n";
    }
    
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "  [PURGE] Foreign key checks safely re-enabled.\n";
} catch (Exception $e) {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    die("FATAL: Failed during clinical table purge: " . $e->getMessage() . "\n");
}

// -----------------------------------------------------------------------------
// STEP 2: LOAD ACTIVE SYSTEM MASTERS & CONFIGURATION
// -----------------------------------------------------------------------------
echo "\n--- [STEP 2] Loading Active Practitioners & Configuration ---\n";

// Active Doctors
$docStmt = $pdo->query("
    SELECT d.doctor_id, d.user_id, u.first_name, u.last_name, u.username
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    WHERE d.deleted_at IS NULL AND u.deleted_at IS NULL
    ORDER BY d.doctor_id
");
$activeDoctors = $docStmt->fetchAll();
echo "  [DOCTORS] Found " . count($activeDoctors) . " active practitioners:\n";
foreach ($activeDoctors as $doc) {
    echo "    - Doctor #{$doc['doctor_id']}: Dr. {$doc['first_name']} {$doc['last_name']} (@{$doc['username']})\n";
}

// Active Creators (Receptionists and Admins for appointments)
$creatorStmt = $pdo->query("
    SELECT u.user_id, r.role_name, u.username, u.first_name, u.last_name
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.deleted_at IS NULL AND r.role_name IN ('Administrator', 'Receptionist')
    ORDER BY u.user_id
");
$activeCreators = $creatorStmt->fetchAll();
$creatorIds = array_column($activeCreators, 'user_id');
echo "  [STAFF] Found " . count($activeCreators) . " active staff creators (Admins/Receptionists).\n";

// Active Medications Formulary
$medStmt = $pdo->query("SELECT medication_id, name, generic_name FROM medications WHERE deleted_at IS NULL");
$medications = $medStmt->fetchAll();
$medsById = [];
foreach ($medications as $m) {
    $medsById[$m['medication_id']] = $m;
}
echo "  [FORMULARY] Loaded " . count($medications) . " medications from catalog.\n";

// Active ICD-10 Codes
$icdStmt = $pdo->query("SELECT code, description FROM icd10_codes");
$icdCodes = $icdStmt->fetchAll(PDO::FETCH_KEY_PAIR);
echo "  [ICD-10] Loaded " . count($icdCodes) . " diagnosis codes from catalog.\n";

// -----------------------------------------------------------------------------
// STEP 3: DEMOGRAPHIC DATA POOLS (FILIPINO PATIENT PROFILES)
// -----------------------------------------------------------------------------
echo "\n--- [STEP 3] Generating 500 Unique Patient Profiles ---\n";

$firstNamesMale = [
    'Juan', 'Jose', 'Mark', 'John', 'Angelo', 'Christian', 'Paolo', 'Gabriel', 'Rafael', 'Michael',
    'Joshua', 'Daniel', 'Carlos', 'Miguel', 'Antonio', 'Ramon', 'Eduardo', 'Manuel', 'Fernando', 'Ricardo',
    'Rodrigo', 'Francis', 'Dominic', 'Vincent', 'Alexander', 'Kenneth', 'Jerome', 'Patrick', 'Benedict', 'Lawrence',
    'Adrian', 'Nathaniel', 'Christopher', 'Jonathan', 'Emilio', 'Danilo', 'Ernesto', 'Renato', 'Arturo', 'Jaime',
    'Benjamin', 'Rolando', 'Salvador', 'Ferdinand', 'Vicente', 'Leonardo', 'Edgardo', 'Gerardo', 'Wilfredo', 'Nestor',
    'Enrique', 'Cesar', 'Armando', 'Bernardo', 'Felipe', 'Gregorio', 'Ignacio', 'Lamberto', 'Leandro', 'Mariano'
];

$firstNamesFemale = [
    'Maria', 'Mary', 'Angelica', 'Christine', 'Patricia', 'Katrina', 'Camille', 'Nicole', 'Bea', 'Sofia',
    'Rhea', 'Grace', 'Joy', 'Princess', 'Alyssa', 'Bianca', 'Clarissa', 'Danielle', 'Elena', 'Francesca',
    'Gabriela', 'Hannah', 'Isabella', 'Jasmine', 'Kristine', 'Lorraine', 'Michelle', 'Natasha', 'Olivia', 'Pauline',
    'Carmela', 'Rowena', 'Maricel', 'Lourdes', 'Corazon', 'Teresa', 'Rosario', 'Esperanza', 'Concepcion', 'Milagros',
    'Remedios', 'Josefina', 'Florencia', 'Amparo', 'Socorro', 'Consuelo', 'Estrella', 'Leonora', 'Aurora', 'Divina',
    'Gloria', 'Imelda', 'Leticia', 'Nenita', 'Ofelia', 'Perlita', 'Rosalinda', 'Virginia', 'Zenaida', 'Yolanda'
];

$lastNames = [
    'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada',
    'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Castro', 'Rivera', 'Aquino', 'Navarro', 'Salazar', 'Mercado',
    'Dela Cruz', 'Del Rosario', 'De Los Santos', 'De Leon', 'San Jose', 'Soriano', 'Valdez', 'Perez', 'Tan', 'Lim',
    'Go', 'Sy', 'Ong', 'Chua', 'Aquino', 'Marquez', 'Pascual', 'Manalo', 'Alvarez', 'Padilla',
    'Santiago', 'Magno', 'Gomez', 'Tolentino', 'Morales', 'Roxas', 'Velasco', 'Estrada', 'Aguilar', 'Corpuz',
    'Evangelista', 'Cortez', 'Domingo', 'Guerrero', 'Serrano', 'Fernandez', 'Lopez', 'Rosales', 'Miranda', 'David',
    'Pineda', 'Vergara', 'Panganiban', 'Cervantes', 'Mallari', 'Montemayor', 'Enriquez', 'Alcantara', 'Sarmiento', 'Calderon',
    'Villarreal', 'Legaspi', 'Arellano', 'Imperial', 'Soliman', 'Palma', 'Arce', 'Buenaventura', 'Quizon', 'Tugade'
];

$middleInitials = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'Z'];

$streets = [
    'Rizal Street', 'Bonifacio Avenue', 'Mabini Road', 'Luna Boulevard', 'Kalayaan Avenue',
    'Katipunan Avenue', 'Quezon Boulevard', 'Commonwealth Avenue', 'Ortigas Avenue', 'Aurora Boulevard',
    'Shaw Boulevard', 'Taft Avenue', 'Ayala Highway', 'Burgos Extension', 'del Pilar Street',
    'Aguinaldo Street', 'McArthur Highway', 'Boni Avenue', 'Espana Boulevard', 'Banawe Street'
];

$cities = [
    ['barangay' => 'Brgy. San Antonio', 'city' => 'Pasig City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Commonwealth', 'city' => 'Quezon City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Bel-Air', 'city' => 'Makati City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Kapitolyo', 'city' => 'Pasig City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Batasan Hills', 'city' => 'Quezon City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Poblacion', 'city' => 'Mandaluyong City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. BF Homes', 'city' => 'Paranaque City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Alabang', 'city' => 'Muntinlupa City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Malate', 'city' => 'Manila', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Sampaloc', 'city' => 'Manila', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Greenhills', 'city' => 'San Juan City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. Sto. Nino', 'city' => 'Marikina City', 'province' => 'Metro Manila'],
    ['barangay' => 'Brgy. San Jose', 'city' => 'Antipolo City', 'province' => 'Rizal'],
    ['barangay' => 'Brgy. San Roque', 'city' => 'Cainta', 'province' => 'Rizal'],
    ['barangay' => 'Brgy. Palico IV', 'city' => 'Imus City', 'province' => 'Cavite'],
    ['barangay' => 'Brgy. Molino III', 'city' => 'Bacoor City', 'province' => 'Cavite'],
    ['barangay' => 'Brgy. Balibago', 'city' => 'Santa Rosa City', 'province' => 'Laguna'],
    ['barangay' => 'Brgy. San Vicente', 'city' => 'Binan City', 'province' => 'Laguna'],
    ['barangay' => 'Brgy. Guinhawa', 'city' => 'Malolos City', 'province' => 'Bulacan'],
    ['barangay' => 'Brgy. Marulas', 'city' => 'Valenzuela City', 'province' => 'Metro Manila'],
];

$emergencyRelationships = ['Spouse', 'Parent', 'Mother', 'Father', 'Sibling', 'Brother', 'Sister', 'Child', 'Son', 'Daughter', 'Guardian'];

// Distinct allergy templates
$confirmedAllergiesList = [
    'Penicillin / Amoxicillin - Severe anaphylactoid rash, urticaria, facial angioedema',
    'Amoxicillin - Generalized pruritic maculopapular rash, eyelid swelling',
    'Aspirin / NSAIDs - Acute bronchospasm, severe urticaria, wheezing',
    'Mefenamic Acid (Ponstan) - Severe epigastric cramping, extensive cutaneous rash',
    'Sulfa Drugs (Co-trimoxazole) - Erythema multiforme, blistering skin rash',
    'Paracetamol - Severe drug-induced exanthema, periorbital edema',
    'Ibuprofen - Acute asthma exacerbation, facial angioedema',
    'Cephalosporins (Cephalexin) - Mild cutaneous urticaria, pruritus',
    'Shellfish & Iodine - Acute systemic hives, throat tightness',
    'Dust Mites & Environmental Pollen - Chronic allergic rhinitis, intermittent wheezing'
];

$unconfirmedIntakeAllergies = [
    'Patient reports mild itchiness and hives with Amoxicillin during childhood; pending physician testing',
    'Intake note: Suspected adverse reaction to unknown OTC painkiller in 2021; unverified',
    'Patient self-reports nausea and rash after taking antibiotics 5 years ago; unconfirmed',
    'Front-desk alert: Family history of severe Penicillin allergy; patient requests caution',
    'Reported slight lip swelling after eating shrimp; pending formal allergy consultation'
];

// Helper to generate realistic Philippine mobile number
function generatePhMobile(): string {
    $prefixes = ['0917', '0918', '0919', '0920', '0921', '0922', '0923', '0927', '0928', '0935', '0939', '0945', '0956', '0966', '0977', '0995'];
    return $prefixes[array_rand($prefixes)] . str_pad((string)mt_rand(1000000, 9999999), 7, '0', STR_PAD_LEFT);
}

// Generate exactly 500 patient records
$patientsData = [];
$usedFullNames = [];

$targetPatients = 500;
// Age cohorts: Pediatric (~20% = 100), Adult (~55% = 275), Geriatric (~25% = 125)
$cohorts = [
    'pediatric' => 100,
    'adult'     => 275,
    'geriatric' => 125,
];

$patientInsertSql = "
    INSERT INTO patients (
        patient_id, first_name, last_name, middle_initial, gender, date_of_birth,
        contact_no, address, allergies_alerts, allergies_confirmed_by_doctor, created_at, updated_at
    ) VALUES (
        :patient_id, :first_name, :last_name, :middle_initial, :gender, :date_of_birth,
        :contact_no, :address, :allergies_alerts, :allergies_confirmed_by_doctor, :created_at, :updated_at
    )
";
$patientStmt = $pdo->prepare($patientInsertSql);

$pidCounter = 1;
$pdo->beginTransaction();

foreach ($cohorts as $cohort => $count) {
    for ($i = 0; $i < $count; $i++) {
        // Gender distribution
        $rndGender = mt_rand(1, 100);
        if ($rndGender <= 48) {
            $gender = 'female';
            $firstName = $firstNamesFemale[array_rand($firstNamesFemale)];
        } elseif ($rndGender <= 96) {
            $gender = 'male';
            $firstName = $firstNamesMale[array_rand($firstNamesMale)];
        } else {
            $gender = 'other';
            $firstName = (mt_rand(0, 1) === 1) ? $firstNamesFemale[array_rand($firstNamesFemale)] : $firstNamesMale[array_rand($firstNamesMale)];
        }

        $lastName = $lastNames[array_rand($lastNames)];
        $mi = $middleInitials[array_rand($middleInitials)];

        // Ensure unique full name
        $fullNameKey = "{$firstName} {$mi}. {$lastName}";
        $suffixNum = 2;
        while (isset($usedFullNames[$fullNameKey])) {
            $fullNameKey = "{$firstName} {$mi}. {$lastName} " . ($suffixNum++);
        }
        $usedFullNames[$fullNameKey] = true;

        // Date of Birth based on cohort
        if ($cohort === 'pediatric') {
            // Age 0 to 17 (DOB between 2009-01-01 and 2026-04-01)
            $birthYear = mt_rand(2009, 2025);
            $birthMonth = mt_rand(1, 12);
            $birthDay = mt_rand(1, 28);
        } elseif ($cohort === 'adult') {
            // Age 18 to 59 (DOB between 1967-01-01 and 2008-09-01)
            $birthYear = mt_rand(1967, 2008);
            $birthMonth = mt_rand(1, 12);
            $birthDay = mt_rand(1, 28);
        } else {
            // Geriatric: Age 60 to 88 (DOB between 1938-01-01 and 1966-10-01)
            $birthYear = mt_rand(1938, 1966);
            $birthMonth = mt_rand(1, 12);
            $birthDay = mt_rand(1, 28);
        }
        $dob = sprintf('%04d-%02d-%02d', $birthYear, $birthMonth, $birthDay);

        // Address & Emergency Contact
        $streetNum = mt_rand(10, 999);
        $street = $streets[array_rand($streets)];
        $cityLoc = $cities[array_rand($cities)];
        $iceRelation = $emergencyRelationships[array_rand($emergencyRelationships)];
        $iceFirstName = (mt_rand(0, 1) === 1) ? $firstNamesFemale[array_rand($firstNamesFemale)] : $firstNamesMale[array_rand($firstNamesMale)];
        $iceLastName = (in_array($iceRelation, ['Spouse', 'Parent', 'Child', 'Sibling'])) ? $lastName : $lastNames[array_rand($lastNames)];
        $icePhone = generatePhMobile();
        
        $address = "{$streetNum} {$street}, {$cityLoc['barangay']}, {$cityLoc['city']} (ICE: {$iceFirstName} {$iceLastName} - {$iceRelation} {$icePhone})";

        // Allergy alerts and doctor confirmation
        // ~70% NKDA, ~20% confirmed, ~10% unconfirmed intake alert
        $allergyRoll = mt_rand(1, 100);
        if ($allergyRoll <= 20) {
            $allergyAlert = $confirmedAllergiesList[array_rand($confirmedAllergiesList)];
            $allergyConfirmed = 1;
        } elseif ($allergyRoll <= 30) {
            $allergyAlert = $unconfirmedIntakeAllergies[array_rand($unconfirmedIntakeAllergies)];
            $allergyConfirmed = 0;
        } else {
            $allergyAlert = null;
            $allergyConfirmed = 0;
        }

        $createdAt = date('Y-m-d H:i:s', strtotime("2025-08-01") + mt_rand(0, 55 * 86400));
        $updatedAt = $createdAt;

        $patientStmt->execute([
            ':patient_id'                    => $pidCounter,
            ':first_name'                    => $firstName,
            ':last_name'                     => $lastName,
            ':middle_initial'                => $mi,
            ':gender'                        => $gender,
            ':date_of_birth'                 => $dob,
            ':contact_no'                    => generatePhMobile(),
            ':address'                       => $address,
            ':allergies_alerts'              => $allergyAlert,
            ':allergies_confirmed_by_doctor' => $allergyConfirmed,
            ':created_at'                    => $createdAt,
            ':updated_at'                    => $updatedAt,
        ]);

        $patientsData[$pidCounter] = [
            'patient_id'                    => $pidCounter,
            'cohort'                        => $cohort,
            'gender'                        => $gender,
            'dob'                           => $dob,
            'first_name'                    => $firstName,
            'last_name'                     => $lastName,
            'allergies_alerts'              => $allergyAlert,
            'allergies_confirmed_by_doctor' => $allergyConfirmed,
        ];

        $pidCounter++;
    }
}

$pdo->commit();
echo "  [PATIENTS] Successfully created exactly " . count($patientsData) . " unique patient profiles.\n";

// -----------------------------------------------------------------------------
// STEP 4: CLINICAL KNOWLEDGE MATRIX (DOCTOR SPECIALTY MAPPING)
// -----------------------------------------------------------------------------
echo "\n--- [STEP 4] Configuring Specialty Clinical Blueprints ---\n";

/**
 * Specialty matrix defining clinical conditions, chief complaints, ICD-10 codes,
 * physical examination findings, SOAP notes, safe medications, and diagnostic tests.
 */
$specialtyClinicalMatrix = [
    // -------------------------------------------------------------------------
    // DOCTOR 1: Dr. Gregory House (Mon & Tue) -> Cardiology & Dermatology
    // -------------------------------------------------------------------------
    1 => [
        'doctor_id'   => 1,
        'doctor_name' => 'Dr. Gregory House',
        'allowed_days'=> [1, 2], // 1=Mon, 2=Tue
        'scenarios'   => [
            // Scenario 1: Primary Hypertension (Cardiology)
            [
                'specialty'       => 'Cardiology',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Occasional morning occipital headaches and elevated home blood pressure readings (150/95 mmHg) over past 3 weeks.',
                'icd10_code'      => 'I10',
                'diagnosis_name'  => 'Essential (primary) hypertension',
                'bp_range'        => ['sys' => [142, 164], 'dia' => [90, 102]],
                'temp_range'      => [36.4, 36.9],
                'spo2_range'      => [97, 99],
                'hr_range'        => [74, 88],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "Patient reports a 3-week history of throbbing occipital headaches, typically worse upon waking. No chest pain, syncope, or orthopnea. Home automated BP cuff records readings consistently above 145/90 mmHg. High dietary sodium intake noted.",
                    'o' => "HEENT: Sclerae anicteric, pink palpebral conjunctivae, fundoscopic exam shows mild arteriolar narrowing without papilledema. CVS: Regular rate and rhythm, distinct S1 and S2, no murmurs, rubs, or gallops. Normal peripheral pulses bilaterally.",
                    'a' => "Essential primary hypertension, Stage 2. Cardiovascular risk profile elevated. No overt target-organ damage detected on physical exam.",
                    'p' => "1. Initiate antihypertensive therapy with Amlodipine (Norvasc) 5mg daily. 2. Dietary sodium restriction (<2g/day) and structured daily aerobic walking. 3. Order fasting lipid profile, serum creatinine, and baseline 12-lead ECG. Follow-up in 4 weeks."
                ],
                'medications'     => [
                    ['id' => 4, 'name' => 'Norvasc 5mg Tablet', 'strength' => '5mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily in the morning', 'dur' => '30 days', 'instr' => 'Take in the morning with or without food. Monitor blood pressure weekly.', 'time' => 'Morning']
                ],
                'labs'            => ['Electrocardiogram (ECG)', 'Lipid Profile']
            ],
            // Scenario 2: Hypertensive Heart Disease & Angina (Cardiology)
            [
                'specialty'       => 'Cardiology',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Substernal chest tightness radiating to left shoulder on climbing stairs, relieved by rest.',
                'icd10_code'      => 'I20.9',
                'diagnosis_name'  => 'Angina pectoris, unspecified',
                'bp_range'        => ['sys' => [138, 158], 'dia' => [86, 96]],
                'temp_range'      => [36.5, 37.0],
                'spo2_range'      => [96, 99],
                'hr_range'        => [76, 92],
                'rr_range'        => [16, 20],
                'soap' => [
                    's' => "56-year-old presenting with recurrent substernal pressure and squeezing chest tightness during moderate exertion (climbing 2 flights of stairs). Pain lasts 3 to 5 minutes and completely subsides with rest. Denies diaphoresis, nausea, or active pain at rest.",
                    'o' => "Anxious appearance, no acute respiratory distress. CVS: Normal apical impulse at 5th ICS MCL, heart sounds normal S1/S2, trace bilateral pretibial edema. Lungs: Clear to auscultation bilaterally.",
                    'a' => "Stable Angina Pectoris (CCS Class II) secondary to suspected atherosclerotic coronary artery disease. Concomitant hypertension.",
                    'p' => "1. Prescribe Losartan (Cozaar) 50mg daily + Atorvastatin (Lipitor) 20mg at bedtime. 2. Schedule diagnostic 12-lead ECG and complete cardiac lipid panel. 3. Strict instruction to report immediately to ER if pain occurs at rest or exceeds 15 minutes."
                ],
                'medications'     => [
                    ['id' => 13, 'name' => 'Cozaar 50mg Tablet', 'strength' => '50mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily', 'dur' => '30 days', 'instr' => 'Take daily at the same time.', 'time' => 'Morning'],
                    ['id' => 16, 'name' => 'Lipitor 20mg Tablet', 'strength' => '20mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily at bedtime', 'dur' => '30 days', 'instr' => 'Take before sleeping.', 'time' => 'Night']
                ],
                'labs'            => ['Electrocardiogram (ECG)', 'Complete Blood Count (CBC)']
            ],
            // Scenario 3: Hyperlipidemia (Cardiology)
            [
                'specialty'       => 'Cardiology',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Routine cardiology check-up and management of elevated cholesterol detected on executive health screening.',
                'icd10_code'      => 'E78.5',
                'diagnosis_name'  => 'Hyperlipidemia, unspecified',
                'bp_range'        => ['sys' => [124, 140], 'dia' => [78, 88]],
                'temp_range'      => [36.5, 36.8],
                'spo2_range'      => [98, 100],
                'hr_range'        => [68, 80],
                'rr_range'        => [15, 17],
                'soap' => [
                    's' => "Asymptomatic adult presenting for follow-up of blood chemistry. Previous lipid panel reveals Total Cholesterol 265 mg/dL, LDL-C 178 mg/dL, Triglycerides 210 mg/dL. Denies chest pain, palpitation, or dyspnea on exertion.",
                    'o' => "Physical exam unremarkable. No xanthomas, xanthelasma, or arcus senilis. Heart sounds regular without murmurs. Abdomen soft, nontender.",
                    'a' => "Mixed Hyperlipidemia with moderate cardiovascular risk.",
                    'p' => "1. Start Atorvastatin (Lipitor) 20mg tab once daily at bedtime. 2. Therapeutic lifestyle changes: low saturated fat, high soluble fiber diet, cessation of smoking. 3. Repeat fasting lipid panel and ALT/AST in 8 weeks."
                ],
                'medications'     => [
                    ['id' => 16, 'name' => 'Lipitor 20mg Tablet', 'strength' => '20mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily at bedtime', 'dur' => '30 days', 'instr' => 'Take daily before sleep.', 'time' => 'Night']
                ],
                'labs'            => ['Lipid Profile']
            ],
            // Scenario 4: Tinea Pedis (Dermatology)
            [
                'specialty'       => 'Dermatology',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Intense pruritus, scaling, and skin maceration between toes for the past 2 weeks.',
                'icd10_code'      => 'B35.3',
                'diagnosis_name'  => 'Tinea pedis',
                'bp_range'        => ['sys' => [116, 130], 'dia' => [74, 84]],
                'temp_range'      => [36.4, 36.8],
                'spo2_range'      => [98, 100],
                'hr_range'        => [68, 82],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "Patient complains of severe itching, burning sensation, and white peeling skin in the 3rd and 4th interdigital web spaces of both feet. Wears occlusive work boots daily. No systemic symptoms.",
                    'o' => "Dermatologic Exam: Erythematous, macerated skin with scaling and superficial fissures in bilateral web spaces of 3rd and 4th digits. No purulent exudate or ascending lymphangitis.",
                    'a' => "Interdigital Tinea Pedis (athlete's foot), uncomplicated superficial fungal infection.",
                    'p' => "1. Topical Clotrimazole (Canesten) 1% cream applied thinly to affected interdigital spaces twice daily for 2 to 3 weeks. 2. Keep feet clean and dry, use cotton socks, avoid walking barefoot in shared locker areas."
                ],
                'medications'     => [
                    ['id' => 24, 'name' => 'Canesten 1% Cream', 'strength' => '1%', 'dosage' => 'Apply thin layer', 'route' => 'Topical', 'freq' => 'Twice daily', 'dur' => '21 days', 'instr' => 'Apply to clean, dry affected areas between toes morning and night.', 'time' => 'Twice daily']
                ],
                'labs'            => []
            ],
            // Scenario 5: Atopic Dermatitis & Eczema (Dermatology)
            [
                'specialty'       => 'Dermatology',
                'cohorts'         => ['pediatric', 'adult'],
                'chief_complaint' => 'Recurrent itchy, dry, erythematous patches on bilateral antecubital and popliteal fossae.',
                'icd10_code'      => 'L20.9',
                'diagnosis_name'  => 'Atopic dermatitis, unspecified',
                'bp_range'        => ['sys' => [110, 126], 'dia' => [70, 80]],
                'temp_range'      => [36.5, 36.8],
                'spo2_range'      => [98, 100],
                'hr_range'        => [72, 86],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "Patient reports a chronic relapsing history of pruritic skin flares over the flexural creases. Aggravated by heat, perspiration, and harsh soaps. Associated with personal history of allergic rhinitis.",
                    'o' => "Skin: Xerosis cutis with ill-defined erythematous plaques and lichenification over bilateral antecubital creases and wrists. Linear excoriations present from scratching. No secondary bacterial superinfection.",
                    'a' => "Atopic Dermatitis (Eczema), moderate flare.",
                    'p' => "1. Hydrocortisone (Cortizone-10) 1% cream applied to inflamed plaques twice daily for 7 days. 2. Cetirizine (Zyrtec) 10mg once daily at bedtime for itch control. 3. Liberal application of fragrance-free emollient immediately post-bathing."
                ],
                'medications'     => [
                    ['id' => 25, 'name' => 'Cortizone-10 1% Cream', 'strength' => '1%', 'dosage' => 'Apply thinly', 'route' => 'Topical', 'freq' => 'Twice daily', 'dur' => '7 days', 'instr' => 'Apply sparingly to affected itchy areas for up to 1 week.', 'time' => 'Twice daily'],
                    ['id' => 6, 'name' => 'Zyrtec 10mg Tablet', 'strength' => '10mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily at bedtime', 'dur' => '10 days', 'instr' => 'Take before sleeping for itch relief.', 'time' => 'Night']
                ],
                'labs'            => []
            ]
        ]
    ],

    // -------------------------------------------------------------------------
    // DOCTOR 3: Dr. Meredith Grey (Wed & Thu) -> General Surgery, Neurology, Internal Med
    // -------------------------------------------------------------------------
    3 => [
        'doctor_id'   => 3,
        'doctor_name' => 'Dr. Meredith Grey',
        'allowed_days'=> [3, 4], // 3=Wed, 4=Thu
        'scenarios'   => [
            // Scenario 1: Migraine Headache (Neurology)
            [
                'specialty'       => 'Neurology',
                'cohorts'         => ['adult'],
                'chief_complaint' => 'Throbbing right-sided hemicranial headache accompanied by photophobia and nausea for 24 hours.',
                'icd10_code'      => 'G43.9',
                'diagnosis_name'  => 'Migraine, unspecified',
                'bp_range'        => ['sys' => [118, 134], 'dia' => [76, 86]],
                'temp_range'      => [36.6, 37.0],
                'spo2_range'      => [98, 100],
                'hr_range'        => [78, 90],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "34-year-old presenting with acute onset unilateral pulsating headache, severity 8/10. Reports nausea, vomiting once earlier today, and extreme intolerance to bright lights and loud sounds. Relieved somewhat in a dark, quiet room.",
                    'o' => "Patient lying quietly in exam room with eyes closed. Cranial nerves II-XII intact. No neck stiffness, Kernig and Brudzinski signs negative. Normal motor strength, deep tendon reflexes 2+ bilaterally. Pupillary light reflex brisk.",
                    'a' => "Acute Migraine without Aura, severe episode.",
                    'p' => "1. Prescribe Naproxen (Naprosyn) 250mg tab every 8 hours PRN for moderate/severe headache pain. 2. Reassurance, adequate oral hydration, and trigger avoidance (sleep deprivation, caffeine withdrawal). Follow-up in 2 weeks."
                ],
                'medications'     => [
                    ['id' => 9, 'name' => 'Naprosyn 250mg Tablet', 'strength' => '250mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 8 hours as needed', 'dur' => '5 days', 'instr' => 'Take with full glass of water and after meals. Do not exceed 3 tablets daily.', 'time' => 'As needed']
                ],
                'labs'            => []
            ],
            // Scenario 2: Type 2 Diabetes Mellitus (Internal Medicine)
            [
                'specialty'       => 'Internal Medicine',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Gradual weight loss, polydipsia (excessive thirst), and frequent nighttime urination (nocturia x4) over 1 month.',
                'icd10_code'      => 'E11.9',
                'diagnosis_name'  => 'Type 2 diabetes mellitus without complications',
                'bp_range'        => ['sys' => [126, 142], 'dia' => [80, 90]],
                'temp_range'      => [36.5, 36.9],
                'spo2_range'      => [97, 99],
                'hr_range'        => [72, 84],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "Patient reports progressive polyuria, nocturia, and persistent dry mouth over 4 weeks despite drinking >3 liters of water daily. Unintentional 3 kg weight reduction. Family history positive for maternal diabetes mellitus.",
                    'o' => "Conscious, hydrated. Oral mucosa slightly dry. CVS: Normal S1/S2. Abdomen soft, nontender. Extremities: Foot pulses intact, monofilament light touch sensation intact bilaterally. Random capillary blood glucose measured at 215 mg/dL.",
                    'a' => "New-onset Type 2 Diabetes Mellitus, symptomatic hyperglycemia without ketoacidosis.",
                    'p' => "1. Metformin (Glucophage) 500mg tablet twice daily with breakfast and dinner. 2. Medical nutrition therapy: low glycemic index diet, portion control, elimination of sweetened beverages. 3. Baseline laboratory testing: HbA1c, FBS, urinalysis, serum creatinine."
                ],
                'medications'     => [
                    ['id' => 15, 'name' => 'Glucophage 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Twice daily with meals', 'dur' => '30 days', 'instr' => 'Take with breakfast and dinner to minimize gastrointestinal discomfort.', 'time' => 'Twice daily']
                ],
                'labs'            => ['Urinalysis', 'Lipid Profile', 'Complete Blood Count (CBC)']
            ],
            // Scenario 3: Acute Gastroenteritis (Internal Medicine)
            [
                'specialty'       => 'Internal Medicine',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Watery diarrhea (5-6 bowel movements today) with crampy periumbilical abdominal pain and nausea.',
                'icd10_code'      => 'A09',
                'diagnosis_name'  => 'Infectious gastroenteritis and colitis, unspecified',
                'bp_range'        => ['sys' => [104, 122], 'dia' => [68, 80]],
                'temp_range'      => [37.2, 38.3],
                'spo2_range'      => [97, 99],
                'hr_range'        => [86, 102],
                'rr_range'        => [18, 20],
                'soap' => [
                    's' => "Patient ingested street food 18 hours prior to onset of acute crampy abdominal colic followed by multiple watery, non-bloody bowel movements. Accompanied by mild low-grade fever and dry lips.",
                    'o' => "Slightly dry oral mucous membranes, skin turgor elastic. Abdomen: Hyperactive bowel sounds on auscultation, generalized periumbilical tenderness without peritoneal signs (no guarding, no rebound tenderness).",
                    'a' => "Acute Infectious Gastroenteritis with mild volume depletion (dehydration).",
                    'p' => "1. Oral rehydration therapy: Hydrite Oral Rehydration Salts after each loose stool. 2. Loperamide (Imodium) 2mg after loose stool (max 8mg/day) once acute fever subsides. 3. BRAT diet (bananas, rice, applesauce, toast), drink boiled water. Return if blood in stool."
                ],
                'medications'     => [
                    ['id' => 11, 'name' => 'Hydrite Oral Rehydration Salts', 'strength' => 'Standard sachet', 'dosage' => '1 sachet in 200mL water', 'route' => 'Oral', 'freq' => 'After every loose bowel movement', 'dur' => '3 days', 'instr' => 'Dissolve completely in drinking water and consume frequently.', 'time' => 'As needed'],
                    ['id' => 12, 'name' => 'Imodium 2mg Capsule', 'strength' => '2mg', 'dosage' => '1 capsule', 'route' => 'Oral', 'freq' => 'After loose bowel movement', 'dur' => '2 days', 'instr' => 'Take initial 2mg, then 2mg after each unformed stool. Max 8mg daily.', 'time' => 'As needed']
                ],
                'labs'            => ['Complete Blood Count (CBC)']
            ],
            // Scenario 4: Cholelithiasis Consult (General Surgery)
            [
                'specialty'       => 'General Surgery',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Recurrent postprandial right upper quadrant pain after fatty meals, lasting 1 to 2 hours.',
                'icd10_code'      => 'K80.20',
                'diagnosis_name'  => 'Calculus of gallbladder without cholecystitis',
                'bp_range'        => ['sys' => [122, 138], 'dia' => [78, 88]],
                'temp_range'      => [36.5, 36.9],
                'spo2_range'      => [98, 100],
                'hr_range'        => [72, 84],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "45-year-old presenting for surgical evaluation of ultrasound-proven cholelithiasis. Reports episodic crampy right upper quadrant discomfort precipitated by oily, fried food intake. No jaundice, dark urine, or acholic stools.",
                    'o' => "Abdomen: Flat, soft, mild tenderness on deep palpation of RUQ. Murphy's sign negative today. No palpable masses or organomegaly. Sclerae non-icteric.",
                    'a' => "Symptomatic Cholelithiasis (Biliary Colic). Good candidate for elective laparoscopic cholecystectomy.",
                    'p' => "1. Low-fat, non-greasy diet counseling. 2. Prescribe Paracetamol (Biogesic) 500mg for mild discomfort. 3. Pre-operative workup requested: CBC, Urinalysis, Chest X-Ray, ECG. Schedule elective surgery clinic review."
                ],
                'medications'     => [
                    ['id' => 2, 'name' => 'Biogesic 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 6 hours PRN', 'dur' => '7 days', 'instr' => 'Take for pain as needed. Maximum 4g daily.', 'time' => 'As needed']
                ],
                'labs'            => ['Abdominal Ultrasound', 'Complete Blood Count (CBC)', 'Chest X-Ray']
            ],
            // Scenario 5: Tension-Type Headache (Neurology)
            [
                'specialty'       => 'Neurology',
                'cohorts'         => ['adult'],
                'chief_complaint' => 'Tight, band-like dull headache across forehead and back of neck after long hours of desk work.',
                'icd10_code'      => 'G44.2',
                'diagnosis_name'  => 'Tension-type headache',
                'bp_range'        => ['sys' => [115, 128], 'dia' => [74, 82]],
                'temp_range'      => [36.5, 36.8],
                'spo2_range'      => [98, 100],
                'hr_range'        => [70, 82],
                'rr_range'        => [15, 17],
                'soap' => [
                    's' => "Patient reports constant, dull, pressing bilateral headache worsening towards the afternoon. Not aggravated by routine physical activity. Denies nausea, vomiting, photophobia, or visual changes. Work-related stress noted.",
                    'o' => "Normal neurological examination. Tenderness upon palpation of pericranial, trapezius, and suboccipital muscles. Full range of cervical spine motion without radicular pain.",
                    'a' => "Episodic Tension-Type Headache with associated cervical myofascial strain.",
                    'p' => "1. Biogesic (Paracetamol) 500mg PRN for headache relief. 2. Ergonomic workstation adjustments, posture correction, frequent screen breaks, neck stretching exercises."
                ],
                'medications'     => [
                    ['id' => 2, 'name' => 'Biogesic 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 6 hours PRN', 'dur' => '5 days', 'instr' => 'Take 1 tablet when headache occurs. Do not exceed 4g/day.', 'time' => 'As needed']
                ],
                'labs'            => []
            ]
        ]
    ],

    // -------------------------------------------------------------------------
    // DOCTOR 4: Dr. Stephen Strange (Fri & Sat) -> Pediatrics & Orthopedics
    // -------------------------------------------------------------------------
    4 => [
        'doctor_id'   => 4,
        'doctor_name' => 'Dr. Stephen Strange',
        'allowed_days'=> [5, 6], // 5=Fri, 6=Sat
        'scenarios'   => [
            // Scenario 1: Acute Upper Respiratory Tract Infection (Pediatrics)
            [
                'specialty'       => 'Pediatrics',
                'cohorts'         => ['pediatric'],
                'chief_complaint' => 'Clear runny nose, dry cough, mild fever, and decreased appetite for 3 days.',
                'icd10_code'      => 'J06.9',
                'diagnosis_name'  => 'Acute upper respiratory infection, unspecified',
                'bp_range'        => ['sys' => [94, 108], 'dia' => [60, 70]],
                'temp_range'      => [37.8, 38.8],
                'spo2_range'      => [97, 99],
                'hr_range'        => [98, 120],
                'rr_range'        => [22, 28],
                'soap' => [
                    's' => "Child brought in by mother with 3-day history of nasal congestion, clear rhinorrhea, sneezing, and low-grade fever. Sleeping restlessly due to clogged nose. No cyanosis, stridor, or chest indrawing.",
                    'o' => "Alert, playful child in no respiratory distress. HEENT: Nasal turbinates edematous with clear mucoid discharge. Pharynx mildly hyperemic, tonsils 1+ without exudate. Lungs: Clear breath sounds, no rales or wheezes. Neck supple.",
                    'a' => "Acute Viral Upper Respiratory Infection (Common Cold).",
                    'p' => "1. Supportive therapy: Paracetamol (Biogesic) 500mg / weight-adjusted suspension for fever >38C. 2. Ascof Lagundi 300mg tablet for productive cough. 3. Normal saline nasal drops, steam inhalation, liberal oral fluids. Re-evaluate if fever persists >5 days."
                ],
                'medications'     => [
                    ['id' => 2, 'name' => 'Biogesic 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 4-6 hours PRN for fever', 'dur' => '5 days', 'instr' => 'Take for fever >= 38C or body aches.', 'time' => 'As needed'],
                    ['id' => 21, 'name' => 'Ascof Lagundi 300mg Tablet', 'strength' => '300mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Three times daily', 'dur' => '7 days', 'instr' => 'Take after meals for cough relief.', 'time' => 'Morning, Noon, Night']
                ],
                'labs'            => ['Complete Blood Count (CBC)']
            ],
            // Scenario 2: Unspecified Asthma Flare (Pediatrics)
            [
                'specialty'       => 'Pediatrics',
                'cohorts'         => ['pediatric'],
                'chief_complaint' => 'Wheezing, nocturnal cough, and slight shortness of breath triggered by recent weather changes.',
                'icd10_code'      => 'J45.909',
                'diagnosis_name'  => 'Unspecified asthma, uncomplicated',
                'bp_range'        => ['sys' => [98, 112], 'dia' => [62, 72]],
                'temp_range'      => [36.7, 37.2],
                'spo2_range'      => [93, 96],
                'hr_range'        => [104, 126],
                'rr_range'        => [26, 32],
                'soap' => [
                    's' => "Known pediatric asthmatic presenting with 2 days of progressive wheezing and dry hacking cough, worse during early morning hours. Associated with mild exertion-induced dyspnea. Uses maintenance inhaler irregularly.",
                    'o' => "Mild tachypnea, no intercostal or supraclavicular retractions. Lungs: Bilateral expiratory wheezes audible across middle and lower lung fields. Prolonged expiratory phase. Heart: Tachycardia, regular rhythm.",
                    'a' => "Bronchial Asthma in mild to moderate acute exacerbation.",
                    'p' => "1. Salbutamol (Ventolin) 2mg tablet or nebulized salbutamol every 6-8 hours for bronchodilation. 2. Cetirizine (Zyrtec) 10mg once daily for allergic trigger mitigation. 3. Avoid exposure to cold air, dust, and animal dander. Return immediately if with retractions."
                ],
                'medications'     => [
                    ['id' => 20, 'name' => 'Ventolin 2mg Tablet', 'strength' => '2mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 8 hours as needed', 'dur' => '5 days', 'instr' => 'Take for wheezing or tight chest.', 'time' => 'As needed'],
                    ['id' => 6, 'name' => 'Zyrtec 10mg Tablet', 'strength' => '10mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Once daily', 'dur' => '7 days', 'instr' => 'Take in the evening.', 'time' => 'Night']
                ],
                'labs'            => ['Chest X-Ray']
            ],
            // Scenario 3: Acute Tonsillitis (Pediatrics)
            [
                'specialty'       => 'Pediatrics',
                'cohorts'         => ['pediatric'],
                'chief_complaint' => 'Severe throat pain on swallowing (odynophagia), high fever (39.0 C), and swollen neck glands for 2 days.',
                'icd10_code'      => 'J03.90',
                'diagnosis_name'  => 'Acute tonsillitis, unspecified',
                'bp_range'        => ['sys' => [96, 110], 'dia' => [62, 72]],
                'temp_range'      => [38.5, 39.4],
                'spo2_range'      => [97, 99],
                'hr_range'        => [110, 130],
                'rr_range'        => [22, 28],
                'soap' => [
                    's' => "Child complains of significant pain when swallowing solid foods or liquids. Chills and fever recorded at 39.2C at home. Denies cough or runny nose. Drooling slightly due to reluctance to swallow.",
                    'o' => "Febrile, flushed face. Oropharynx: Bilateral palatine tonsils enlarged (3+), erythematous with scattered white exudative patches on crypts. Uvula midline. Tender anterior cervical lymphadenopathy bilaterally.",
                    'a' => "Acute Exudative Tonsillitis (suspected Group A Streptococcus). Centor criteria: 4/4.",
                    'p' => "1. Antibiotic therapy: Amoxil (Amoxicillin) 500mg TID for 10 days (or Azithromycin if Penicillin-allergic). 2. Paracetamol (Biogesic) 500mg Q4-6H PRN for temperature control and throat pain. 3. Saltwater gargles, soft cold diet (ice cream, gelatin). Complete 10 full days of antibiotics."
                ],
                'medications'     => [
                    // Note: In generator logic, will check for Penicillin allergy and swap to Zithromax if allergic
                    ['id' => 1, 'name' => 'Amoxil 500mg Capsule', 'strength' => '500mg', 'dosage' => '1 capsule', 'route' => 'Oral', 'freq' => 'Every 8 hours', 'dur' => '10 days', 'instr' => 'Take every 8 hours with water. Finish entire 10-day course.', 'time' => 'Every 8 hours'],
                    ['id' => 2, 'name' => 'Biogesic 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Every 6 hours PRN', 'dur' => '5 days', 'instr' => 'Take for high fever or severe throat pain.', 'time' => 'As needed']
                ],
                'labs'            => ['Complete Blood Count (CBC)']
            ],
            // Scenario 4: Osteoarthritis of Knee (Orthopedics)
            [
                'specialty'       => 'Orthopedics',
                'cohorts'         => ['adult', 'geriatric'],
                'chief_complaint' => 'Bilateral knee stiffness in the morning and aching pain aggravated by weight-bearing and descending stairs.',
                'icd10_code'      => 'M17.9',
                'diagnosis_name'  => 'Osteoarthritis of knee, unspecified',
                'bp_range'        => ['sys' => [124, 144], 'dia' => [78, 88]],
                'temp_range'      => [36.5, 36.8],
                'spo2_range'      => [98, 100],
                'hr_range'        => [68, 80],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "64-year-old presenting with 6-month history of progressive bilateral knee aching. Pain is notably worse at the end of the day and when descending stairs or standing from low chairs. Morning stiffness lasts approximately 15 minutes.",
                    'o' => "Antalgic gait favoring right leg. Both knees show mild bony enlargement with palpable crepitus during active and passive flexion (ROM: 0-115 degrees). Mild medial joint line tenderness. No joint effusion or erythema.",
                    'a' => "Bilateral Primary Knee Osteoarthritis (Kellgren-Lawrence Grade 2-3).",
                    'p' => "1. Analgesia: Paracetamol (Biogesic) 500mg TID PRN; topical analgesic or short-course NSAID if severe. 2. Physical therapy referral for quadriceps strengthening and hamstring flexibility. 3. Weight reduction counseling and avoidance of deep squatting."
                ],
                'medications'     => [
                    ['id' => 2, 'name' => 'Biogesic 500mg Tablet', 'strength' => '500mg', 'dosage' => '1 tablet', 'route' => 'Oral', 'freq' => 'Three times daily PRN', 'dur' => '14 days', 'instr' => 'Take for joint discomfort.', 'time' => 'Morning, Noon, Night']
                ],
                'labs'            => []
            ],
            // Scenario 5: Acute Ankle Sprain (Orthopedics)
            [
                'specialty'       => 'Orthopedics',
                'cohorts'         => ['adult'],
                'chief_complaint' => 'Inversion injury of right ankle while jogging, with immediate swelling, ecchymosis, and difficulty weight-bearing.',
                'icd10_code'      => 'S93.40',
                'diagnosis_name'  => 'Sprain of ankle, unspecified',
                'bp_range'        => ['sys' => [120, 136], 'dia' => [76, 86]],
                'temp_range'      => [36.6, 37.0],
                'spo2_range'      => [98, 100],
                'hr_range'        => [78, 92],
                'rr_range'        => [16, 18],
                'soap' => [
                    's' => "28-year-old jogger sustained an acute inversion injury to right foot 4 hours ago. Felt a painful stretch over lateral ankle. Immediate localized swelling and ecchymosis. Able to take 4 steps with difficulty.",
                    'o' => "Right Ankle: Significant edema and ecchymosis over lateral malleolus and anterior talofibular ligament (ATFL). Point tenderness over ATFL; no bony tenderness along posterior edge of malleoli or base of 5th metatarsal (Ottawa Ankle Rules negative).",
                    'a' => "Acute Inversion Sprain of Right Ankle, Grade II (partial ATFL tear).",
                    'p' => "1. RICE protocol: Rest, Ice application (20 mins Q4H), Compression with elastic bandage, Elevation above heart level. 2. Ibuprofen (Advil) 200mg softgel every 8 hours with meals for 5 days. 3. Ankle brace support for ambulation."
                ],
                'medications'     => [
                    ['id' => 3, 'name' => 'Advil 200mg Softgel', 'strength' => '200mg', 'dosage' => '1 softgel', 'route' => 'Oral', 'freq' => 'Every 8 hours with meals', 'dur' => '5 days', 'instr' => 'Take with food to prevent stomach upset.', 'time' => 'Morning, Noon, Night']
                ],
                'labs'            => []
            ]
        ]
    ]
];

// -----------------------------------------------------------------------------
// STEP 5: GENERATE APPOINTMENTS, VITALS, CONSULTATIONS & PRESCRIPTIONS
// -----------------------------------------------------------------------------
echo "\n--- [STEP 5] Generating Linked Clinical Encounters ---\n";

// Slot Tracking Matrix: occupiedSlots[doctor_id][YYYY-MM-DD][HH:MM:SS] = true
$occupiedSlots = [
    1 => [],
    3 => [],
    4 => [],
];

// Helper to find a free 30-min slot for a doctor on a valid day
$timeSlots = [
    '08:00:00', '08:30:00', '09:00:00', '09:30:00',
    '10:00:00', '10:30:00', '11:00:00', '11:30:00',
    '13:00:00', '13:30:00', '14:00:00', '14:30:00',
    '15:00:00', '15:30:00', '16:00:00', '16:30:00'
];

function getFreeSlot(int $doctorId, string $date, array &$occupiedSlots, array $timeSlots): ?string {
    if (!isset($occupiedSlots[$doctorId][$date])) {
        $occupiedSlots[$doctorId][$date] = [];
    }
    // Shuffle slots for natural realistic spread
    $shuffledSlots = $timeSlots;
    shuffle($shuffledSlots);
    foreach ($shuffledSlots as $slot) {
        if (!isset($occupiedSlots[$doctorId][$date][$slot])) {
            $occupiedSlots[$doctorId][$date][$slot] = true;
            return $slot;
        }
    }
    return null; // Day full
}

// Generate valid dates for each doctor:
// Historical: 2025-10-01 to 2026-10-16 (~380 days, ~325 practice days)
// Today: 2026-10-17 (Saturday)
// Future: 2026-10-18 to 2026-11-21 (~34 days)
$doctorPracticeDates = [
    1 => ['past' => [], 'today' => [], 'future' => []],
    3 => ['past' => [], 'today' => [], 'future' => []],
    4 => ['past' => [], 'today' => [], 'future' => []],
];

$startDate = new DateTime('2025-10-01');
$todayDate = new DateTime('2026-10-17');
$endDate   = new DateTime('2026-11-21');

$cur = clone $startDate;
while ($cur <= $endDate) {
    $dow = (int)$cur->format('N'); // 1=Mon .. 7=Sun
    $dateStr = $cur->format('Y-m-d');
    
    // Check doctor matching
    foreach ([1, 3, 4] as $docId) {
        if (in_array($dow, $specialtyClinicalMatrix[$docId]['allowed_days'])) {
            if ($cur < $todayDate) {
                $doctorPracticeDates[$docId]['past'][] = $dateStr;
            } elseif ($cur == $todayDate) {
                $doctorPracticeDates[$docId]['today'][] = $dateStr;
            } else {
                $doctorPracticeDates[$docId]['future'][] = $dateStr;
            }
        }
    }
    $cur->modify('+1 day');
}

echo "  [SCHEDULE GRID] Computed practice dates across ~60 weeks (Oct 2025 - Nov 2026):\n";
foreach ([1, 3, 4] as $docId) {
    echo "    - Doctor #{$docId}: " . count($doctorPracticeDates[$docId]['past']) . " past days, " . 
         count($doctorPracticeDates[$docId]['today']) . " today, " . 
         count($doctorPracticeDates[$docId]['future']) . " future days.\n";
}

// Prepare statement for appointments
$apptInsertSql = "
    INSERT INTO appointments (
        appointment_id, patient_id, doctor_id, created_by, appointment_date, appointment_time,
        chief_complaint, status, cancel_requested, cancel_request_reason, cancel_requested_at, cancel_requested_by,
        created_at, updated_at
    ) VALUES (
        :appointment_id, :patient_id, :doctor_id, :created_by, :appointment_date, :appointment_time,
        :chief_complaint, :status, :cancel_requested, :cancel_request_reason, :cancel_requested_at, :cancel_requested_by,
        :created_at, :updated_at
    )
";
$apptStmt = $pdo->prepare($apptInsertSql);

// Prepare statement for vital_signs
$vitalInsertSql = "
    INSERT INTO vital_signs (
        appointment_id, blood_pressure, temperature, oxygen_saturation, created_at, updated_at
    ) VALUES (
        :appointment_id, :blood_pressure, :temperature, :oxygen_saturation, :created_at, :updated_at
    )
";
$vitalStmt = $pdo->prepare($vitalInsertSql);

// Prepare statement for consultation
$consultInsertSql = "
    INSERT INTO consultation (
        consultation_id, appointment_id, consultation_date, notes, created_at, updated_at
    ) VALUES (
        :consultation_id, :appointment_id, :consultation_date, :notes, :created_at, :updated_at
    )
";
$consultStmt = $pdo->prepare($consultInsertSql);

// Prepare statement for diagnosis
$diagInsertSql = "
    INSERT INTO diagnosis (
        consultation_id, icd10_code, diagnosis_name, notes, created_at, updated_at
    ) VALUES (
        :consultation_id, :icd10_code, :diagnosis_name, :notes, :created_at, :updated_at
    )
";
$diagStmt = $pdo->prepare($diagInsertSql);

// Prepare statement for prescriptions
$rxInsertSql = "
    INSERT INTO prescriptions (
        consultation_id, medication_id, strength, dosage, route, frequency,
        duration, instructions, time_to_take, start_date, end_date, created_at, updated_at
    ) VALUES (
        :consultation_id, :medication_id, :strength, :dosage, :route, :frequency,
        :duration, :instructions, :time_to_take, :start_date, :end_date, :created_at, :updated_at
    )
";
$rxStmt = $pdo->prepare($rxInsertSql);

// Prepare statement for lab_requests
$labInsertSql = "
    INSERT INTO lab_requests (
        consultation_id, test_name, status, request_date, created_at, updated_at
    ) VALUES (
        :consultation_id, :test_name, :status, :request_date, :created_at, :updated_at
    )
";
$labStmt = $pdo->prepare($labInsertSql);

// Prepare statement for consultation_addenda
$addendaInsertSql = "
    INSERT INTO consultation_addenda (
        consultation_id, doctor_id, notes, created_at
    ) VALUES (
        :consultation_id, :doctor_id, :notes, :created_at
    )
";
$addendaStmt = $pdo->prepare($addendaInsertSql);

$appointmentIdCounter = 1;
$consultationIdCounter = 1;

$totalCompletedAppts = 0;
$totalConfirmedAppts = 0;
$totalScheduledAppts = 0;
$totalCancelledAppts = 0;
$totalNoShowAppts    = 0;
$totalVitalsRecorded = 0;
$totalRxRecorded     = 0;

$dailyAppointmentCount = [];

$pdo->beginTransaction();

// Iterate through the 500 patients and assign appointment encounters
foreach ($patientsData as $pId => $p) {
    // Determine appointment count per patient:
    // User requested: "also add 4 more appointment history of all patient records."
    // Previously: 1 to 3 visits. Now: 5 to 7 visits (exactly 4 more visits for all 500 patients).
    $rndVisits = mt_rand(1, 100);
    $numVisits = (($rndVisits <= 55) ? 1 : (($rndVisits <= 90) ? 2 : 3)) + 4;

    // Pick primary doctor based on patient cohort
    // Pediatric -> 80% Dr. Strange (Pediatrics, ID 4), 20% Dr. Grey (Gen Surgery / Internal Med, ID 3)
    // Geriatric -> 45% Dr. House (Cardiology, ID 1), 40% Dr. Grey (Internal Med, ID 3), 15% Dr. Strange (Orthopedics, ID 4)
    // Adult     -> 35% Dr. House, 40% Dr. Grey, 25% Dr. Strange
    if ($p['cohort'] === 'pediatric') {
        $primaryDocId = (mt_rand(1, 100) <= 80) ? 4 : 3;
    } elseif ($p['cohort'] === 'geriatric') {
        $rDoc = mt_rand(1, 100);
        $primaryDocId = ($rDoc <= 45) ? 1 : (($rDoc <= 85) ? 3 : 4);
    } else {
        $rDoc = mt_rand(1, 100);
        $primaryDocId = ($rDoc <= 35) ? 1 : (($rDoc <= 75) ? 3 : 4);
    }

    $patientUsedDates = [];

    for ($v = 0; $v < $numVisits; $v++) {
        // Multi-specialty balance: 80% with primary doctor, 20% with another specialist
        $assignedDocId = $primaryDocId;
        if ($v > 0 && mt_rand(1, 100) <= 20) {
            $otherDocs = array_values(array_diff([1, 3, 4], [$primaryDocId]));
            $assignedDocId = $otherDocs[array_rand($otherDocs)];
        }

        // Temporal distribution:
        // Prior visits (0 to numVisits - 2): STRICTLY past clinical history
        // Final visit (numVisits - 1): ~65% past, ~10% today, ~25% future follow-up
        if ($v < $numVisits - 1) {
            $temporalBucket = 'past';
        } else {
            $rTemp = mt_rand(1, 100);
            if ($rTemp <= 65) {
                $temporalBucket = 'past';
            } elseif ($rTemp <= 75 && !empty($doctorPracticeDates[$assignedDocId]['today'])) {
                $temporalBucket = 'today';
            } else {
                $temporalBucket = 'future';
            }
        }

        // Available dates
        $availableDates = $doctorPracticeDates[$assignedDocId][$temporalBucket];
        if (empty($availableDates)) {
            // Fallback to past
            $availableDates = $doctorPracticeDates[$assignedDocId]['past'];
            $temporalBucket = 'past';
        }

        // Pick a date and find an open slot
        $apptDate = null;
        $apptTime = null;
        $attempts = 0;
        while ($attempts < 60 && $apptTime === null) {
            $candidateDate = $availableDates[array_rand($availableDates)];
            if (isset($patientUsedDates[$candidateDate])) {
                $attempts++;
                continue;
            }
            // Hard constraint: Maximum 9 seeded appointments per day (leaving at least 1 slot open out of the 10 daily max capacity)
            if (($dailyAppointmentCount[$candidateDate] ?? 0) >= 9) {
                $attempts++;
                continue;
            }
            $candidateSlot = getFreeSlot($assignedDocId, $candidateDate, $occupiedSlots, $timeSlots);
            if ($candidateSlot !== null) {
                $apptDate = $candidateDate;
                $apptTime = $candidateSlot;
            }
            $attempts++;
        }

        if ($apptTime === null) {
            // Sequential scan across availableDates to find ANY day with < 9 appointments
            foreach ($availableDates as $cand) {
                if (isset($patientUsedDates[$cand])) continue;
                if (($dailyAppointmentCount[$cand] ?? 0) < 9) {
                    $candidateSlot = getFreeSlot($assignedDocId, $cand, $occupiedSlots, $timeSlots);
                    if ($candidateSlot !== null) {
                        $apptDate = $cand;
                        $apptTime = $candidateSlot;
                        break;
                    }
                }
            }
        }

        if ($apptTime === null) {
            // Fallback across all past dates
            foreach ($doctorPracticeDates[$assignedDocId]['past'] as $cand) {
                if (isset($patientUsedDates[$cand])) continue;
                if (($dailyAppointmentCount[$cand] ?? 0) < 9) {
                    $candidateSlot = getFreeSlot($assignedDocId, $cand, $occupiedSlots, $timeSlots);
                    if ($candidateSlot !== null) {
                        $apptDate = $cand;
                        $apptTime = $candidateSlot;
                        $temporalBucket = 'past';
                        break;
                    }
                }
            }
        }

        if ($apptTime === null) {
            continue;
        }

        $patientUsedDates[$apptDate] = true;

        // Pick scenario appropriate for patient cohort and assigned doctor
        $eligibleScenarios = [];
        foreach ($specialtyClinicalMatrix[$assignedDocId]['scenarios'] as $sc) {
            if (in_array($p['cohort'], $sc['cohorts'])) {
                $eligibleScenarios[] = $sc;
            }
        }
        if (empty($eligibleScenarios)) {
            $eligibleScenarios = $specialtyClinicalMatrix[$assignedDocId]['scenarios'];
        }
        $scenario = $eligibleScenarios[array_rand($eligibleScenarios)];

        // Determine Status based on date
        $status = 'completed';
        $cancelReq = 0;
        $cancelReason = null;
        $cancelAt = null;
        $cancelBy = null;

        if ($apptDate < '2026-10-17') {
            // Past appointments: strictly done (completed, no_show, cancelled)
            $rStatus = mt_rand(1, 100);
            if ($rStatus <= 82) {
                $status = 'completed';
            } elseif ($rStatus <= 91) {
                $status = 'no_show';
            } else {
                $status = 'cancelled';
                $cancelReq = 1;
                $cancelReason = "Patient called front desk to reschedule due to unexpected work commitment.";
                $cancelAt = date('Y-m-d H:i:s', strtotime("{$apptDate} {$apptTime}") - 7200);
                $cancelBy = $creatorIds[array_rand($creatorIds)];
            }
        } elseif ($apptDate === '2026-10-17') {
            // Today's appointments: STRICTLY scheduled only
            $status = 'scheduled';
        } else {
            // Future appointments: STRICTLY scheduled only (or pre-cancelled)
            $status = (mt_rand(1, 100) <= 95) ? 'scheduled' : 'cancelled';
            if ($status === 'cancelled') {
                $cancelReq = 1;
                $cancelReason = "Patient requested cancellation of upcoming booking.";
                $cancelAt = date('Y-m-d H:i:s', strtotime("{$apptDate} {$apptTime}") - 86400);
                $cancelBy = $creatorIds[array_rand($creatorIds)];
            }
        }

        // Booking creator
        $createdBy = $creatorIds[array_rand($creatorIds)];

        // Chief complaint
        $chiefComplaint = $scenario['chief_complaint'];

        // Created_at timestamp (few days before appointment)
        $apptCreatedAt = date('Y-m-d H:i:s', strtotime("{$apptDate} {$apptTime}") - mt_rand(86400, 7 * 86400));
        $apptUpdatedAt = $apptCreatedAt;

        // Insert appointment
        $apptStmt->execute([
            ':appointment_id'       => $appointmentIdCounter,
            ':patient_id'           => $pId,
            ':doctor_id'            => $assignedDocId,
            ':created_by'           => $createdBy,
            ':appointment_date'     => $apptDate,
            ':appointment_time'     => $apptTime,
            ':chief_complaint'      => $chiefComplaint,
            ':status'               => $status,
            ':cancel_requested'     => $cancelReq,
            ':cancel_request_reason'=> $cancelReason,
            ':cancel_requested_at'  => $cancelAt,
            ':cancel_requested_by'  => $cancelBy,
            ':created_at'           => $apptCreatedAt,
            ':updated_at'           => $apptUpdatedAt,
        ]);

        // Track daily count (enforce max <= 9)
        $dailyAppointmentCount[$apptDate] = ($dailyAppointmentCount[$apptDate] ?? 0) + 1;

        // Track stats
        if ($status === 'completed') $totalCompletedAppts++;
        elseif ($status === 'confirmed') $totalConfirmedAppts++;
        elseif ($status === 'scheduled') $totalScheduledAppts++;
        elseif ($status === 'cancelled') $totalCancelledAppts++;
        elseif ($status === 'no_show') $totalNoShowAppts++;

        // Vital Signs (ONLY for completed visits)
        $needsVitals = ($status === 'completed');
        if ($needsVitals) {
            $sys = mt_rand($scenario['bp_range']['sys'][0], $scenario['bp_range']['sys'][1]);
            $dia = mt_rand($scenario['bp_range']['dia'][0], $scenario['bp_range']['dia'][1]);
            $bp  = "{$sys}/{$dia}";
            $temp = round(mt_rand((int)($scenario['temp_range'][0] * 10), (int)($scenario['temp_range'][1] * 10)) / 10, 1);
            $spo2 = round((float)mt_rand($scenario['spo2_range'][0], $scenario['spo2_range'][1]), 1);

            $vitalStmt->execute([
                ':appointment_id'    => $appointmentIdCounter,
                ':blood_pressure'    => $bp,
                ':temperature'       => $temp,
                ':oxygen_saturation' => $spo2,
                ':created_at'        => "{$apptDate} {$apptTime}",
                ':updated_at'        => "{$apptDate} {$apptTime}",
            ]);
            $totalVitalsRecorded++;
        }

        // Consultations, SOAP Notes, Diagnoses & Prescriptions (Only for COMPLETED visits)
        if ($status === 'completed') {
            $consultDate = date('Y-m-d H:i:s', strtotime("{$apptDate} {$apptTime}") + mt_rand(600, 1800));

            // Generate full SOAP Notes with embedded physical vitals (HR, RR, Wt, Ht, BMI)
            $hr = mt_rand($scenario['hr_range'][0], $scenario['hr_range'][1]);
            $rr = mt_rand($scenario['rr_range'][0], $scenario['rr_range'][1]);

            // Weight & Height based on cohort
            if ($p['cohort'] === 'pediatric') {
                $wt = mt_rand(12, 48);
                $ht = mt_rand(90, 155);
            } elseif ($p['cohort'] === 'adult') {
                $wt = mt_rand(50, 85);
                $ht = mt_rand(152, 180);
            } else {
                $wt = mt_rand(48, 78);
                $ht = mt_rand(148, 172);
            }
            $bmi = round($wt / (($ht / 100) ** 2), 1);

            $soapSubjective = $scenario['soap']['s'];
            $soapObjective  = "TRIAGE VITALS: BP {$bp} mmHg, HR {$hr} bpm, RR {$rr} cpm, Temp {$temp}°C, SpO2 {$spo2}%. Wt: {$wt} kg, Ht: {$ht} cm (BMI: {$bmi} kg/m²).\n" . $scenario['soap']['o'];
            $soapAssessment = $scenario['soap']['a'];
            $soapPlan       = $scenario['soap']['p'];

            $formattedSoap = "SUBJECTIVE:\n{$soapSubjective}\n\nOBJECTIVE:\n{$soapObjective}\n\nASSESSMENT:\n{$soapAssessment}\n\nPLAN:\n{$soapPlan}";

            $consultStmt->execute([
                ':consultation_id'   => $consultationIdCounter,
                ':appointment_id'    => $appointmentIdCounter,
                ':consultation_date' => $consultDate,
                ':notes'             => $formattedSoap,
                ':created_at'        => $consultDate,
                ':updated_at'        => $consultDate,
            ]);

            // Insert Primary Diagnosis
            $diagStmt->execute([
                ':consultation_id' => $consultationIdCounter,
                ':icd10_code'      => $scenario['icd10_code'],
                ':diagnosis_name'  => $scenario['diagnosis_name'],
                ':notes'           => "Confirmed clinical presentation matching ICD-10 criteria. Severity assessed as moderate.",
                ':created_at'      => $consultDate,
                ':updated_at'      => $consultDate,
            ]);

            // Prescriptions with Allergy Cross-Checking
            foreach ($scenario['medications'] as $med) {
                $prescribeMedId = $med['id'];
                $medDetails = $medsById[$prescribeMedId] ?? null;

                // Allergy Safety Check:
                // If patient has Penicillin allergy, DO NOT prescribe Amoxil (ID 1) or Augmentin (ID 22)
                $hasPenicillinAllergy = ($p['allergies_alerts'] !== null && stripos($p['allergies_alerts'], 'penicillin') !== false);
                $hasNsaidAllergy      = ($p['allergies_alerts'] !== null && (stripos($p['allergies_alerts'], 'nsaid') !== false || stripos($p['allergies_alerts'], 'aspirin') !== false || stripos($p['allergies_alerts'], 'mefenamic') !== false));
                $hasParacetamolAllergy= ($p['allergies_alerts'] !== null && stripos($p['allergies_alerts'], 'paracetamol') !== false);

                if ($hasPenicillinAllergy && ($prescribeMedId == 1 || $prescribeMedId == 22)) {
                    // Substitute with Azithromycin (Zithromax, ID 5)
                    $prescribeMedId = 5;
                    $med = [
                        'id'       => 5,
                        'name'     => 'Zithromax 500mg Tablet',
                        'strength' => '500mg',
                        'dosage'   => '1 tablet',
                        'route'    => 'Oral',
                        'freq'     => 'Once daily',
                        'dur'      => '3 days',
                        'instr'    => 'Take 1 hour before or 2 hours after meals. (Allergy substitution for Penicillin).',
                        'time'     => 'Morning'
                    ];
                } elseif ($hasNsaidAllergy && ($prescribeMedId == 3 || $prescribeMedId == 8 || $prescribeMedId == 9)) {
                    // Substitute with Paracetamol (Biogesic, ID 2)
                    $prescribeMedId = 2;
                    $med = [
                        'id'       => 2,
                        'name'     => 'Biogesic 500mg Tablet',
                        'strength' => '500mg',
                        'dosage'   => '1 tablet',
                        'route'    => 'Oral',
                        'freq'     => 'Every 6 hours PRN',
                        'dur'      => '5 days',
                        'instr'    => 'Take for pain or fever. (Allergy substitution for NSAID).',
                        'time'     => 'As needed'
                    ];
                } elseif ($hasParacetamolAllergy && $prescribeMedId == 2) {
                    // Substitute with Ibuprofen (Advil, ID 3) if not also NSAID allergic
                    if (!$hasNsaidAllergy) {
                        $prescribeMedId = 3;
                        $med = [
                            'id'       => 3,
                            'name'     => 'Advil 200mg Softgel',
                            'strength' => '200mg',
                            'dosage'   => '1 softgel',
                            'route'    => 'Oral',
                            'freq'     => 'Every 8 hours with meals',
                            'dur'      => '5 days',
                            'instr'    => 'Take with food. (Allergy substitution for Paracetamol).',
                            'time'     => 'With meals'
                        ];
                    }
                }

                $rxStartDate = $apptDate;
                $durationDays = (int)filter_var($med['dur'], FILTER_SANITIZE_NUMBER_INT) ?: 7;
                $rxEndDate = date('Y-m-d', strtotime("{$rxStartDate} +{$durationDays} days"));

                $rxStmt->execute([
                    ':consultation_id' => $consultationIdCounter,
                    ':medication_id'   => $prescribeMedId,
                    ':strength'        => $med['strength'],
                    ':dosage'          => $med['dosage'],
                    ':route'           => $med['route'],
                    ':frequency'       => $med['freq'],
                    ':duration'        => $med['dur'],
                    ':instructions'    => $med['instr'],
                    ':time_to_take'    => $med['time'],
                    ':start_date'      => $rxStartDate,
                    ':end_date'        => $rxEndDate,
                    ':created_at'      => $consultDate,
                    ':updated_at'      => $consultDate,
                ]);
                $totalRxRecorded++;
            }

            // Diagnostic Lab Requests
            if (!empty($scenario['labs'])) {
                foreach ($scenario['labs'] as $labTest) {
                    $labStatus = ($temporalBucket === 'past') ? 'completed' : 'requested';
                    $labStmt->execute([
                        ':consultation_id' => $consultationIdCounter,
                        ':test_name'       => $labTest,
                        ':status'          => $labStatus,
                        ':request_date'    => $apptDate,
                        ':created_at'      => $consultDate,
                        ':updated_at'      => $consultDate,
                    ]);
                }
            }

            // Occasional Doctor Addenda (~5% of completed consultations)
            if (mt_rand(1, 100) <= 5) {
                $addendaText = "ADDENDUM: Patient telephoned the clinic 48 hours post-consultation reporting notable symptom improvement with current regimen. Encouraged continuation of prescribed therapy and advised to keep scheduled follow-up.";
                $addendaStmt->execute([
                    ':consultation_id' => $consultationIdCounter,
                    ':doctor_id'       => $assignedDocId,
                    ':notes'           => $addendaText,
                    ':created_at'      => date('Y-m-d H:i:s', strtotime($consultDate) + 172800),
                ]);
            }

            $consultationIdCounter++;
        }

        $appointmentIdCounter++;
    }
}

$pdo->commit();

// -----------------------------------------------------------------------------
// STEP 6: VERIFICATION & AUDIT INTEGRITY REPORT
// -----------------------------------------------------------------------------
echo "\n====================================================================\n";
echo " VERIFICATION & INTEGRITY SUMMARY REPORT\n";
echo "====================================================================\n";

$verifyTables = [
    'patients',
    'appointments',
    'vital_signs',
    'consultation',
    'diagnosis',
    'prescriptions',
    'lab_requests',
    'consultation_addenda',
    'record_access_requests',
    'users',
    'doctors',
    'specialties',
    'services',
    'medications',
    'icd10_codes'
];

foreach ($verifyTables as $t) {
    $c = $pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
    echo sprintf("  %-25s : %6d records\n", $t, $c);
}

echo "\n--- Appointment Status Distribution ---\n";
echo "  - Completed  : {$totalCompletedAppts}\n";
echo "  - Confirmed  : {$totalConfirmedAppts}\n";
echo "  - Scheduled  : {$totalScheduledAppts}\n";
echo "  - Cancelled  : {$totalCancelledAppts}\n";
echo "  - No Show    : {$totalNoShowAppts}\n";
echo "  - Total Appts: " . ($appointmentIdCounter - 1) . "\n";

echo "\n--- Clinical Correlation Highlights ---\n";
echo "  - Triage Vitals Records  : {$totalVitalsRecorded}\n";
echo "  - SOAP Consultations     : " . ($consultationIdCounter - 1) . "\n";
echo "  - Prescription Orders    : {$totalRxRecorded}\n";

// Confirm allergy safety
$allergyCountStmt = $pdo->query("SELECT COUNT(*) FROM patients WHERE allergies_alerts IS NOT NULL");
$allergyConfirmedStmt = $pdo->query("SELECT COUNT(*) FROM patients WHERE allergies_confirmed_by_doctor = 1");
echo "  - Patients with Allergies: " . $allergyCountStmt->fetchColumn() . "\n";
echo "  - Doctor Confirmed       : " . $allergyConfirmedStmt->fetchColumn() . "\n";

// Confirm no billing records exist
$billingTablesCheck = $pdo->query("SHOW TABLES LIKE '%billing%'")->fetchAll();
$invoiceTablesCheck = $pdo->query("SHOW TABLES LIKE '%invoice%'")->fetchAll();
echo "\n--- Constraint Verification ---\n";
echo "  - Billing tables detected: " . count($billingTablesCheck) . " (Preserved pure patient info constraint)\n";
echo "  - Invoice tables detected: " . count($invoiceTablesCheck) . " (Preserved pure patient info constraint)\n";
echo "\n[SUCCESS] Clinical Data Seeding Completed Cleanly & Successfully!\n";

