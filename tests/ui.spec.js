const { test, expect } = require('@playwright/test');

test('Simple page load', async ({ page }) => {
    console.log('Playwright test is running!');
    expect(1).toBe(1);
});
