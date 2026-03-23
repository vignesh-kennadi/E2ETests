import { test as base, expect, type Page } from '@playwright/test';
import { test, expect as customExpect } from '../fixtures';
import { createProduct, deleteProduct, resetProductStore, seedProducts, SEED_PRODUCTS } from '../helpers/api';

/**
 * 08 — Fixtures
 *
 * Covers: built-in fixtures, custom fixtures, setup/teardown lifecycle,
 * fixture composability, worker-scoped fixtures, request fixture for API calls,
 * beforeAll vs worker-scoped fixture comparison.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Built-in fixtures
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Built-in Playwright fixtures', () => {
  test('page: the most common fixture — a browser page', async ({ page }) => {
    // `page` is provided automatically by Playwright. Each test gets its own page.
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('context: the browser context (multiple pages can share it)', async ({ context }) => {
    // A browser context is like an incognito window — isolated from other contexts.
    // You can open multiple pages within the same context, and they share cookies/localStorage.
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/login');

    // Both pages are in the same context — changes to localStorage in page1 affect page2
    await expect(page1.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
    await expect(page2.getByTestId('login-page')).toBeVisible();

    await page1.close();
    await page2.close();
  });

  test('browser: the browser instance (parent of context)', async ({ browser }) => {
    // Create a fresh context with specific options
    const freshContext = await browser.newContext({
      // No storageState = simulates a logged-out user
      storageState: undefined,
      // Specific viewport
      viewport: { width: 1280, height: 720 },
    });
    const page = await freshContext.newPage();

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // No auth — login link shows instead of Add Product
    await expect(page.getByTestId('login-link')).toBeVisible();

    await freshContext.close();
  });

  test('request: make API calls without a browser page', async ({ request }) => {
    // The `request` fixture gives you an APIRequestContext — a lightweight HTTP client.
    // Perfect for setup, teardown, or verifying backend state without rendering a UI.
    const response = await request.get('http://localhost:5000/api/products');
    expect(response.ok()).toBeTruthy();
    const products = await response.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom fixtures
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Custom fixture: createdProduct', () => {
  test('receives a pre-created product via fixture', async ({ createdProduct }) => {
    // The fixture created a product via API before this test ran.
    // The product is available as an object with all fields.
    expect(createdProduct.id).toBeTruthy();
    expect(createdProduct.name).toContain('Test Product');
    expect(createdProduct.price).toBe(99.99);
  });

  test('product fixture is auto-deleted after test', async ({ createdProduct }) => {
    // After this test completes (even if it fails), the fixture's teardown runs
    // and deletes the product via API. No manual cleanup needed.
    expect(createdProduct.id).toBeTruthy();
    // The cleanup happens after the test — you can verify by checking the API
    // in the NEXT test (the product won't exist).
  });

  test('each test gets its own independent product', async ({ createdProduct: p1, page }) => {
    // createdProduct uses Date.now() in the name, so each test gets a unique product.
    // This prevents tests from interfering with each other in parallel execution.
    expect(p1.name).toMatch(/Test Product \d+/);
  });
});

test.describe('Custom fixture: POM fixtures', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test('productsPage fixture provides a pre-instantiated POM', async ({ productsPage, page }) => {
    // The POM is created by the fixture — no `new ProductsPage(page)` in the test.
    // Use waitForResponse to sync the expected count with what the page renders —
    // resilient to parallel tests that may add products concurrently.
    const responsePromise = page.waitForResponse('**/api/products');
    await productsPage.goto();
    const response = await responsePromise;
    const products = await response.json();
    await productsPage.waitForProductsLoaded();
    await customExpect(productsPage.productRows).toHaveCount(products.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Worker-scoped fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 *  — Fixture scopes:
 *
 * Default scope ('test'): fixture is created/destroyed for EACH test.
 * Worker scope ('worker'): fixture is created once and shared across ALL tests in a worker.
 *
 * Use worker-scoped fixtures for expensive setup that doesn't need to be isolated:
 * - Database connections
 * - Auth tokens that don't change
 * - Compiled test data
 *
 * CAUTION: worker-scoped fixtures CAN cause shared state issues if tests mutate them.
 */
const workerScopedTest = base.extend<
  object,
  { workerProducts: { id: string; name: string }[] }
>({
  workerProducts: [
    async ({}, use) => {
      // This setup runs ONCE per worker, not once per test
      const p1 = await createProduct({ name: `Worker Product ${Date.now()}`, category: 'Test', price: 1 });
      const p2 = await createProduct({ name: `Worker Product ${Date.now() + 1}`, category: 'Test', price: 2 });

      await use([p1, p2]);

      // Teardown: runs once when the worker finishes (after all tests in this worker)
      await deleteProduct(p1.id).catch(() => {});
      await deleteProduct(p2.id).catch(() => {});
    },
    { scope: 'worker' },
  ],
});

workerScopedTest.describe('Worker-scoped fixture', () => {
  workerScopedTest('test 1: both worker products exist', async ({ workerProducts }) => {
    expect(workerProducts).toHaveLength(2);
  });

  workerScopedTest('test 2: same worker products (not recreated)', async ({ workerProducts }) => {
    // The SAME objects as test 1 — created once for the worker
    expect(workerProducts[0].name).toContain('Worker Product');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// beforeAll vs fixture comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * : beforeAll vs worker-scoped fixtures
 *
 * beforeAll runs once before all tests in a describe block.
 * Worker-scoped fixtures run once per worker (see workerResource fixture above).
 *
 * For most cases, PREFER fixtures — they're more composable and have auto-teardown.
 * Use beforeAll only when you specifically need describe-level scoping, e.g.:
 *
 *   test.describe('serial tests', () => {
 *     let productId: string;
 *     test.beforeAll(async () => {
 *       const p = await createProduct({ name: 'Shared', ... });
 *       productId = p.id;
 *     });
 *     test.afterAll(async () => deleteProduct(productId).catch(() => {}));
 *
 *     test('step 1', async () => { ... uses productId ... });
 *     test('step 2', async () => { ... uses productId ... });
 *   });
 *
 * NOTE: In a shared in-memory backend, beforeAll products can be deleted by parallel
 * resets in other tests. Use the serial describe pattern from 09-parallel-isolation
 * to protect them.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Override built-in fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 *  — Overriding built-in fixtures:
 * You can extend the built-in `page` fixture to add behavior to every test.
 * Example: automatically navigate to / before every test in this suite.
 */
const homePageTest = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.goto('/');   // always start at home
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await use(page);        // run the test
    // No teardown needed — page is closed automatically
  },
});

homePageTest.describe('Overriding built-in page fixture', () => {
  homePageTest('starts at the products page automatically', async ({ page }) => {
    // No need to call page.goto('/') — the overridden fixture did it
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('products-page')).toBeVisible();
  });
});
