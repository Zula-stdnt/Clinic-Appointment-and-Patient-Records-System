<?php
// includes/clinical_notes.php
// Helper functions for parsing and compiling SOAP (Subjective, Objective, Assessment, Plan) clinical notes.

/**
 * Parses clinical notes formatted in SOAP style into individual components.
 * If raw text does not contain SOAP section headers, assigns full text to 'subjective'.
 */
function parse_soap_notes(?string $notes): array {
    $result = [
        'subjective' => '',
        'objective'  => '',
        'assessment' => '',
        'plan'       => ''
    ];
    if (empty($notes)) {
        return $result;
    }
    $text = trim($notes);
    $pattern = '/(?:^|\n)\s*(?:\[?(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\]?):?\s*([\s\S]*?)(?=(?:\n\s*(?:\[?(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)\]?):?)|$)/i';
    if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
        $found = false;
        foreach ($matches as $m) {
            $key = strtolower($m[1]);
            if (isset($result[$key])) {
                $val = trim($m[2]);
                // If section was saved as placeholder "None recorded.", keep it empty in form fields
                if (strcasecmp($val, 'None recorded.') === 0) {
                    $val = '';
                }
                $result[$key] = $val;
                $found = true;
            }
        }
        if (!$found) {
            $result['subjective'] = $text;
        }
    } else {
        $result['subjective'] = $text;
    }
    return $result;
}

/**
 * Compiles individual SOAP fields into standardized clinical notes text.
 */
function compile_soap_notes(array $soap): string {
    $s = trim($soap['subjective'] ?? '');
    $o = trim($soap['objective'] ?? '');
    $a = trim($soap['assessment'] ?? '');
    $p = trim($soap['plan'] ?? '');

    if ($s === '' && $o === '' && $a === '' && $p === '') {
        return '';
    }

    return "SUBJECTIVE:\n" . ($s !== '' ? $s : 'None recorded.') . "\n\n" .
           "OBJECTIVE:\n" . ($o !== '' ? $o : 'None recorded.') . "\n\n" .
           "ASSESSMENT:\n" . ($a !== '' ? $a : 'None recorded.') . "\n\n" .
           "PLAN:\n" . ($p !== '' ? $p : 'None recorded.');
}

