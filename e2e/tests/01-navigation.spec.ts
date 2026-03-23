import { expect, test } from '../fixtures';

/**
 * 01 — Navigation
 *
 * Covers: page.goto, waitForURL, toHaveURL, goBack/goForward/reload,
 * waitForLoadState, URL query params, deep links, redirects,
 * and goto options (waitUntil).
 */

test.describe('Page navigation basics', () => {
  test('loads the home page and shows the heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/Product Catalog/);
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
  });

  test('page.goto with waitUntil option', async ({ page }) => {
    // waitUntil:'networkidle' waits until no network requests for 500ms.
    // Use sparingly — it can be slow. Prefer waiting for a specific element.
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('products-page')).toBeVisible();
  });

  test('waitForLoadState: domcontentloaded vs load vs networkidle', async ({ page }) => {
    await page.goto('/');
    // domcontentloaded: HTML parsed, scripts not yet executed
    // load: all resources (images, CSS) loaded
    // networkidle: no pending network requests for 500ms
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load');
    // Tip: always prefer waiting for a specific element over waitForLoadState
    await expect(page.getByTestId('products-page')).toBeVisible();
  });

  test('navigates to add product page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-product-btn').click();
    await page.waitForURL('/products/new');
    await expect(page).toHaveURL('/products/new');
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();
  });

  test('deep link: navigate directly to edit page', async ({ page, createdProduct }) => {
    // Deep linking tests that a URL works without requiring UI navigation.
    // Important: can only edit if logged in (storageState provides auth).
    await page.goto(`/products/${createdProduct.id}/edit`);
    await expect(page).toHaveURL(`/products/${createdProduct.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();
  });

  test('browser back and forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-product-btn').click();
    await page.waitForURL('/products/new');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/products/new');
  });

  test('page reload preserves the current page', async ({ page }) => {
    await page.goto('/products/new');
    await page.reload();
    await expect(page).toHaveURL('/products/new');
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();
  });
});

test.describe('URL query parameters', () => {
  test('search query is reflected in the URL', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await page.getByTestId('search-input').fill('Laptop');
    // Wait for debounce (300ms) + URL update
    await page.waitForURL(/\?q=Laptop/);
    await expect(page).toHaveURL(/q=Laptop/);
  });

  test('URL with query params pre-filters the list', async ({ page }) => {
    // Navigate directly with a category filter in the URL
    await page.goto('/?category=Electronics');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Only Electronics products should be visible
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(1);
  });
});

test.describe('Protected routes', () => {
  test('unauthenticated user is redirected to /login when accessing protected page', async ({ browser }) => {
    // Create a context with NO storageState — simulates a logged-out user
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/products/new');
    // The form page redirects to /login when not authenticated
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');

    await context.close();
  });
});
