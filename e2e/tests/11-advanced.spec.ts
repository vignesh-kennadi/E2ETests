import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures';
import { test as base } from '@playwright/test';
import { resetProductStore, seedProducts, SEED_PRODUCTS } from '../helpers/api';

/**
 * 11 — Advanced Features
 *
 * Covers: multi-tab, multi-user contexts, dialogs, file download,
 * page.evaluate, page.exposeFunction, parameterized tests (for..of),
 * custom expect matchers, visual regression, mobile viewport,
 * test annotations (tag, skip, fixme, slow), performance timing,
 * page.pause (debugging), soft assertions recap.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tab
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Multi-tab', () => {
  test('open a link in a new tab and interact with it', async ({ page, context }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // : Use context.waitForEvent('page') to capture tabs opened by link clicks.
    // For <a target="_blank"> links, Ctrl/Cmd+click opens a new tab:
    //   const newPagePromise = context.waitForEvent('page');
    //   await page.getByRole('link', { name: 'External docs' }).click({ modifiers: ['Meta'] });
    //   const newTab = await newPagePromise;
    //
    // Our Add Product button uses React Router navigate() (not <a href>), so
    // Cmd+click just navigates the current tab instead of opening a new one.
    // We demonstrate the multi-tab pattern by opening a new page programmatically:
    const newPage = await context.newPage();
    await newPage.goto('/login');
    await newPage.waitForLoadState();

    await expect(newPage).toHaveURL('/login');
    await expect(newPage.getByTestId('login-page')).toBeVisible();

    // Original page is unchanged — still on the home route
    await expect(page).toHaveURL('/');

    await newPage.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-user contexts
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Multi-user contexts', () => {
  test('two browser contexts: authenticated admin + guest visitor', async ({ browser }) => {
    // Admin context (loaded with auth state)
    const adminContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const adminPage = await adminContext.newPage();

    // Guest context (no auth)
    const guestContext = await browser.newContext({ storageState: undefined });
    const guestPage = await guestContext.newPage();

    // Navigate both pages concurrently — reduces the window for a parallel store reset
    // to change the product list between the two page loads.
    const adminResponsePromise = adminPage.waitForResponse('**/api/products');
    const guestResponsePromise = guestPage.waitForResponse('**/api/products');
    await Promise.all([adminPage.goto('/'), guestPage.goto('/')]);
    const adminProducts = await (await adminResponsePromise).json();
    const guestProducts = await (await guestResponsePromise).json();

    await adminPage.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await guestPage.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Admin sees management controls
    await expect(adminPage.getByTestId('add-product-btn')).toBeVisible();

    // Guest sees products but no admin controls
    await expect(guestPage.getByTestId('add-product-btn')).not.toBeAttached();
    await expect(guestPage.getByTestId('login-link')).toBeVisible();

    // Both contexts hit the same public API — their response sizes must match
    expect(adminProducts.length).toBe(guestProducts.length);

    await adminContext.close();
    await guestContext.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// page.evaluate: run JavaScript in the browser
// ─────────────────────────────────────────────────────────────────────────────

