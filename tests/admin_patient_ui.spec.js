const { test, expect } = require('@playwright/test');

test.describe('Admin Patient Management UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto('/login.html');
        await page.fill('#username', 'admin');
        await page.fill('#password', 'Pass123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/admin_dashboard.html/);
        
        // Wait for page to be ready and navigate to patients module
        await page.waitForSelector('#module-viewport');
        await page.click('button[data-module="patients"]');
        await page.waitForSelector('#patients-table-body');
    });

    test('Middle initial input constraints and inline validation', async ({ page }) => {
        // Open Add Patient modal
        await page.click('#btn-add-patient');
        await expect(page.locator('#patient-form-modal')).toHaveClass(/active/);

        const miInput = page.locator('#patient-middle-initial');
        const miError = page.locator('#patient-middle-initial-error');

        // Check maxlength attribute is 1
        await expect(miInput).toHaveAttribute('maxlength', '1');

        // Force multi-letter or invalid input to test JS validation
        await page.evaluate(() => {
            const input = document.querySelector('#patient-middle-initial');
            input.removeAttribute('maxlength');
            input.value = 'XYZ';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Verify real-time validation error appears
        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Attempt submit, verify blocked by inline validation before submission
        await page.click('#btn-save-patient');
        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Correct to a single valid letter
        await miInput.fill('B');
        await page.evaluate(() => {
            document.querySelector('#patient-middle-initial').dispatchEvent(new Event('input', { bubbles: true }));
        });
        await expect(miInput).not.toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('');

        // Close modal (dirty check prompts confirmation)
        await page.click('#patient-form-modal [data-close-modal]');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');
        await expect(page.locator('#patient-form-modal')).not.toHaveClass(/active/);
    });
});
