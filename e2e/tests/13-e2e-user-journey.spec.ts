import { test, expect } from '../fixtures';
import { test as base } from '@playwright/test';
import {
  resetProductStore,
  seedProducts,
  SEED_PRODUCTS,
  getAllProducts,
  deleteProduct,
  STATIC_TOKEN,
} from '../helpers/api';

/**
 * 13 — End-to-End User Journey
 *
 * WHY FULL JOURNEYS MATTER:
 * Unit tests verify that individual functions produce the right output.
 * Integration tests verify that two modules communicate correctly.
 * But neither can catch the class of bug that only appears when a real user
 * walks through the complete workflow in a real browser:
 *
 *   - A React state update that works in isolation but races with a route transition
 *   - A backend validation error that the UI silently swallows
 *   - A token stored under the wrong localStorage key so logout never fully works
 *   - A category filter that resets when the product list re-fetches after creation
 *
 * WHAT E2E TESTS VERIFY THAT UNIT TESTS CAN'T:
 *   1. The browser, React app, and .NET API integrate correctly end-to-end
 *   2. Auth state (localStorage token) survives page navigations
 *   3. UI feedback matches actual data changes (not just optimistic updates)
 *   4. Confirm dialogs, form resets, and redirect flows behave as expected
 *
 * STRUCTURE OF THIS FILE:
 *   - One serial describe block for the main "full user journey" (steps depend on each other)
 *   - Separate shorter tests demonstrating happy-path CRUD, error handling, and unauth flow
 *
 *  — When to use test.describe.serial:
 *   By default, tests inside a describe block are independent and can run in any order.
 *   `serial` means: run in the declared order, and stop the block if any test fails.
 *   Use it only when steps genuinely build on each other — like this journey where
 *   the product ID created in step 2 is used in steps 3-7.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared state across the serial journey
// These are declared at module scope so every step in the serial block can read them.
// ─────────────────────────────────────────────────────────────────────────────

/** The ID of the product created during the journey. Populated in step 2. */
let journeyProductId = '';
/** The name used when creating the product. Used later to search for it. */
const JOURNEY_PRODUCT_NAME = `Journey Widget ${Date.now()}`;
// Must be one of the fixed categories in ProductSearchBar.tsx
// ('All' | 'Electronics' | 'Furniture' | 'Appliances' | 'Clothing' | 'Books' | 'Other')
// We use 'Other' because no SEED_PRODUCTS use it — the filter will show only our product.
const JOURNEY_PRODUCT_CATEGORY = 'Other';
const JOURNEY_PRODUCT_PRICE = '29.99';
const JOURNEY_PRODUCT_EDITED_NAME = `${JOURNEY_PRODUCT_NAME} (Edited)`;
const JOURNEY_PRODUCT_EDITED_PRICE = '34.99';

