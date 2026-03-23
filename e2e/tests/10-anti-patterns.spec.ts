import { test, expect } from '../fixtures';
import { test as base } from '@playwright/test';
import { getAllProducts } from '../helpers/api';

/**
 * 10 — Anti-Patterns
 *
 * Every pattern shows ❌ WRONG code (commented out) next to ✅ CORRECT code.
 * The tests pass using the correct approach. The wrong approach is shown in comments
 * so you can understand the mistake without it breaking the test run.
 *
 * These are the most common mistakes in Playwright tests — memorise them.
 */

test.describe('Anti-pattern #1: Sleeping instead of waiting', () => {
  test('✅ Use web-first assertions instead of waitForTimeout', async ({ page }) => {
    await page.goto('/');

    // ❌ WRONG: sleep and hope the element appears
    // await page.waitForTimeout(3000);
    // Problem: too short = flaky, too long = slow, and it ALWAYS waits even when unnecessary

    // ✅ CORRECT: wait for a meaningful condition — retries automatically, stops as soon as ready
    await expect(page.getByTestId('loading-indicator')).toBeHidden();
    await expect(page.getByTestId('products-page')).toBeVisible();
  });

  test('✅ Use waitForURL instead of sleeping after navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await page.getByTestId('add-product-btn').click();

    // ❌ WRONG: sleep after click hoping navigation completed
    // await page.waitForTimeout(1000);
    // await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();

    // ✅ CORRECT: wait for the URL change explicitly
    await page.waitForURL('/products/new');
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();
  });
});

test.describe('Anti-pattern #2: CSS class selectors', () => {
  test('✅ Use getByRole or getByTestId instead of CSS classes', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ❌ WRONG: CSS class — breaks when the UI library or class name changes
    // await page.locator('.product-list-item').first().click();
    // await page.locator('button.danger-btn').click();
    // await page.locator('.MuiButton-root').click();

    // ✅ CORRECT: stable identifiers that survive styling refactors
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Product' })).toBeVisible();
  });
});

test.describe('Anti-pattern #3: Positional selectors', () => {
  test('✅ Use named roles instead of hardcoded positions', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ❌ WRONG: position-based — breaks if order changes or new items are added
    // await page.locator('button').nth(2).click();
    // await page.locator('tr').nth(1).locator('button').first().click();

    // ✅ CORRECT: identify by what the element IS, not where it is
    const firstProductRow = page.locator('[data-testid^="product-row-"]').first();
    const editBtn = firstProductRow.getByTitle('Edit product');
    await expect(editBtn).toBeVisible();
  });
});

test.describe('Anti-pattern #4: Non-web-first assertions', () => {
  test('✅ Always use await expect(locator) not expect(await locator.method())', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ❌ WRONG: isVisible() runs ONCE — fails if element isn't ready yet
    // const visible = await page.locator('h1').isVisible();
    // expect(visible).toBe(true);   // NOT web-first — no retry

    // ❌ WRONG: textContent() runs once — fails on async content
    // const text = await page.locator('h1').textContent();
    // expect(text).toBe('Product Catalog');

    // ✅ CORRECT: web-first assertions retry automatically until the condition is met
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toHaveText('Product Catalog');
  });
});

test.describe('Anti-pattern #5: Setting up test data through the UI', () => {
  test('✅ Use API helpers for test data, not the UI', async ({ page, createdProduct }) => {
    // ❌ WRONG: creating test data through the UI
    // await page.goto('/products/new');
    // await page.getByTestId('field-name').fill('Product to Delete');
    // await page.getByTestId('field-category').fill('Test');
    // await page.getByTestId('field-price').fill('1.00');
    // await page.getByTestId('submit-product-form').click();
    // await page.waitForURL('/');
    // Problems:
    //   1. Slow (browser overhead + navigation)
    //   2. Test depends on the CREATE form working correctly
    //   3. If create is broken, delete test also fails — misleading failure

    // ✅ CORRECT: API-created product via fixture
    // The test is focused on what it actually tests (viewing it exists)
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId(`product-row-${createdProduct.id}`)).toBeAttached();
  });
});

test.describe('Anti-pattern #6: Over-asserting in one test', () => {
  test('✅ One logical concept per test', async ({ page }) => {
    // ❌ WRONG: asserting 10 different things in one test
    // When this test fails, which of the 10 things is broken?
    // await expect(page.getByRole('heading')).toHaveText('Product Catalog');
    // await expect(page.getByTestId('add-product-btn')).toBeVisible();
    // await expect(page.getByTestId('search-input')).toBeVisible();
    // await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(3);
    // await expect(page.getByText('Laptop Pro')).toBeVisible();
    // ... 5 more assertions ...

    // ✅ CORRECT: each test has a clear, single purpose
    // This test checks: does the products page UI match the backend data?
    // Use waitForResponse to capture the exact API payload the page renders from —
    // this keeps the assertion in sync even when parallel tests modify the store.
    const responsePromise = page.waitForResponse('**/api/products');
    await page.goto('/');
    const response = await responsePromise;
    const products = await response.json();
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(products.length);
  });

  test('✅ Separate test: page shows heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
  });

  test('✅ Separate test: add product button is visible when authenticated', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
  });
});

