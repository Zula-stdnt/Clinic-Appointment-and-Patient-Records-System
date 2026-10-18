const { test, expect } = require('@playwright/test');

test.describe('Admin User and Doctor Middle Initial UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto('/login.html');
        await page.fill('#username', 'admin');
        await page.fill('#password', 'Pass123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/admin_dashboard.html/);
        await page.waitForSelector('#module-viewport');
    });

    test('Add User modal enforces single-letter middle initial', async ({ page }) => {
        // Navigate to Users module
        await page.click('button[data-module="users"]');
        await page.waitForSelector('#users-table-body');

        // Open Add User modal
        await page.click('#btn-add-user');
        await expect(page.locator('#user-form-modal')).toHaveClass(/active/);

        const miInput = page.locator('#user-middle-initial');
        const miError = page.locator('#user-middle-initial-error');

        // Check maxlength="1"
        await expect(miInput).toHaveAttribute('maxlength', '1');

        // Test JS validation by injecting multi-letter
        await page.evaluate(() => {
            const el = document.querySelector('#user-middle-initial');
            el.removeAttribute('maxlength');
            el.value = 'MULTI';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });

        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Submit attempt blocked
        await page.click('#btn-save-user');
        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Fix to valid single letter
        await miInput.fill('D');
        await page.evaluate(() => {
            document.querySelector('#user-middle-initial').dispatchEvent(new Event('input', { bubbles: true }));
        });
        await expect(miInput).not.toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('');

        // Close modal (dirty check prompts confirmation)
        await page.click('#user-form-modal [data-close-modal]');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');
        await expect(page.locator('#user-form-modal')).not.toHaveClass(/active/);
    });

    test('Add Doctor modal enforces single-letter middle initial', async ({ page }) => {
        // Navigate to Doctors module
        await page.click('button[data-module="doctors"]');
        await page.waitForSelector('#doctors-table-body');

        // Open Add Doctor modal
        await page.click('#btn-add-doctor');
        await expect(page.locator('#doctor-form-modal')).toHaveClass(/active/);

        const miInput = page.locator('#doctor-middle-initial');
        const miError = page.locator('#doctor-middle-initial-error');

        // Check maxlength="1"
        await expect(miInput).toHaveAttribute('maxlength', '1');

        // Test JS validation by injecting invalid non-letter
        await page.evaluate(() => {
            const el = document.querySelector('#doctor-middle-initial');
            el.removeAttribute('maxlength');
            el.value = '9';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });

        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Submit attempt blocked
        await page.click('#btn-save-doctor');
        await expect(miInput).toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('Middle initial must be a single letter (A-Z).');

        // Fix to valid single letter
        await miInput.fill('M');
        await page.evaluate(() => {
            document.querySelector('#doctor-middle-initial').dispatchEvent(new Event('input', { bubbles: true }));
        });
        await expect(miInput).not.toHaveClass(/is-invalid/);
        await expect(miError).toHaveText('');

        // Close modal (dirty check prompts confirmation)
        await page.click('#doctor-form-modal [data-close-modal]');
        await expect(page.locator('#global-confirm-modal')).toHaveClass(/active/);
        await page.click('#global-confirm-btn');
        await expect(page.locator('#doctor-form-modal')).not.toHaveClass(/active/);
    });
});