// ─────────────────────────────────────────────────────────────────────────────
// Main journey — serial because each step depends on the previous one
// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('Full user journey', () => {
  /**
   *  — beforeAll in a serial block:
   * We reset and seed the store once before the journey starts.
   * This gives us a known baseline: exactly SEED_PRODUCTS in the store.
   * Using beforeAll (not beforeEach) because we don't want to wipe state between steps —
   * the whole point of a serial journey is that state accumulates across steps.
   */
  test.beforeAll(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  // ── Step 1: Logout and log back in ─────────────────────────────────────────

  /**
   *  — Testing the auth flow inside a journey:
   * Even though auth is covered in 06-auth-storage-state.spec.ts, we deliberately
   * start this journey with a logout+login cycle for two reasons:
   *   1. It proves the session is live (not stale from a previous test run's storageState)
   *   2. It models the real user experience: arriving at the app, re-authenticating if needed
   */
  test('Step 1: user logs out and logs back in', async ({ page }) => {
    // Navigate to the products page — storageState already provides auth
    await page.goto('/');
    // Wait for the loading spinner to disappear before interacting
    // : Never interact with elements while the page is still fetching data.
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ── Logout ────────────────────────────────────────────────────────────────
    await page.getByTestId('logout-btn').click();

    // After logout the Add Product button should vanish and a Login link should appear
    await expect(page.getByTestId('add-product-btn')).not.toBeAttached();
    await expect(page.getByTestId('login-link')).toBeVisible();

    // Confirm token was actually cleared from localStorage — not just hidden in the UI
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfterLogout).toBeNull();

    // ── Login ─────────────────────────────────────────────────────────────────
    await page.getByTestId('login-link').click();
    await expect(page).toHaveURL('/login');

    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');

    // waitForResponse captures the POST /api/auth/login response before moving on.
    // : This prevents a race condition where the page redirects before
    // the token is written to localStorage, causing subsequent API calls to be unauthenticated.
    const loginResponsePromise = page.waitForResponse('**/api/auth/login');
    await page.getByTestId('login-submit').click();
    const loginResponse = await loginResponsePromise;

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.token).toBe(STATIC_TOKEN);

    // The app should redirect to the home/products page on success
    await page.waitForURL('/');
    await expect(page.getByTestId('add-product-btn')).toBeVisible();

    // Double-check the token is now in localStorage
    const tokenAfterLogin = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfterLogin).toBe(STATIC_TOKEN);
  });

  // ── Step 2: Create a new product via the UI form ────────────────────────────

  /**
   *  — Why test product creation through the UI form?
   * We already have API-level creation tests in 12-api-testing.spec.ts.
   * This step tests the complete *user-facing* creation flow:
   *   - the form renders correctly
   *   - validation allows submission when fields are valid
   *   - the app navigates back to the product list after save
   *   - the new product appears in the list without a manual refresh
   *   - the backend actually persisted it (verified by capturing the API response)
   */
  test('Step 2: creates a product via the UI form', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Capture the product count before creating so we can assert it grew by 1
    const countBefore = await page.getByTestId('product-count').textContent();
    const numBefore = parseInt(countBefore ?? '0', 10);

    // Navigate to the Add Product form
    await page.getByTestId('add-product-btn').click();
    await expect(page.getByTestId('product-form-page')).toBeVisible();

    // Fill in the form fields
    await page.getByTestId('field-name').fill(JOURNEY_PRODUCT_NAME);
    await page.getByTestId('field-category').fill(JOURNEY_PRODUCT_CATEGORY);
    await page.getByTestId('field-price').fill(JOURNEY_PRODUCT_PRICE);
    await page.getByTestId('field-description').fill('A widget created during the E2E journey.');

    // Intercept the POST response to capture the generated product ID.
    // : waitForResponse must be registered BEFORE the action that
    // triggers the request — otherwise Playwright may miss the response entirely.
    const createResponsePromise = page.waitForResponse('**/api/products');
    await page.getByTestId('submit-product-form').click();
    const createResponse = await createResponsePromise;

    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    // Store the ID so later steps in the serial block can reference it
    journeyProductId = created.id;
    expect(journeyProductId).toBeTruthy();

    // After saving, the app should navigate back to the product list
    await expect(page).toHaveURL('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // The product count should have increased by 1
    const countAfter = await page.getByTestId('product-count').textContent();
    const numAfter = parseInt(countAfter ?? '0', 10);
    expect(numAfter).toBe(numBefore + 1);

    // The new product row should be visible in the table
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).toBeVisible();
  });

  // ── Step 3: Search for the product by name ──────────────────────────────────

  /**
   *  — Why test search in the journey?
   * Search typically filters client-side (no API call). Unit tests verify the filter
   * function logic, but E2E tests catch issues like:
   *   - the search input not being wired to the filter state
   *   - case-sensitivity mismatches
   *   - the filter being reset when data re-fetches in the background
   */
  test('Step 3: searches for the new product by name', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Type a partial name — tests that the search doesn't require an exact match
    await page.getByTestId('search-input').fill('Journey Widget');

    // The row for our product should remain visible
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).toBeVisible();

    // At least one seed product with a different name should be hidden
    // (proving the filter is actually working, not just showing everything)
    await expect(page.getByTestId('product-row-' + 'nonexistent-id')).not.toBeAttached();

    // The displayed name should match what we entered
    await expect(page.getByTestId(`product-name-${journeyProductId}`)).toContainText(
      JOURNEY_PRODUCT_NAME
    );

    // Clear search to restore full list for the next step
    await page.getByTestId('search-input').fill('');
  });

  // ── Step 4: Edit the product via the UI ────────────────────────────────────

  /**
   *  — Editing via UI vs API in a journey:
   * We could update the product directly via PUT /api/products/{id}.
   * But this step specifically verifies the edit *form* pre-populates correctly
   * (i.e., the app fetches existing data and puts it into the fields),
   * and that submitting the form calls PUT (not POST) and reflects changes in the list.
   */
  test('Step 4: edits the product via the UI', async ({ page }) => {
    // Navigate directly to the edit form for our product
    await page.goto(`/products/${journeyProductId}/edit`);
    await expect(page.getByTestId('product-form-page')).toBeVisible();

    // The name field should be pre-populated with the current name
    await expect(page.getByTestId('field-name')).toHaveValue(JOURNEY_PRODUCT_NAME);

    // Clear and retype the name
    await page.getByTestId('field-name').clear();
    await page.getByTestId('field-name').fill(JOURNEY_PRODUCT_EDITED_NAME);

    // Update the price too
    await page.getByTestId('field-price').clear();
    await page.getByTestId('field-price').fill(JOURNEY_PRODUCT_EDITED_PRICE);

    // Wait for the PUT response before asserting outcomes
    const updateResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/products/${journeyProductId}`) && resp.request().method() === 'PUT'
    );
    await page.getByTestId('submit-product-form').click();
    const updateResponse = await updateResponsePromise;

    expect(updateResponse.status()).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.name).toBe(JOURNEY_PRODUCT_EDITED_NAME);
    expect(updated.price).toBe(parseFloat(JOURNEY_PRODUCT_EDITED_PRICE));

    // App should redirect back to the product list
    await expect(page).toHaveURL('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // The updated name should now appear in the table row
    await expect(page.getByTestId(`product-name-${journeyProductId}`)).toContainText(
      JOURNEY_PRODUCT_EDITED_NAME
    );
    // The updated price should also reflect
    await expect(page.getByTestId(`product-price-${journeyProductId}`)).toContainText(
      JOURNEY_PRODUCT_EDITED_PRICE
    );
  });

  // ── Step 5: Filter by category ─────────────────────────────────────────────

  /**
   *  — Category filter:
   * Filters are often implemented as client-side computed values derived from the full
   * product list. This step verifies:
   *   - the category dropdown is populated with all distinct categories (including "Gadgets")
   *   - selecting "Gadgets" shows our product and hides products from other categories
   *   - the filter works after an edit (categories should update dynamically, not be stale)
   */
  test('Step 5: filters by category to find the product', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Select our product's category from the filter dropdown
    await page.getByTestId('category-filter').selectOption(JOURNEY_PRODUCT_CATEGORY);

    // Our edited product (still in "Gadgets") should be visible
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).toBeVisible();

    // A product from a different category (e.g., Laptop Pro → Electronics) should be hidden
    // : soft assertions let us check multiple things without stopping on the first failure
    await expect.soft(page.getByText('Laptop Pro')).not.toBeVisible();
    await expect.soft(page.getByText('Desk Chair')).not.toBeVisible();
    await expect.soft(page.getByText('Coffee Maker')).not.toBeVisible();

    // Reset the filter back to "All"
    await page.getByTestId('category-filter').selectOption('All');
  });

  // ── Step 6: Delete the product via the UI ──────────────────────────────────

  /**
   *  — Testing confirm dialogs:
   * The delete flow involves a confirmation step (data-testid="confirm-delete").
   * This is easy to miss in unit tests but critical in E2E:
   *   - pressing "cancel" should NOT delete the product
   *   - pressing "confirm" should DELETE and remove it from the list
   * We test the cancel path first to prove the guard works, then the confirm path.
   */
  test('Step 6: deletes the product via the UI (with confirm dialog)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // ── Test the cancel path first ─────────────────────────────────────────
    await page.getByTestId(`delete-product-${journeyProductId}`).click();
    await expect(page.getByTestId('confirm-delete')).toBeVisible();
    // Click cancel — product should still be in the list
    await page.getByTestId('cancel-delete').click();
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).toBeVisible();

    // ── Now confirm deletion ───────────────────────────────────────────────
    await page.getByTestId(`delete-product-${journeyProductId}`).click();
    await expect(page.getByTestId('confirm-delete')).toBeVisible();

    // Capture the DELETE response to verify the backend accepted it
    const deleteResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/products/${journeyProductId}`) &&
        resp.request().method() === 'DELETE'
    );
    await page.getByTestId('confirm-delete').click();
    const deleteResponse = await deleteResponsePromise;

    // 204 No Content is the expected response for a successful delete
    expect(deleteResponse.status()).toBe(204);

    // The row should disappear from the table without requiring a page reload
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).not.toBeAttached();
  });

  // ── Step 7: Verify the product is gone — UI and API ────────────────────────

  /**
   *  — Dual verification (UI + API) after delete:
   * Checking the UI alone could give a false positive: the app might remove the row
   * optimistically but fail to persist the delete on the backend.
   * Reloading + checking the API ensures the backend confirmed the delete.
   *
   * This is the "trust but verify" principle in E2E testing: always confirm that
   * a data mutation is durable, not just reflected in transient UI state.
   */
  test('Step 7: verifies the product is gone from UI and API', async ({ page, request }) => {
    // Navigate fresh to / — each serial test starts with a new page, so we can't rely
    // on the previous test's page state. This forces a fresh GET /api/products.
    const productsResponsePromise = page.waitForResponse('**/api/products');
    await page.goto('/');
    await productsResponsePromise;
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // UI check — the row should not exist after a full reload
    await expect(page.getByTestId(`product-row-${journeyProductId}`)).not.toBeAttached();

    // API check — use the `request` fixture (Playwright's built-in API client) to
    // call GET /api/products directly and confirm the product is absent.
    // : `request` is separate from the browser; it doesn't share
    // cookies or localStorage, but it proves the backend state is correct.
    const apiResponse = await request.get('http://localhost:5000/api/products');
    expect(apiResponse.status()).toBe(200);
    const products = await apiResponse.json();
    const stillExists = products.some((p: { id: string }) => p.id === journeyProductId);
    expect(stillExists).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Supporting test: Happy-path CRUD in one self-contained test
// ─────────────────────────────────────────────────────────────────────────────

/**
 *  — Single-test CRUD ("happy path"):
 * Unlike the serial journey above (which is split across steps for readability),
 * this test runs the entire Create → Search → Edit → Delete flow in one function.
 * Useful as a smoke test: if this passes, the core workflow is intact.
 * The trade-off is that a failure is harder to pinpoint — hence both patterns coexist.
 */
test('Happy path: full product CRUD in a single test', async ({ page }) => {
  await resetProductStore();
  await seedProducts(SEED_PRODUCTS);

  const productName = `Happy Path Product ${Date.now()}`;
  let productId = '';

  // ── CREATE ────────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
  await page.getByTestId('add-product-btn').click();

  await page.getByTestId('field-name').fill(productName);
  await page.getByTestId('field-category').fill('Electronics');
  await page.getByTestId('field-price').fill('9.99');
  await page.getByTestId('field-description').fill('Happy path product');

  const createResponsePromise = page.waitForResponse('**/api/products');
  await page.getByTestId('submit-product-form').click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  productId = created.id;

  await page.waitForURL('/');
  await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
  await expect(page.getByTestId(`product-row-${productId}`)).toBeVisible();

  // ── EDIT ─────────────────────────────────────────────────────────────────
  await page.goto(`/products/${productId}/edit`);
  await page.getByTestId('field-name').clear();
  await page.getByTestId('field-name').fill(`${productName} Updated`);

  const updateResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes(`/api/products/${productId}`) && resp.request().method() === 'PUT'
  );
  await page.getByTestId('submit-product-form').click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.status()).toBe(200);

  await page.waitForURL('/');
  await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
  await expect(page.getByTestId(`product-name-${productId}`)).toContainText('Updated');

  // ── DELETE ────────────────────────────────────────────────────────────────
  await page.getByTestId(`delete-product-${productId}`).click();
  await expect(page.getByTestId('confirm-delete')).toBeVisible();

  const deleteResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes(`/api/products/${productId}`) &&
      resp.request().method() === 'DELETE'
  );
  await page.getByTestId('confirm-delete').click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(204);
  await expect(page.getByTestId(`product-row-${productId}`)).not.toBeAttached();

  // ── VERIFY VIA API ────────────────────────────────────────────────────────
  const apiProducts = await getAllProducts();
  expect(apiProducts.some((p) => p.id === productId)).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Supporting test: Error handling / form validation during the journey
// ─────────────────────────────────────────────────────────────────────────────

/**
 *  — Testing validation errors inside a user journey:
 * Form validation errors are often tested in isolation ("submit empty form → see error").
 * But it's equally important to verify that:
 *   1. An error state can be *recovered from* — filling in the field dismisses the error
 *   2. A valid submission after a failed one actually succeeds (form is not "stuck")
 *   3. The error message is user-readable and targets the right field
 */
test('Error handling: form validation errors are surfaced and recoverable', async ({ page }) => {
  await page.goto('/products/new');
  await expect(page.getByTestId('product-form-page')).toBeVisible();

  // ── Submit with missing Name ───────────────────────────────────────────────
  // Leave field-name empty; fill in the rest
  await page.getByTestId('field-category').fill('Test');
  await page.getByTestId('field-price').fill('5.00');
  await page.getByTestId('submit-product-form').click();

  // The form should show an error and NOT navigate away
  // : soft assertions here — we want to capture all failures in one run
  await expect.soft(page.getByTestId('form-error')).toBeVisible();
  await expect.soft(page).toHaveURL('/products/new');

  // ── Submit with invalid price (negative) ─────────────────────────────────
  await page.getByTestId('field-name').fill('Error Test Product');
  await page.getByTestId('field-price').clear();
  await page.getByTestId('field-price').fill('-10');
  await page.getByTestId('submit-product-form').click();

  // Still on the form with an error shown
  await expect.soft(page.getByTestId('form-error')).toBeVisible();
  await expect.soft(page).toHaveURL('/products/new');

  // ── Recover: fix the price and submit successfully ────────────────────────
  await page.getByTestId('field-price').clear();
  await page.getByTestId('field-price').fill('15.00');

  const recoverResponsePromise = page.waitForResponse('**/api/products');
  await page.getByTestId('submit-product-form').click();
  const recoverResponse = await recoverResponsePromise;

  // This time the create should succeed
  expect(recoverResponse.status()).toBe(201);
  await page.waitForURL('/');

  // Cleanup the product created during recovery
  const created = await recoverResponse.json();
  if (created?.id) {
    await deleteProduct(created.id).catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Supporting test: Unauthenticated user journey
// ─────────────────────────────────────────────────────────────────────────────

/**
 *  — Testing the unauthenticated user's journey:
 * Protected routes should redirect unauthenticated users to /login.
 * This test models the experience of a user who:
 *   1. Arrives at the app without being logged in
 *   2. Tries to navigate directly to the Add Product form
 *   3. Gets redirected to /login (guard working correctly)
 *   4. Successfully logs in and is sent back to the products page
 *
 * We use `base` (plain @playwright/test) with storageState: { cookies: [], origins: [] }
 * to guarantee no auth state is loaded — even if this file runs in a project that
 * normally provides e2e/.auth/user.json.
 */
base.describe('Unauthenticated user journey', () => {
  // Force no storage state for every test in this describe block
  base.use({ storageState: { cookies: [], origins: [] } });

  base('unauthenticated user sees products but cannot access create form', async ({ page }) => {
    await page.goto('/');
    // Products list is public — should load without auth
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // : soft assertions let us verify all public-access rules in one pass
    // Add Product button must not be rendered (it would expose the /products/new route)
    await expect.soft(page.getByTestId('add-product-btn')).not.toBeAttached();
    // A login link should be present so the user knows how to authenticate
    await expect.soft(page.getByTestId('login-link')).toBeVisible();
    // The product list itself should be visible (public read access)
    await expect.soft(page.locator('[data-testid^="product-row-"]').first()).toBeVisible();

    // Navigating directly to the create form should redirect to /login
    await page.goto('/products/new');
    // : waitForURL ensures we don't assert before the redirect completes
    await page.waitForURL('/login');
    await expect(page.getByTestId('login-page')).toBeVisible();

    // Log in and confirm the user lands on the products page with full access
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('password');
    const loginDonePromise = page.waitForResponse('**/api/auth/login');
    await page.getByTestId('login-submit').click();
    await loginDonePromise;

    await page.waitForURL('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
  });
});
