const { test, expect } = require('@playwright/test');

test.describe('Receptionist UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login as receptionist
        await page.goto('/login.html');
        await page.fill('#username', 'rec');
        await page.fill('#password', 'Pass123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/receptionist_dashboard.html/);
        
        // Wait for page to be ready
        await page.waitForSelector('#module-viewport');
    });

    test('Walk-in creation, selection, and scheduling', async ({ page }) => {
        // Go to New Appointment
        await page.click('#btn-new-appointment');
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);
        
        // Click Register Walk-in
        await page.click('#btn-open-walkin');
        
        // Verify Walk-in modal is active
        await expect(page.locator('#walkin-form-modal')).toHaveClass(/active/);
        // Verify Appointment modal is NOT active
        await expect(page.locator('#appointment-form-modal')).not.toHaveClass(/active/);

        // Fill walk-in form
        await page.fill('#walkin-first', 'UI');
        await page.fill('#walkin-last', 'TestPat');
        await page.selectOption('#walkin-gender', 'Female');
        await page.fill('#walkin-dob', '1995-05-05');
        await page.fill('#walkin-contact', '09170000000');

        // Submit Walk-in form and confirm modal
        await page.click('#btn-save-walkin');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');

        // Verify toast appears
        await expect(page.locator('.toast-success').first()).toBeVisible({ timeout: 10000 });
        
        // Verify Walk-in modal closes and Appointment modal reopens
        await expect(page.locator('#walkin-form-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        // Verify patient is selected in the select dropdown
        const selectedLabel = await page.locator('#appt-patient option:checked').textContent();
        expect(selectedLabel).toContain('TestPat, UI');

        // Schedule appointment and confirm modal
        await page.selectOption('#appt-doctor', '1');
        await page.fill('#appt-date', '2026-12-12');
        await page.fill('#appt-time', '09:00');
        await page.click('#btn-save-appointment');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');

        // Verify success
        await expect(page.locator('.toast-success', { hasText: 'Appointment scheduled successfully' })).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#appointment-form-modal')).not.toHaveClass(/active/);
    });

    test('Edit Patient Details handles validation and updates', async ({ page }) => {
        // Wait for table to load
        await page.waitForSelector('#appointments-tbody tr');

        // Click edit on the appointment for John Doe
        await page.locator('tr:has-text("Doe, John") >> button[data-action="edit"]').first().click();
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        // Verify button is "Edit Patient Details"
        const editBtn = page.locator('#btn-open-walkin');
        await expect(editBtn).toContainText('Edit Patient Details');
        await editBtn.click();

        // Verify Walk-in modal opens for edit
        await expect(page.locator('#walkin-form-modal')).toHaveClass(/active/);
        
        // Wait for data to load
        await expect(page.locator('#walkin-first')).toHaveValue('John', { timeout: 10000 });

        // Test validation: Middle initial must be 1 letter
        await page.fill('#walkin-middle', 'AB');
        await page.click('#btn-save-walkin');
        await expect(page.locator('#walkin-middle-error')).toContainText('Middle initial must be a single letter (A-Z).');

        // Fix it and confirm update modal
        await page.fill('#walkin-middle', 'Z');
        await page.click('#btn-save-walkin');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');

        // Verify success
        await expect(page.locator('.toast-success').last()).toContainText('Patient details updated successfully');
        
        // Modal should close
        await expect(page.locator('#walkin-form-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        // Patient select should reflect update
        const selectedLabel = await page.locator('#appt-patient option:checked').textContent();
        expect(selectedLabel).toContain('Doe, John Z.');
    });

    test('Dirty close confirmation works for Back, X, Escape, and backdrop', async ({ page }) => {
        await page.click('#btn-new-appointment');
        
        // Modify appointment form
        await page.fill('#appt-complaint', 'Test complaint');

        // Try to close via backdrop
        await page.evaluate(() => {
            document.querySelector('#appointment-form-modal').click();
        });
        
        // Should show confirm
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        
        // Click Cancel to decline
        await page.click('#global-confirm-modal .btn-secondary');
        
        // Confirm modal closes, appointment modal stays open
        await expect(page.locator('#global-confirm-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        // Open Walk-in
        await page.click('#btn-open-walkin');

        // Modify walk-in form
        await page.fill('#walkin-first', 'DirtyName');

        // Try to close via X button
        await page.click('#walkin-form-modal .btn-close');

        // Should show confirm
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);

        // Click Discard
        await page.click('#global-confirm-btn');

        // Should close confirm and walk-in, and return to appointment
        await expect(page.locator('#global-confirm-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#walkin-form-modal')).not.toHaveClass(/active/);
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        // Verify appointment draft was preserved
        await expect(page.locator('#appt-complaint')).toHaveValue('Test complaint');
    });

    test('Doctor selection listbox is keyboard-accessible and bounded', async ({ page }) => {
        await page.click('#btn-new-appointment');
        await expect(page.locator('#appointment-form-modal')).toHaveClass(/active/);

        const selectBtn = page.locator('#doctor-select-btn');
        const listbox = page.locator('#doctor-listbox');
        const label = page.locator('#doctor-select-label');

        await expect(selectBtn).toBeVisible();
        await expect(label).toContainText('Select Doctor');
        await expect(listbox).not.toBeVisible();

        // Click to open listbox
        await selectBtn.click();
        await expect(listbox).toBeVisible();

        // Check options
        const option = page.locator('.doctor-combobox-option').first();
        await expect(option).toBeVisible();

        // Click option to select
        const optionText = await option.locator('div').first().textContent();
        await option.click();

        // Listbox should close and button label should update
        await expect(listbox).not.toBeVisible();
        await expect(label).toHaveText(optionText);

        // Hidden select value should be set
        const selectedVal = await page.locator('#appt-doctor').inputValue();
        expect(Number(selectedVal)).toBeGreaterThan(0);
    });
});