test.describe('page.evaluate', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test('execute JavaScript in the browser context', async ({ page }) => {
    // Capture the API response so the expected count matches what the page renders —
    // parallel tests may add products, so we sync with the actual server state.
    const responsePromise = page.waitForResponse('**/api/products');
    await page.goto('/');
    const apiProducts = await (await responsePromise).json();
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Run JS inside the browser — returns serialisable values to Node.js
    const productCount = await page.evaluate(() =>
      document.querySelectorAll('[data-testid^="product-row-"]').length
    );
    expect(productCount).toBe(apiProducts.length);

    // Read document title
    const title = await page.evaluate(() => document.title);
    expect(title).toContain('Product Catalog');
  });

  test('pass data into evaluate', async ({ page }) => {
    await page.goto('/');

    // Pass a value from Node.js into the browser function
    const key = 'auth_token';
    const token = await page.evaluate((k) => localStorage.getItem(k), key);
    expect(token).toBe('demo-static-token-12345');
  });

  test('page.evaluate for performance timing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    const timing = await page.evaluate(() => ({
      // Time from navigation start to DOMContentLoaded
      domContentLoaded:
        performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      // Time from navigation start to page load
      load: performance.timing.loadEventEnd - performance.timing.navigationStart,
    }));

    console.log(`DOM: ${timing.domContentLoaded}ms, Load: ${timing.load}ms`);
    // Assert the page loads within 5 seconds (generous for a dev server)
    expect(timing.load).toBeLessThan(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parameterized tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Parameterized / data-driven tests', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  /**
   * :
   * Use a for..of loop to generate tests from an array of cases.
   * Each iteration creates a separate test with a descriptive name.
   * Playwright also supports test.describe.each() for tables.
   */
  const filterCases = [
    { category: 'Electronics', expectedCount: 1 },
    { category: 'Furniture', expectedCount: 1 },
    { category: 'Appliances', expectedCount: 1 },
    { category: 'All', expectedCount: 3 },
  ];

  for (const { category, expectedCount } of filterCases) {
    test(`filtering by "${category}" shows ${expectedCount} product(s)`, async ({ page }) => {
      // waitForResponse ensures products are fully loaded before applying the filter —
      // guards against the loading-indicator hiding while the fetch is still in-flight.
      const responsePromise = page.waitForResponse('**/api/products');
      await page.goto('/');
      await responsePromise;
      await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
      await page.getByTestId('category-filter').selectOption(category);
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(expectedCount);
    });
  }

  // Parameterized with multiple input variants
  const formValidationCases = [
    { name: '', category: 'Test', price: '10', expectedError: 'Name is required' },
    { name: 'Product', category: '', price: '10', expectedError: 'Category is required' },
    { name: 'Product', category: 'Test', price: '-1', expectedError: 'non-negative' },
  ];

  for (const { name, category, price, expectedError } of formValidationCases) {
    test(`form validation: "${expectedError}"`, async ({ page }) => {
      await page.goto('/products/new');
      if (name) await page.getByTestId('field-name').fill(name);
      if (category) await page.getByTestId('field-category').fill(category);
      if (price) await page.getByTestId('field-price').fill(price);
      await page.getByTestId('submit-product-form').click();
      await expect(page.getByTestId('form-error')).toContainText(expectedError);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom expect matchers
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Custom expect matchers', () => {
  // Extend expect with a custom matcher
  expect.extend({
    toBeFormattedCurrency(received: string) {
      const pass = /^\$[\d,]+\.\d{2}$/.test(received);
      return {
        pass,
        message: () => pass
          ? `Expected "${received}" NOT to be formatted as currency`
          : `Expected "${received}" to be formatted as currency like $1,299.99`,
      };
    },
  });

  test('price is formatted as currency', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Get the price text from the first product row
    const priceCell = page.getByRole('cell', { name: /\$\d/ }).first();
    const priceText = await priceCell.textContent() ?? '';

    // Use the custom matcher
    (expect(priceText) as unknown as { toBeFormattedCurrency: () => void }).toBeFormattedCurrency();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mobile viewport
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mobile viewport', () => {
  test('products page renders on mobile viewport', async ({ page }) => {
    // Change viewport mid-test to simulate mobile
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12 dimensions
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Page should still be functional at mobile size
    await expect(page.getByTestId('products-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test annotations: tags, skip, fixme, slow
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Test annotations', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test(
    'tagged as @smoke — runs in quick smoke test suite',
    { tag: '@smoke' },
    async ({ page }) => {
      // Run only smoke tests: npx playwright test --grep @smoke
      await page.goto('/');
      await expect(page.getByTestId('products-page')).toBeVisible();
    }
  );

  test(
    'tagged as @slow — excluded from quick runs',
    { tag: '@slow' },
    async ({ page }) => {
      test.slow(); // triples the default timeout for this test
      // Exclude slow tests: npx playwright test --grep-invert @slow
      await page.goto('/');
      await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(3);
    }
  );

  test('conditionally skip based on environment', async ({ page }) => {
    // Skip this test when running in CI (example: test needs a live OAuth provider)
    test.skip(false, 'Example: skip when external service unavailable');
    await page.goto('/');
    await expect(page.getByTestId('products-page')).toBeVisible();
  });

  test.fixme('known broken: price should show currency symbol (TODO: fix #123)', async ({ page }) => {
    // test.fixme marks a test as "expected to fail" — won't fail the build
    // Use when you know a test is broken and want to track it without hiding it
    await page.goto('/');
    await expect(page.getByText('$999999')).toBeVisible(); // this would fail
  });

  test(
    'with issue annotation: links the test to a bug tracker',
    {
      annotation: {
        type: 'issue',
        description: 'https://github.com/your-org/product-catalog/issues/42',
      },
    },
    async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('products-page')).toBeVisible();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Visual regression (screenshot comparison)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Visual regression (screenshot comparison)', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test('products page matches visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // First run: creates the snapshot file in e2e/tests/__snapshots__/
    // Subsequent runs: compares against the saved snapshot
    // Update snapshots: npx playwright test --update-snapshots
    await expect(page).toHaveScreenshot('products-page.png', {
      maxDiffPixels: 200, // allow small pixel differences (anti-aliasing etc.)
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Soft assertions (recap)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Soft assertions (full example)', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test('collect multiple failures before failing the test', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // All soft assertions are collected — test continues even if one fails.
    // At the end of the test, all failures are reported together.
    await expect.soft(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
    await expect.soft(page.getByTestId('product-count')).toContainText('3');
    await expect.soft(page.getByTestId('add-product-btn')).toBeVisible();
    await expect.soft(page.getByTestId('search-input')).toBeVisible();
    await expect.soft(page.getByTestId('category-filter')).toBeVisible();

    // Regular assertion after soft ones — this one stops the test if it fails
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(3);
  });
});
