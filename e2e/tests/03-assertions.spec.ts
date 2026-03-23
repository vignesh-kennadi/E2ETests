import { expect, test } from '../fixtures';

/**
 * 03 — Assertions
 *
 * CRITICAL CONCEPT: Web-first assertions
 *
 * Playwright's expect() assertions are "web-first" — they automatically retry
 * until the condition is true OR the timeout expires (default 5s).
 *
 * ❌ WRONG — not web-first, runs ONCE:
 *   const visible = await locator.isVisible();
 *   expect(visible).toBe(true);        // fails if element isn't visible YET
 *
 * ✅ RIGHT — web-first, retries automatically:
 *   await expect(locator).toBeVisible();  // retries until visible or timeout
 *
 * This is the #1 source of flaky Playwright tests — always use web-first assertions.
 */

test.describe('Visibility assertions', () => {
  test('toBeVisible — element is rendered and visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('products-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
  });

  test('toBeHidden — element is not visible (may still be in DOM)', async ({ page }) => {
    await page.goto('/');
    // Error message is hidden when there is no error
    await expect(page.getByTestId('error-message')).toBeHidden();
    // Loading indicator hidden after load
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId('loading-indicator')).toBeHidden();
  });

  test('toBeAttached — element is in the DOM (may be hidden)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Products page root is always attached
    await expect(page.getByTestId('products-page')).toBeAttached();
    // Error message may not be attached at all if it's conditionally rendered
    await expect(page.getByTestId('error-message')).not.toBeAttached();
  });
});

test.describe('Text assertions', () => {
  test('toHaveText — exact or partial text match', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toHaveText('Product Catalog');
  });

  test('toContainText — checks if text is present anywhere in element', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Product count says "3 products" — containsText is less strict
    await expect(page.getByTestId('product-count')).toContainText('3');
  });

  test('toHaveText with regex — flexible pattern matching', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Price is formatted as currency: $1,299.99
    await expect(page.getByRole('cell', { name: /\$1,299\.99/ })).toBeVisible();
  });
});

test.describe('Form state assertions', () => {
  test('toHaveValue — checks input field value', async ({ page }) => {
    await page.goto('/products/new');
    const nameInput = page.getByTestId('field-name');
    await nameInput.fill('Test Product');
    await expect(nameInput).toHaveValue('Test Product');
  });

  test('toBeEnabled / toBeDisabled — button state', async ({ page }) => {
    await page.goto('/products/new');
    // Submit button is enabled by default
    await expect(page.getByTestId('submit-product-form')).toBeEnabled();
    // After submitting (with loading=true), button becomes disabled
    // Demonstrated in 04-interactions.spec.ts
  });

  test('toBeFocused — element has focus', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').click();
    await expect(page.getByTestId('login-username')).toBeFocused();
  });

  test('toBeEmpty — input has no value', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page.getByTestId('field-name')).toBeEmpty();
    await expect(page.getByTestId('field-description')).toBeEmpty();
  });
});

test.describe('Page-level assertions', () => {
  test('toHaveURL — exact string', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('http://localhost:5173/');
  });

  test('toHaveURL — regex pattern', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page).toHaveURL(/\/products\/new/);
  });

  test('toHaveTitle — page <title> element', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Product Catalog/);
  });
});

test.describe('Count assertions', () => {
  test('toHaveCount — number of matching elements', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // 3 seeded products + 1 header row = 4 rows total
    await expect(page.getByRole('row')).toHaveCount(4);
    // 3 product rows (data rows only)
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(3);
  });
});

test.describe('Attribute assertions', () => {
  test('toHaveAttribute — checks an HTML attribute value', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // The search input has type="text"
    await expect(page.getByTestId('search-input')).toHaveAttribute('type', 'text');
    await expect(page.getByTestId('search-input')).toHaveAttribute('placeholder', 'Search products...');
  });

  test('toHaveClass — checks CSS class', async ({ page }) => {
    await page.goto('/');
    // Note: we rarely assert on classes (fragile) — asserting on state/role is better.
    // This is shown for completeness; use toHaveAttribute or role-based assertions when possible.
    await expect(page.locator('#root')).toBeAttached(); // just checks root exists
  });
});

test.describe('Soft assertions', () => {
  test('soft assertions collect ALL failures before failing the test', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // : soft assertions
    // Unlike regular assertions (which stop the test on first failure),
    // soft assertions let the test continue and report ALL failures together.
    //
    // Use when: you want a full picture of what's broken on a page in one run.
    // Don't overuse: too many soft assertions can make failure messages confusing.
    await expect.soft(page.getByRole('heading')).toHaveText('Product Catalog');
    await expect.soft(page.getByTestId('product-count')).toContainText('3');
    await expect.soft(page.getByTestId('add-product-btn')).toBeVisible();
    await expect.soft(page.getByTestId('search-input')).toBeVisible();
    // If any of the above fail, all failures are reported together at end of test
  });
});

test.describe('Custom assertion timeouts', () => {
  test('override assertion timeout for slow elements', async ({ page }) => {
    await page.goto('/');
    // Default expect timeout is 5s (set in playwright.config.ts).
    // Override per-assertion when you know something will be slow.
    await expect(page.getByTestId('products-page')).toBeVisible({ timeout: 15_000 });
  });

  test('expect.configure — change default timeout for a block', async ({ page }) => {
    await page.goto('/');
    // Create a configured expect with a custom timeout
    const slowExpect = expect.configure({ timeout: 10_000 });
    await slowExpect(page.getByTestId('products-page')).toBeVisible();
    // slowExpect only applies to calls made through it — not global
  });
});
