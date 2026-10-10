const { test, expect } = require('@playwright/test');

test.describe('Doctor Dashboard & Appointments UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login.html');
        await page.fill('#username', 'doc');
        await page.fill('#password', 'Pass123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/doctor_dashboard.html/);
        
        await page.waitForSelector('#module-viewport');
    });

    test('Dashboard counts reflect today versus other dates and status', async ({ page }) => {
        await page.waitForSelector('#overview-stats > div');

        // Based on seed data, today has 3 appointments:
        // 1 scheduled, 1 confirmed, 1 completed.
        // Pending is scheduled + confirmed = 2.
        await expect(page.locator('#overview-stats > div:nth-child(1) > div:first-child')).toHaveText('3');
        await expect(page.locator('#overview-stats > div:nth-child(2) > div:first-child')).toHaveText('2');
    });

    test('Doctor Appointments table displays pagination and gated consultation actions', async ({ page }) => {
        // Navigate to My Appointments
        await page.click('button[data-module="doctor_appointments"]');
        await page.waitForSelector('#appointments-table');

        // Check pagination controls
        const pagWrapper = page.locator('#doctor-appointments-pagination');
        await expect(pagWrapper).toBeVisible();
        await expect(pagWrapper).toContainText('Showing');
        await expect(pagWrapper).toContainText('appointments');

        // Check page size selector
        const pageSizeSelect = page.locator('#doctor-page-size');
        await expect(pageSizeSelect).toBeVisible();

        // Check rows in table
        await page.waitForSelector('#appointments-tbody tr');
        const rows = page.locator('#appointments-tbody tr');
        await expect(rows.first()).toBeVisible();

        // Check scheduled appointment has "Awaiting Confirmation" and no Start Consult button
        const scheduledRow = page.locator('#appointments-tbody tr', { hasText: 'SCHEDULED' }).first();
        if (await scheduledRow.count() > 0) {
            await expect(scheduledRow).toContainText('Awaiting Confirmation');
            await expect(scheduledRow.locator('.btn-start-consult')).toHaveCount(0);
        }

        // Check confirmed appointment has "Start Consult" button
        const confirmedRow = page.locator('#appointments-tbody tr', { hasText: 'CONFIRMED' }).first();
        if (await confirmedRow.count() > 0) {
            const startBtn = confirmedRow.locator('.btn-start-consult');
            await expect(startBtn).toBeVisible();
            await expect(startBtn).toContainText('Start Consult');
        }

        // Check completed appointment has "View Encounter" button
        const completedRow = page.locator('#appointments-tbody tr', { hasText: 'COMPLETED' }).first();
        if (await completedRow.count() > 0) {
            const viewBtn = completedRow.locator('.btn-start-consult');
            await expect(viewBtn).toBeVisible();
            await expect(viewBtn).toContainText('View Encounter');
        }
    });

    test('Patient Records view demonstrates accumulated medical history with diagnoses', async ({ page }) => {
        // Navigate to Patient Records
        await page.click('button[data-module="doctor_patients"]');
        await page.waitForSelector('#patients-tbody');

        // Check patient John Doe is in table
        const row = page.locator('#patients-tbody tr', { hasText: 'Doe, John' }).first();
        await expect(row).toBeVisible();

        // Click "View Record"
        const viewRecBtn = row.locator('.btn-view-record');
        await expect(viewRecBtn).toBeVisible();
        await viewRecBtn.click();

        // Medical record view displays
        await page.waitForSelector('#patient-record-view');
        await expect(page.locator('#patient-record-view')).toContainText('Encounter History');
        await expect(page.locator('#patient-record-view')).toContainText('John');
        await expect(page.locator('#patient-record-view')).toContainText('Doe');

        // Check accumulated consultation encounter and diagnosis
        await expect(page.locator('#timeline-container')).toContainText('Fatigue');
        await expect(page.locator('#timeline-container')).toContainText('Routine checkup');

        // Check Back to List returns to patient list
        await page.click('#btn-back-to-list');
        await expect(page.locator('#patients-list-view')).toBeVisible();
    });
});

