import { test as base } from '@playwright/test';
import { createProduct, deleteProduct, type Product, type ProductDto } from '../helpers/api';
import { LoginPage } from '../pages/LoginPage';
import { ProductFormPage } from '../pages/ProductFormPage';
import { ProductsPage } from '../pages/ProductsPage';

/**
 * CUSTOM FIXTURES
 *
 *  — Fixtures vs beforeEach/afterEach:
 *
 * Traditional approach (DON'T):
 *   let productId: string;
 *   beforeEach(async () => { productId = await createProduct(...); });
 *   afterEach(async () => { await deleteProduct(productId); });
 *
 * Fixture approach (DO):
 *   test('my test', async ({ createdProduct }) => {
 *     // product is pre-created, will be auto-deleted after test completes
 *   });
 *
 * Why fixtures are better:
 * 1. COMPOSABLE: fixtures can depend on other fixtures
 * 2. AUTO-TEARDOWN: cleanup runs even if the test throws (no try/finally needed)
 * 3. SCOPED: can be test-scoped (default) or worker-scoped (shared)
 * 4. NAMED: self-documenting, tests declare what they need
 * 5. REUSABLE: defined once, used in any test that needs it
 *
 * The `await use(value)` pattern:
 *   - Code BEFORE `use` = setup (runs before the test)
 *   - Code AFTER `use` = teardown (runs after the test, even on failure)
 */

interface CustomFixtures {
  /** Pre-instantiated ProductsPage POM */
  productsPage: ProductsPage;
  /** Pre-instantiated ProductFormPage POM */
  productFormPage: ProductFormPage;
  /** Pre-instantiated LoginPage POM */
  loginPage: LoginPage;
  /** A product created via API before the test. Auto-deleted after the test. */
  createdProduct: Product;
}

export const test = base.extend<CustomFixtures>({
  // Fixture: provides a pre-instantiated POM
  // No setup/teardown needed — just wraps `new ProductsPage(page)`
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },

  productFormPage: async ({ page }, use) => {
    await use(new ProductFormPage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  /**
   *  — The createdProduct fixture:
   *
   * This creates a product via the API (not the UI) before the test runs,
   * hands it to the test, then deletes it afterward.
   *
   * Usage in a test:
   *   test('deletes a product', async ({ page, productsPage, createdProduct }) => {
   *     await productsPage.goto();
   *     await productsPage.deleteProduct(createdProduct.id);
   *     await expect(productsPage.productRow(createdProduct.id)).not.toBeAttached();
   *   });
   *
   * Why create via API and not through the UI?
   * - FAST: no browser overhead
   * - ISOLATED: test doesn't depend on the create form working correctly
   * - EXPLICIT: the test's intent (deleting) isn't polluted with setup steps
   *
   * The Date.now() suffix ensures unique names across parallel workers.
   */
  createdProduct: async ({}, use) => {
    const dto: ProductDto = {
      name: `Test Product ${Date.now()}`,
      category: 'Test',
      description: 'Created by fixture for test isolation',
      price: 99.99,
    };

    const product = await createProduct(dto);

    // Hand the product to the test — test body runs here
    await use(product);

    // TEARDOWN: always runs, even if the test fails or throws.
    // .catch(() => {}) prevents teardown failure from masking the test failure.
    await deleteProduct(product.id).catch(() => {});
  },
});

// Re-export expect so tests can import both from a single place
export { expect } from '@playwright/test';
