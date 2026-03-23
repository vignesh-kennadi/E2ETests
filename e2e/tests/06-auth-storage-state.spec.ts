import { expect, test } from '../fixtures';
import { test as noAuthTest } from '@playwright/test';

/**
 * 06 — Authentication & Storage State
 *
 * Covers: storageState, login/logout flows, protected routes,
 * per-test unauthenticated context, cookie inspection.
 *
 *  — The storageState pattern:
 *
 * BAD approach: log in before every test
 *   beforeEach(async ({ page }) => {
 *     await page.goto('/login');
 *     await page.fill('#username', 'admin');
 *     await page.fill('#password', 'password');
 *     await page.click('button[type=submit]');
 *   });
 *   // Problem: slow (adds 2-5s per test), fragile (depends on login working)
 *
 * GOOD approach: log in once in auth.setup.ts, save storageState to file.
 * Tests start already authenticated. Login is tested only in auth-specific tests.
 *
 * The storageState file (e2e/.auth/user.json) contains:
 * - localStorage entries (auth token in our app)
 * - Cookies (if the app uses them)
 * All tests in projects with storageState: 'e2e/.auth/user.json' load this state.
 */

test.describe('Authenticated state', () => {
  test('authenticated user sees Add Product button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // storageState provides auth — Add Product button should be visible
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
    await expect(page.getByText('Logged in as')).toBeVisible();
  });

  test('authenticated user can access product form', async ({ page }) => {
    await page.goto('/products/new');
    // No redirect — form loads directly
    await expect(page.getByTestId('product-form-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();
  });

  test('logout clears auth and hides protected UI', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    await page.getByTestId('logout-btn').click();

    // After logout, the Add Product button should be gone
    await expect(page.getByTestId('add-product-btn')).not.toBeAttached();
    await expect(page.getByTestId('login-link')).toBeVisible();

    // Verify localStorage was cleared
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeNull();
  });
});

noAuthTest.describe('Unauthenticated state', () => {
  // Override storageState to ensure tests run unauthenticated even in the
  // chromium project (which normally loads e2e/.auth/user.json).
  noAuthTest.use({ storageState: { cookies: [], origins: [] } });

  noAuthTest('login page shows credentials hint', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-page')).toBeVisible();
    await expect(page.getByText('admin')).toBeVisible();
  });

  noAuthTest('wrong credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText('Invalid');
  });

  noAuthTest('correct credentials redirect to home', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
  });

  noAuthTest('protected route redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/products/new');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Per-test unauthenticated context', () => {
  test('create fresh unauthenticated context within an authenticated test file', async ({ browser }) => {
    // When you need to test the unauthenticated state from within an auth test file,
    // create a new browser context with no storageState.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Products are visible (public), but Add Product is not.
    // We check ≥ 1 product is shown (exact count varies in parallel test runs).
    await expect(page.locator('[data-testid^="product-row-"]').first()).toBeVisible();
    await expect(page.getByTestId('add-product-btn')).not.toBeAttached();

    await context.close();
  });
});

test.describe('Storage state inspection', () => {
  test('verify auth token is in localStorage', async ({ page }) => {
    await page.goto('/');

    // page.evaluate executes JavaScript inside the browser — powerful for inspecting state
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBe('demo-static-token-12345');
  });

  test('inspect and clear cookies', async ({ page, context }) => {
    await page.goto('/');

    // List all cookies for the current context
    const cookies = await context.cookies();
    // Our app uses localStorage (not cookies) for auth, so cookies may be empty
    expect(Array.isArray(cookies)).toBe(true);

    // Clear all cookies
    await context.clearCookies();
    const afterClear = await context.cookies();
    expect(afterClear).toHaveLength(0);
  });
});
