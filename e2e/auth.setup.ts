import { expect, test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = 'e2e/.auth/user.json';

/**
 * AUTH SETUP — runs once, before any browser project that lists 'setup' as a dependency.
 *
 * : storageState
 * Instead of logging in before every test (slow, fragile), we log in ONCE here,
 * save the browser's localStorage + cookies to a JSON file, and all test projects
 * load that file via `storageState: 'e2e/.auth/user.json'` in playwright.config.ts.
 *
 * The tests start already authenticated — no login screen in every test.
 * This is the official Playwright recommended pattern for auth.
 */
setup('authenticate as admin', async ({ page }) => {
  // Ensure the .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto('/login');

  // Fill credentials using getByTestId — matches data-testid attributes in LoginPage.tsx
  await page.getByTestId('login-username').fill('admin');
  await page.getByTestId('login-password').fill('password');
  await page.getByTestId('login-submit').click();

  // Wait for successful redirect to home page
  await page.waitForURL('/');

  // Verify we're logged in (belt-and-suspenders)
  await expect(page.getByTestId('add-product-btn')).toBeVisible();

  // Save browser storage state (localStorage + cookies) to file.
  // All browser projects load this file → no login per test.
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`✅ Auth state saved to ${AUTH_FILE}`);
});
