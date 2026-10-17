<?php
/**
 * tests/verify_profile_dropdown.php
 * Automated verification for Profile / Account Dropdown Menu across all user portals:
 * - Receptionist Portal (receptionist_dashboard.html)
 * - Doctor Portal (doctor_dashboard.html)
 * - Admin Portal (admin_dashboard.html)
 */

$rootDir = dirname(__DIR__);
$allPassed = true;
$testCount = 0;
$passCount = 0;

function runTest($description, $assertion) {
    global $testCount, $passCount, $allPassed;
    $testCount++;
    if ($assertion) {
        $passCount++;
        echo "  [PASS] Test {$testCount}: {$description}\n";
    } else {
        $allPassed = false;
        echo "  [FAIL] Test {$testCount}: {$description}\n";
    }
}

echo "============================================================\n";
echo "Profile / Account Dropdown & Logout Verification\n";
echo "============================================================\n\n";

$portals = [
    'Receptionist' => 'receptionist_dashboard.html',
    'Doctor'       => 'doctor_dashboard.html',
    'Admin'        => 'admin_dashboard.html'
];

foreach ($portals as $portalName => $htmlFile) {
    echo "--- Checking {$portalName} Portal ({$htmlFile}) ---\n";
    $htmlPath = $rootDir . '/' . $htmlFile;
    runTest("{$portalName} HTML file exists", file_exists($htmlPath));
    $html = file_get_contents($htmlPath);

    runTest("{$portalName} has div.dropdown container", strpos($html, '<div class="dropdown">') !== false);
    runTest("{$portalName} has button.user-menu-btn with data-dropdown-toggle", (
        strpos($html, 'class="user-menu-btn"') !== false &&
        strpos($html, 'data-dropdown-toggle') !== false
    ));
    runTest("{$portalName} user-menu-btn has accessibility attributes (aria-expanded, aria-haspopup, aria-label)", (
        strpos($html, 'aria-expanded="false"') !== false &&
        strpos($html, 'aria-haspopup="true"') !== false &&
        strpos($html, 'aria-label="Account menu"') !== false
    ));
    runTest("{$portalName} has ul.user-menu dropdown menu", strpos($html, '<ul class="user-menu">') !== false);
    runTest("{$portalName} has My Profile dropdown item", strpos($html, 'href="#profile"') !== false);
    runTest("{$portalName} has Settings dropdown item", strpos($html, 'href="#settings"') !== false);
    runTest("{$portalName} has Sign Out link to logout.php", (
        strpos($html, 'href="logout.php"') !== false &&
        strpos($html, 'Sign Out') !== false
    ));
    echo "\n";
}

echo "--- Checking UI Core Module (assets/js/ui.js) ---\n";
$uiPath = $rootDir . '/assets/js/ui.js';
$uiContent = file_get_contents($uiPath);

runTest("ui.js has idempotency guard window.__cprms_ui_events_initialized", (
    strpos($uiContent, 'window.__cprms_ui_events_initialized') !== false
));
runTest("ui.js has closeAllDropdowns() implementation", (
    strpos($uiContent, 'export function closeAllDropdowns()') !== false
));
runTest("ui.js has dropdown toggle handler matching [data-dropdown-toggle]", (
    strpos($uiContent, "e.target.closest('[data-dropdown-toggle]')") !== false
));
runTest("ui.js has outside click handler closing dropdowns (!e.target.closest('.dropdown'))", (
    strpos($uiContent, "!e.target.closest('.dropdown')") !== false
));
runTest("ui.js has dropdown-item click handler closing dropdowns", (
    strpos($uiContent, "e.target.closest('.dropdown-item')") !== false
));
runTest("ui.js has escape key handler closing dropdowns", (
    strpos($uiContent, "e.key === 'Escape'") !== false &&
    strpos($uiContent, "closeAllDropdowns();") !== false
));
runTest("ui.js synchronizes active modal state on window.__cprms_active_modal", (
    strpos($uiContent, 'window.__cprms_active_modal = modal;') !== false &&
    strpos($uiContent, 'window.__cprms_active_modal = null;') !== false
));
echo "\n";

echo "--- Checking Module Version Harmonization Across Codebase ---\n";
$jsFiles = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($rootDir . '/assets/js'));
$mismatchedUi = [];
$mismatchedApi = [];

foreach ($jsFiles as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'js') continue;
    $filePath = $file->getPathname();
    $content = file_get_contents($filePath);

    // Check ui.js imports
    if (preg_match_all('/(?:from\s+[\'"][^\'"]*ui\.js\?v=)(\d+)[\'"]/', $content, $matches)) {
        foreach ($matches[1] as $ver) {
            if ($ver !== '26') {
                $mismatchedUi[] = basename($filePath) . " has ui.js?v=" . $ver;
            }
        }
    }

    // Check api.js imports
    if (preg_match_all('/(?:from\s+[\'"][^\'"]*api\.js\?v=)(\d+)[\'"]/', $content, $matches)) {
        foreach ($matches[1] as $ver) {
            if ($ver !== '8') {
                $mismatchedApi[] = basename($filePath) . " has api.js?v=" . $ver;
            }
        }
    }
}

runTest("All ui.js imports unified at v=26 (count of mismatches: " . count($mismatchedUi) . ")", count($mismatchedUi) === 0);
if (!empty($mismatchedUi)) {
    echo "    Mismatches: " . implode(', ', $mismatchedUi) . "\n";
}

runTest("All api.js imports unified at v=8 (count of mismatches: " . count($mismatchedApi) . ")", count($mismatchedApi) === 0);
if (!empty($mismatchedApi)) {
    echo "    Mismatches: " . implode(', ', $mismatchedApi) . "\n";
}
echo "\n";

echo "--- Checking CSS Rules for Dropdown (assets/css/style.css) ---\n";
$cssPath = $rootDir . '/assets/css/style.css';
$css = file_get_contents($cssPath);

runTest(".dropdown position is relative", strpos($css, ".dropdown {\n    position: relative;\n}") !== false || strpos($css, ".dropdown { position: relative; }") !== false || preg_match('/\.dropdown\s*\{[^}]*position:\s*relative/i', $css));
runTest(".dropdown.show .user-menu makes menu visible (opacity: 1, visibility: visible)", (
    preg_match('/\.dropdown\.show\s+\.user-menu\s*\{[^}]*opacity:\s*1[^}]*visibility:\s*visible/i', $css)
));
runTest(".dropdown-item.text-danger styled for sign out action", (
    strpos($css, '.dropdown-item.text-danger') !== false
));
echo "\n";

echo "============================================================\n";
echo "Verification Summary: {$passCount}/{$testCount} tests passed.\n";
if ($allPassed) {
    echo "STATUS: ALL TESTS PASSED! Profile dropdown & logout verified across all portals.\n";
} else {
    echo "STATUS: SOME TESTS FAILED.\n";
}
echo "============================================================\n";
exit($allPassed ? 0 : 1);

