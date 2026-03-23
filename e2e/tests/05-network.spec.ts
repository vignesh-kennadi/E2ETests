import { expect, test } from '../fixtures';
import { resetProductStore, seedProducts, SEED_PRODUCTS } from '../helpers/api';

/**
 * 05 — Network Interception & Waiting
 *
 * Covers: waitForResponse, waitForRequest, route.fulfill, route.abort,
 * route.continue, route.fetch (proxy + mutate), selective interception,
 * slow network simulation, page.on(request/response), page.on(console/pageerror).
 *
 * : page.route() intercepts at the BROWSER network layer.
 * The backend is never called when a route is fulfilled/aborted.
 * This makes mocked tests:
 *   - Faster (no real network call)
 *   - More reliable (no server dependency)
 *   - Able to test states the real API rarely produces (500s, slow responses)
 */

const MOCK_PRODUCTS = [
  { id: '1', name: 'Mocked Laptop', category: 'Electronics', price: 999, description: '', sortOrder: 0, createdAt: new Date().toISOString() },
  { id: '2', name: 'Mocked Chair', category: 'Furniture', price: 199, description: '', sortOrder: 1, createdAt: new Date().toISOString() },
];

test.describe('Waiting for network activity', () => {
  test('waitForResponse: wait for a specific API call', async ({ page }) => {
    // Set up the listener BEFORE the action that triggers the request.
    // If you set it up after, the request may have already fired.
    const responsePromise = page.waitForResponse('**/api/products');

    await page.goto('/');

    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.url()).toContain('/api/products');

    const products = await response.json();
    expect(Array.isArray(products)).toBe(true);
  });

  test('waitForRequest: wait for and inspect outgoing request', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await page.getByTestId('add-product-btn').click();
    await page.getByTestId('field-name').fill('Test via Network');
    await page.getByTestId('field-category').fill('Electronics');
    await page.getByTestId('field-price').fill('49.99');

    // Intercept the POST request before clicking submit
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/products') && req.method() === 'POST'
    );

    await page.getByTestId('submit-product-form').click();

    const request = await requestPromise;
    const body = JSON.parse(request.postData() ?? '{}');
    expect(body.name).toBe('Test via Network');
    expect(body.price).toBe(49.99);
  });
});

test.describe('route.fulfill: mock API responses', () => {
  test('returns mocked product list', async ({ page }) => {
    // Intercept ALL requests to /api/products and return mock data
    await page.route('**/api/products', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS),
      });
    });

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Verify mocked data is shown — backend was never called
    await expect(page.getByText('Mocked Laptop')).toBeVisible();
    await expect(page.getByText('Mocked Chair')).toBeVisible();
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(2);
  });

  test('shows error state when API returns 500', async ({ page }) => {
    await page.route('**/api/products', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/');
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toContainText('Failed to load');
  });

  test('shows empty state when API returns empty array', async ({ page }) => {
    await page.route('**/api/products', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('shows loading state before data arrives (delayed response)', async ({ page }) => {
    let routeResolveFn: (() => void) | undefined;

    await page.route('**/api/products', async (route) => {
      // Hold the response until we manually resolve it
      await new Promise<void>((resolve) => { routeResolveFn = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRODUCTS) });
    });

    await page.goto('/');
    // Loading indicator should be visible while response is held
    await expect(page.getByTestId('loading-indicator')).toBeVisible();

    // Release the response
    routeResolveFn?.();

    // Loading indicator should disappear
    await expect(page.getByTestId('loading-indicator')).toBeHidden();
    await expect(page.getByText('Mocked Laptop')).toBeVisible();
  });

  test('mocks a 400 validation error on form submit', async ({ page }) => {
    // Let the GET through (to load the page), but fail the POST
    await page.route('**/api/products', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ title: 'Name is required.', status: 400 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/products/new');
    await page.getByTestId('field-name').fill('Bad Product');
    await page.getByTestId('field-category').fill('Test');
    await page.getByTestId('field-price').fill('10');
    await page.getByTestId('submit-product-form').click();

    await expect(page.getByTestId('form-error')).toBeVisible();
    await expect(page.getByTestId('form-error')).toContainText('Name is required.');
  });
});

test.describe('route.abort: simulate network failures', () => {
  test('shows error when API request is aborted', async ({ page }) => {
    await page.route('**/api/products', (route) => route.abort('failed'));

    await page.goto('/');
    await expect(page.getByTestId('error-message')).toBeVisible();
  });
});

test.describe('route.fetch: proxy and modify real responses', () => {
  test('intercepts real response and mutates a field', async ({ page }) => {
    await page.route('**/api/products', async (route) => {
      // Hit the real backend
      const response = await route.fetch();
      const products = await response.json();

      // Mutate: change the first product's name
      if (products.length > 0) {
        products[0].name = 'MODIFIED BY PLAYWRIGHT';
      }

      // Return the mutated response
      await route.fulfill({ json: products });
    });

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    await expect(page.getByText('MODIFIED BY PLAYWRIGHT')).toBeVisible();
  });
});

test.describe('Selective route interception', () => {
  test('intercept only POST requests, let others through', async ({ page }) => {
    const capturedBodies: object[] = [];

    await page.route('**/api/products', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        capturedBodies.push(body);
        // Still fulfill with a success response (no real POST to backend)
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...body, id: 'mock-id', sortOrder: 0, createdAt: new Date().toISOString() }),
        });
      } else {
        // Let GET requests through normally
        await route.continue();
      }
    });

    await page.goto('/products/new');
    await page.getByTestId('field-name').fill('Intercepted Product');
    await page.getByTestId('field-category').fill('Test');
    await page.getByTestId('field-price').fill('5.00');
    await page.getByTestId('submit-product-form').click();

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toMatchObject({ name: 'Intercepted Product' });
  });
});

test.describe('Passive request/response monitoring', () => {
  test('page.on(response): monitor all responses without intercepting', async ({ page }) => {
    const failedResponses: string[] = [];

    // This MONITORS responses — it does NOT intercept them.
    // The requests still go to the real server.
    page.on('response', (response) => {
      if (!response.ok() && !response.url().includes('favicon')) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // If any API calls failed, this test will catch them
    expect(failedResponses).toHaveLength(0);
  });

  test('page.on(console): capture browser console messages', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // No console errors should appear on a normal page load
    expect(consoleErrors).toHaveLength(0);
  });

  test('page.on(pageerror): catch uncaught JavaScript exceptions', async ({ page }) => {
    const pageErrors: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // No JavaScript crashes should occur on the products page
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Unrouting: clean up interceptors', () => {
  test.beforeEach(async () => {
    await resetProductStore();
    await seedProducts(SEED_PRODUCTS);
  });

  test('page.unroute: removes a previously registered route handler', async ({ page }) => {
    const handler = (route: { fulfill: (options: { status: number; body: string }) => void }) =>
      route.fulfill({ status: 200, body: '[]' });

    await page.route('**/api/products', handler);

    // Remove the handler — subsequent requests go to the real server
    await page.unroute('**/api/products', handler);

    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });

    // Real products are shown since the mock was removed
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(3);
  });
});
