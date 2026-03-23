import { expect, test } from '../fixtures';
import { resetProductStore, seedProducts, SEED_PRODUCTS } from '../helpers/api';

/**
 * 07 — Page Object Model (POM)
 *
 * This file shows the SAME tests written two ways:
 *   1. Without POM — raw Playwright, all locators inline
 *   2. With POM — using ProductsPage and ProductFormPage from e2e/pages/
 *
 * Compare them side by side to understand WHY POM improves maintainability.
 *
 * NOTE: The entire file is wrapped in test.describe.serial so each group
 * of tests runs sequentially. This prevents the beforeEach store resets
 * from racing with tests in the other describe blocks.
 */

test.describe.serial('07 — Page Object Model', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // WITHOUT POM — verbose, brittle, hard to read
  // (These tests work but represent the approach you should AVOID in real projects)
  // ─────────────────────────────────────────────────────────────────────────────

  test.describe('Without POM (for comparison only)', () => {
    test.beforeEach(async () => {
      await resetProductStore();
      await seedProducts(SEED_PRODUCTS);
    });

    test('creates a product — no POM', async ({ page }) => {
      // Capture count before — resilient to parallel product creation by other tests
      await page.goto('/');
      await page.locator('[data-testid="loading-indicator"]').waitFor({ state: 'hidden' });
      const countBefore = await page.locator('[data-testid^="product-row-"]').count();

      // Every step is raw Playwright — locators are scattered throughout the test
      await page.goto('/products/new');
      await page.locator('[data-testid="field-name"]').fill('Raw Playwright Product');
      await page.locator('[data-testid="field-category"]').fill('Test');
      await page.locator('[data-testid="field-price"]').fill('199.99');
      await page.locator('[data-testid="submit-product-form"]').click();
      await page.waitForURL('/');
      // If data-testid ever changes, you update it in EVERY test that uses it
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(countBefore + 1);
    });

    test('deletes a product — no POM', async ({ page }) => {
      // Navigate first, then read the product ID from the DOM — avoids races
      // where a parallel reset removes the product between getAllProducts() and the click
      await page.goto('/');
      await page.locator('[data-testid="loading-indicator"]').waitFor({ state: 'hidden' });
      const firstRow = page.locator('[data-testid^="product-row-"]').first();
      const rowTestId = await firstRow.getAttribute('data-testid');
      const targetId = rowTestId!.replace('product-row-', '');
      await page.locator(`[data-testid="delete-product-${targetId}"]`).click();
      // Dialog open
      await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
      await page.locator('[data-testid="confirm-delete"]').click();
      await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
      await expect(page.locator(`[data-testid="product-row-${targetId}"]`)).not.toBeAttached();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WITH POM — clean, readable, maintainable
  // ─────────────────────────────────────────────────────────────────────────────

  test.describe('With POM (recommended)', () => {
    test.beforeEach(async () => {
      await resetProductStore();
      await seedProducts(SEED_PRODUCTS);
    });

    test('creates a product — with POM', async ({ productsPage, productFormPage, page }) => {
      // Capture count before — resilient to parallel product creation by other tests
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();
      const countBefore = await productsPage.productRows.count();

      // Actions are named after user intent — reads like a user story
      await productFormPage.gotoCreate();
      await productFormPage.fillAndSubmit({
        name: 'POM Product',
        category: 'Test',
        price: 199.99,
      });
      await page.waitForURL('/');
      // POM abstracts away the data-testid — change it in one place (ProductsPage.ts)
      await expect(productsPage.productRows).toHaveCount(countBefore + 1);
    });

    test('deletes a product — with POM', async ({ productsPage }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();
      // Read product ID from DOM — avoids races where a parallel reset removes the product
      const rowTestId = await productsPage.productRows.first().getAttribute('data-testid');
      const targetId = rowTestId!.replace('product-row-', '');
      // Single method call replaces: click delete, wait for dialog, click confirm, wait to close
      await productsPage.deleteProduct(targetId);
      // Reload to get fresh server state — guards against the case where a concurrent
      // reset already removed the product (backend 404) and the UI cached the old list.
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();
      await expect(productsPage.productRow(targetId)).not.toBeAttached();
    });

    test('edits a product — with POM', async ({ productsPage, productFormPage, page }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();
      const countBefore = await productsPage.productRows.count();
      const rowTestId = await productsPage.productRows.first().getAttribute('data-testid');
      const targetId = rowTestId!.replace('product-row-', '');
      await productFormPage.gotoEdit(targetId);
      // Form is pre-filled — just change what we want
      await productFormPage.fillAndSubmit({ name: 'Updated via POM' });
      await page.waitForURL('/');
      // Count unchanged — edit doesn't add/remove products
      await expect(productsPage.productRows).toHaveCount(countBefore);
    });

    test('cancel deletes — with POM', async ({ productsPage }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();

      const rowTestId = await productsPage.productRows.first().getAttribute('data-testid');
      const targetId = rowTestId!.replace('product-row-', '');
      const countBefore = await productsPage.productRows.count();
      await productsPage.cancelDelete(targetId);
      // Product should still be there
      await expect(productsPage.productRows).toHaveCount(countBefore);
      await expect(productsPage.productRow(targetId)).toBeAttached();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POM DESIGN PATTERNS — advanced usage
  // ─────────────────────────────────────────────────────────────────────────────

  test.describe('POM design patterns', () => {
    test.beforeEach(async () => {
      await resetProductStore();
      await seedProducts(SEED_PRODUCTS);
    });

    test('lazy getters prevent stale locator issues', async ({ page, productsPage }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();

      // The productRows getter is evaluated EACH TIME it is accessed.
      // Even if the DOM changes between accesses, you always get a fresh locator.
      const countBefore = await productsPage.productRows.count();

      // Navigate away and come back
      await page.goto('/products/new');
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();

      // productRows getter re-evaluates — no stale handle
      await expect(productsPage.productRows).toHaveCount(countBefore);
    });

    test('POMs do NOT contain assertions — they return locators', async ({ productsPage }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();

      // ✅ CORRECT: assertion in the test, locator comes from POM
      await expect(productsPage.heading).toBeVisible();
      await expect(productsPage.productRows).toHaveCount(3);
      await expect(productsPage.emptyState).not.toBeAttached();

      // ❌ WRONG would be: await productsPage.assertHeadingIsVisible();
      // POMs should not know about test expectations — that's the test's job.
    });

    test('POM search and category filter', async ({ productsPage }) => {
      await productsPage.goto();
      await productsPage.waitForProductsLoaded();

      await productsPage.filterByCategory('Electronics');
      await expect(productsPage.productRows).toHaveCount(1);

      // Reset filter
      await productsPage.filterByCategory('All');
      await expect(productsPage.productRows).toHaveCount(3);
    });
  });
});