test.describe('Anti-pattern #7: test.only left in code', () => {
  // ❌ WRONG: test.only('this test', async () => { ... });
  // When test.only is committed, ALL OTHER TESTS stop running in CI.
  // This is prevented by: forbidOnly: !!process.env.CI in playwright.config.ts
  // That setting causes `npm test` in CI to fail immediately if .only is found.

  test('✅ Never commit test.only — use forbidOnly in CI config', async () => {
    // The playwright.config.ts has: forbidOnly: !!process.env.CI
    // This causes `npm test` in CI to fail if any test.only is present.
    expect(true).toBe(true); // just documenting the pattern
  });
});

test.describe('Anti-pattern #8: Shared state between tests', () => {
  // ❌ WRONG: shared mutable variable between tests
  // let sharedProductId: string;
  // test.beforeAll(async () => { sharedProductId = await createAndGetId(); });
  // test('test 1', async () => { /* uses sharedProductId */ });
  // test('test 2', async () => { /* deletes sharedProductId — test 1 now broken */ });

  // ✅ CORRECT: each test creates/destroys its own data via fixture
  test('test with independent data (via createdProduct fixture)', async ({ createdProduct }) => {
    expect(createdProduct.id).toBeTruthy();
    // This product is unique to THIS test. Other tests don't know about it.
  });
});

test.describe('Anti-pattern #9: waitForLoadState as a crutch', () => {
  test('✅ Wait for a specific element, not a vague load state', async ({ page }) => {
    await page.goto('/');

    // ❌ WRONG: waitForLoadState('networkidle') waits up to 30s for no network activity
    // Slow, brittle, and hides the real issue if an element is missing
    // await page.waitForLoadState('networkidle');

    // ✅ CORRECT: wait for the specific thing you care about
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Verify products loaded — exact count comes from the API to stay parallel-safe
    const products = await getAllProducts();
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(products.length);
  });
});

test.describe('Anti-pattern #10: Assertions inside Page Object Models', () => {
  test('✅ Keep assertions in test specs, not in POMs', async ({ page: _page, productsPage }) => {
    await productsPage.goto();
    await productsPage.waitForProductsLoaded();

    // ❌ WRONG: POMs with built-in assertions
    // await productsPage.assertProductsLoaded();        // POM contains expect() call
    // await productsPage.assertProductCountIs(3);       // POM contains expect() call
    // Problems:
    //   - Reduces flexibility (can't reuse POM in tests that expect different counts)
    //   - Makes test intent unclear (is this a navigation or a verification?)

    // ✅ CORRECT: assertion in the test, POM provides the locator
    const products = await getAllProducts();
    await expect(productsPage.productRows).toHaveCount(products.length); // assertion HERE
    await expect(productsPage.heading).toBeVisible();                    // assertion HERE
    await expect(productsPage.emptyState).not.toBeAttached();            // assertion HERE
  });
});

test.describe('Anti-pattern #11: XPath selectors', () => {
  test('✅ Use semantic locators instead of XPath', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ❌ WRONG: XPath is verbose, fragile, and hard to read
    // await page.locator('//button[@data-testid="add-product-btn"]').click();
    // await page.locator('//tr[contains(., "Laptop Pro")]//button').click();

    // ✅ CORRECT: semantic locators
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
    const laptopRow = page.getByRole('row', { name: /Laptop Pro/ });
    await expect(laptopRow).toBeVisible();
  });
});

test.describe('Anti-pattern #12: Overly nested describe blocks', () => {
  // ❌ WRONG: deeply nested describes make tests hard to find and name
  // test.describe('Products', () => {
  //   test.describe('Create', () => {
  //     test.describe('Validation', () => {
  //       test.describe('Name field', () => {
  //         test('shows error when empty', ...);
  //       });
  //     });
  //   });
  // });

  // ✅ CORRECT: flat structure, test names are self-documenting
  test('create product — shows error when name is empty', async ({ page }) => {
    await page.goto('/products/new');
    await page.getByTestId('field-category').fill('Test');
    await page.getByTestId('field-price').fill('10');
    // Intentionally leave name empty
    await page.getByTestId('submit-product-form').click();
    await expect(page.getByTestId('form-error')).toBeVisible();
  });
});
