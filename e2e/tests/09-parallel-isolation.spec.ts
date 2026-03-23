import { test as base, expect } from '@playwright/test';
import { test } from '../fixtures';
import { createProduct, deleteProduct, getAllProducts } from '../helpers/api';

/**
 * 09 — Parallel Execution & Test Isolation
 *
 * Covers: fullyParallel, test independence, unique test data,
 * test.describe.serial, workerIndex, parallel pitfalls.
 *
 * :
 * With fullyParallel: true, Playwright runs tests in parallel across workers.
 * Each test runs in its own browser context — no shared browser state.
 * But if two tests write to the SAME backend data, they can conflict.
 *
 * Rule: every test that creates/modifies/deletes data must use its OWN data.
 * Never rely on specific data created by a previous test.
 */

test.describe('Test isolation fundamentals', () => {
  test('each test gets its own browser context (no shared cookies/localStorage)', async ({ context }) => {
    // The storageState loads auth into this context — but it's a COPY, not shared.
    // Changes in this test's context don't affect other tests.
    const cookies = await context.cookies();
    // Modify cookies — only this test is affected
    await context.addCookies([{ name: 'test-cookie', value: 'test-value', domain: 'localhost', path: '/' }]);
    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.length).toBeGreaterThan(cookies.length);
    // When this test ends, this context is destroyed — other tests are unaffected
  });

  test('using Date.now() ensures unique test data names', async ({ page }) => {
    // : when running in parallel, multiple tests may create products simultaneously.
    // Using Date.now() in the name ensures each test's product has a unique name.
    const uniqueName = `Test Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await page.goto('/products/new');
    await page.getByTestId('field-name').fill(uniqueName);
    await page.getByTestId('field-category').fill('Test');
    await page.getByTestId('field-price').fill('1.00');
    await page.getByTestId('submit-product-form').click();
    await page.waitForURL('/');

    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test('workerIndex: unique per-worker identifier', async ({}) => {
    // test.info().workerIndex is 0-based, unique for each parallel worker
    const workerIndex = test.info().workerIndex;
    expect(typeof workerIndex).toBe('number');
    expect(workerIndex).toBeGreaterThanOrEqual(0);
    // Use this to create worker-unique test data: `Product-${Date.now()}-w${workerIndex}`
  });
});

test.describe('What causes flaky parallel tests', () => {
  /**
   * ANTI-PATTERN: tests that depend on data from a previous test.
   * This is a common cause of flakiness in parallel suites.
   *
   * ❌ WRONG: test assumes "Laptop Pro" always exists at index 0
   *   const firstRow = page.getByRole('row').nth(1);
   *   await expect(firstRow).toContainText('Laptop Pro');
   *   // Fails when another test reorders or deletes products
   *
   * ✅ RIGHT: each test manages its own data
   */
  test('independent test: creates and deletes its own product', async ({ createdProduct, page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Verify OUR product exists (not assuming anything about other products)
    await expect(page.getByTestId(`product-row-${createdProduct.id}`)).toBeAttached();

    // Delete OUR product (fixture will also delete it in teardown, that's fine)
    await page.getByTestId(`delete-product-${createdProduct.id}`).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.getByTestId('confirm-delete').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    await expect(page.getByTestId(`product-row-${createdProduct.id}`)).not.toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// test.describe.serial — use as a LAST RESORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * : test.describe.serial
 *
 * By default, tests within a describe block can run in any order, in parallel.
 * test.describe.serial forces tests to run sequentially within the block.
 *
 * WHEN to use: when tests genuinely depend on each other's side effects
 * (rare — usually a sign your tests need better isolation).
 *
 * PROBLEMS with serial:
 * - If one test fails, ALL subsequent tests in the block are skipped
 * - Defeats the purpose of parallel testing
 * - Indicates shared mutable state (usually a design smell)
 *
 * PREFER: make each test independent using fixtures.
 */
test.describe.serial('serial tests: use ONLY when order matters', () => {
  let serialProductId: string;

  test.beforeAll(async () => {
    const product = await createProduct({
      name: `Serial Product ${Date.now()}`,
      category: 'Test',
      price: 1,
    });
    serialProductId = product.id;
  });

  test.afterAll(async () => {
    await deleteProduct(serialProductId).catch(() => {});
  });

  // Guard: if a parallel test's resetProductStore wiped our product between steps,
  // recreate it so subsequent steps can continue.
  test.beforeEach(async () => {
    const products = await getAllProducts();
    if (!products.find((p: { id: string }) => p.id === serialProductId)) {
      const product = await createProduct({
        name: `Serial Product ${Date.now()}`,
        category: 'Test',
        price: 1,
      });
      serialProductId = product.id;
    }
  });

  test('step 1: verify the product exists', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId(`product-row-${serialProductId}`)).toBeAttached();
  });

  test('step 2: edit the product (depends on step 1)', async ({ page }) => {
    await page.goto(`/products/${serialProductId}/edit`);
    await page.getByTestId('field-name').fill('Serial Product Updated');
    await page.getByTestId('submit-product-form').click();
    await page.waitForURL('/');
    await expect(page.getByText('Serial Product Updated')).toBeVisible();
  });

  test('step 3: delete the product (depends on step 2)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await page.getByTestId(`delete-product-${serialProductId}`).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.getByTestId('confirm-delete').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await expect(page.getByTestId(`product-row-${serialProductId}`)).not.toBeAttached();
  });
});
