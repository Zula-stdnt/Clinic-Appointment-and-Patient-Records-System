const { test, expect } = require('@playwright/test');

test.describe('Receptionist Appointments Pagination UI', () => {
    test.beforeEach(async ({ page }) => {
        // Login as receptionist
        await page.goto('/login.html');
        await page.fill('#username', 'rec');
        await page.fill('#password', 'Pass123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/receptionist_dashboard.html/);
        await page.waitForSelector('#module-viewport');
        await page.waitForSelector('#appointments-tbody tr');
    });

    test('Toolbar has page size selector and pagination controls display correctly', async ({ page }) => {
        const pageSizeSelect = page.locator('#appointments-page-size');
        await expect(pageSizeSelect).toBeVisible();

        const pagWrapper = page.locator('#appointments-pagination');
        await expect(pagWrapper).toBeVisible();

        // Check options 5, 10, 25 exist
        await expect(pageSizeSelect.locator('option[value="5"]')).toHaveCount(1);
        await expect(pageSizeSelect.locator('option[value="10"]')).toHaveCount(1);
        await expect(pageSizeSelect.locator('option[value="25"]')).toHaveCount(1);

        // Verify summary text appears
        await expect(pagWrapper).toContainText('Showing');
        await expect(pagWrapper).toContainText('appointments');

        // Test changing page size to 5
        await pageSizeSelect.selectOption('5');
        await expect(pagWrapper).toContainText('Showing 1 to');

        // Test status filtering resets to page 1
        const statusFilter = page.locator('#appointments-status-filter');
        await statusFilter.selectOption('scheduled');
        await expect(pagWrapper).toContainText('Page 1 of');

        // Test search filtering
        const searchInput = page.locator('#appointments-search');
        await searchInput.fill('NonExistentPatient123XYZ');
        await expect(page.locator('#appointments-tbody')).toContainText('No appointments found');
        await expect(pagWrapper).toContainText('No records');

        // Clear search
        await searchInput.fill('');
        await expect(page.locator('#appointments-tbody')).not.toContainText('No appointments found');
    });
});
