import { test, expect } from '@playwright/test';
import { STATIC_TOKEN } from '../helpers/api';

/**
 * 12 — API Testing (no browser)
 *
 * Playwright's `request` fixture provides an APIRequestContext — a full HTTP
 * client that runs in Node.js (no browser needed). Perfect for:
 *   - Testing API contracts independently of the UI
 *   - Validating response shapes and headers
 *   - Testing auth rules, validation, and error responses
 *   - Full CRUD lifecycle tests at the API level
 *
 * :
 * This spec runs without a browser. It tests the .NET backend directly.
 * These tests run FASTER and are more stable than UI tests because they skip
 * the rendering pipeline entirely.
 *
 * When to use API tests vs E2E:
 *   - API tests: verify the backend contract (status codes, response shape, auth)
 *   - E2E tests: verify the user workflow (UI interactions, visual feedback)
 *   - You should have BOTH — they test different things
 */

// Override the base URL for this file to point at the backend
test.use({ baseURL: 'http://localhost:5000' });

const AUTH_HEADERS = { Authorization: `Bearer ${STATIC_TOKEN}` };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────────────────────────────────────

test.describe('GET /api/products', () => {
  test('returns 200 with an array of products', async ({ request }) => {
    const response = await request.get('/api/products');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const products = await response.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  test('each product has the expected shape', async ({ request }) => {
    const response = await request.get('/api/products');
    const products = await response.json();

    // toMatchObject checks that the object has AT LEAST these fields
    // (extra fields are allowed — use toStrictEqual for exact match)
    expect(products[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      description: expect.any(String),
      price: expect.any(Number),
      sortOrder: expect.any(Number),
      createdAt: expect.any(String),
    });
  });

  test('products are returned in sortOrder order', async ({ request }) => {
    const response = await request.get('/api/products');
    const products = await response.json();

    for (let i = 1; i < products.length; i++) {
      expect(products[i].sortOrder).toBeGreaterThanOrEqual(products[i - 1].sortOrder);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/{id}
// ─────────────────────────────────────────────────────────────────────────────

test.describe('GET /api/products/{id}', () => {
  test('returns 200 for an existing product', async ({ request }) => {
    const allResponse = await request.get('/api/products');
    const products = await allResponse.json();
    const firstId = products[0].id;

    const response = await request.get(`/api/products/${firstId}`);
    expect(response.status()).toBe(200);
    const product = await response.json();
    expect(product.id).toBe(firstId);
  });

  test('returns 404 for a non-existent ID', async ({ request }) => {
    const response = await request.get('/api/products/00000000-0000-0000-0000-000000000000');
    expect(response.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/products', () => {
  test('creates a product and returns 201 with Location header', async ({ request }) => {
    const response = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: {
        name: `API Test Product ${Date.now()}`,
        category: 'Test',
        description: 'Created by API test',
        price: 49.99,
      },
    });

    expect(response.status()).toBe(201);

    // Verify the Location header points to the new resource
    const location = response.headers()['location'];
    expect(location).toMatch(/\/api\/products\/[0-9a-f-]+$/);

    const created = await response.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toContain('API Test Product');
    expect(created.price).toBe(49.99);

    // Cleanup
    await request.delete(`/api/products/${created.id}`, { headers: AUTH_HEADERS });
  });

  test('returns 401 without auth token', async ({ request }) => {
    const response = await request.post('/api/products', {
      data: { name: 'Unauthorized', category: 'Test', price: 1 },
    });
    expect(response.status()).toBe(401);
  });

  test('returns 400 for missing Name', async ({ request }) => {
    const response = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: { name: '', category: 'Test', price: 9.99 },
    });
    expect(response.status()).toBe(400);
    const problem = await response.json();
    // ProblemDetails: title = generic "Validation failed", detail = field-specific message
    expect(problem.title).toBeTruthy();
    expect(problem.detail.toLowerCase()).toContain('name');
  });

  test('returns 400 for negative price', async ({ request }) => {
    const response = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: { name: 'Bad Price Product', category: 'Test', price: -1 },
    });
    expect(response.status()).toBe(400);
    const problem = await response.json();
    // ProblemDetails detail contains the field-level message
    expect(problem.detail.toLowerCase()).toContain('price');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/products/{id}
// ─────────────────────────────────────────────────────────────────────────────

test.describe('PUT /api/products/{id}', () => {
  test('updates a product and returns 200', async ({ request }) => {
    // Create first
    const createRes = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: { name: `Update Test ${Date.now()}`, category: 'Test', price: 1 },
    });
    const created = await createRes.json();

    // Update
    const updateRes = await request.put(`/api/products/${created.id}`, {
      headers: AUTH_HEADERS,
      data: { name: 'Updated Name', category: 'Updated Category', price: 999.99, description: 'New desc' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Updated Name');
    expect(updated.price).toBe(999.99);

    // Cleanup
    await request.delete(`/api/products/${created.id}`, { headers: AUTH_HEADERS });
  });

  test('returns 404 for non-existent product', async ({ request }) => {
    const response = await request.put('/api/products/00000000-0000-0000-0000-000000000000', {
      headers: AUTH_HEADERS,
      data: { name: 'Ghost', category: 'Test', price: 1, description: '' },
    });
    expect(response.status()).toBe(404);
  });

  test('returns 401 without auth', async ({ request }) => {
    const response = await request.put('/api/products/00000000-0000-0000-0000-000000000000', {
      data: { name: 'Ghost', category: 'Test', price: 1, description: '' },
    });
    expect(response.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/products/{id}
// ─────────────────────────────────────────────────────────────────────────────

test.describe('DELETE /api/products/{id}', () => {
  test('deletes a product and returns 204', async ({ request }) => {
    const createRes = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: { name: `Delete Test ${Date.now()}`, category: 'Test', price: 1 },
    });
    const created = await createRes.json();

    const deleteRes = await request.delete(`/api/products/${created.id}`, { headers: AUTH_HEADERS });
    expect(deleteRes.status()).toBe(204);

    // Verify it's gone
    const getRes = await request.get(`/api/products/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('returns 404 for already-deleted product', async ({ request }) => {
    const response = await request.delete('/api/products/00000000-0000-0000-0000-000000000000', {
      headers: AUTH_HEADERS,
    });
    expect(response.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth endpoints
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/auth/login', () => {
  test('returns 200 with token for valid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'password' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toBe(STATIC_TOKEN);
  });

  test('returns 401 for invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'wrong' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('GET /api/auth/me', () => {
  test('returns current user with valid token', async ({ request }) => {
    const response = await request.get('/api/auth/me', { headers: AUTH_HEADERS });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.username).toBe('admin');
  });

  test('returns 401 without token', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full CRUD lifecycle
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Full product lifecycle (Create → Read → Update → Delete)', () => {
  test('complete CRUD flow via API', async ({ request }) => {
    // CREATE
    const createRes = await request.post('/api/products', {
      headers: AUTH_HEADERS,
      data: { name: `Lifecycle ${Date.now()}`, category: 'Test', price: 42.42, description: 'Lifecycle test' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();

    // READ (single)
    const getRes = await request.get(`/api/products/${created.id}`);
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.name).toBe(created.name);
    expect(fetched.price).toBe(42.42);

    // UPDATE
    const updateRes = await request.put(`/api/products/${created.id}`, {
      headers: AUTH_HEADERS,
      data: { name: 'Lifecycle Updated', category: 'Updated', price: 99.99, description: '' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Lifecycle Updated');
    expect(updated.id).toBe(created.id); // ID does not change

    // READ (list) — verify updated product appears
    const listRes = await request.get('/api/products');
    const list = await listRes.json();
    const found = list.find((p: { id: string }) => p.id === created.id);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Lifecycle Updated');

    // DELETE
    const deleteRes = await request.delete(`/api/products/${created.id}`, { headers: AUTH_HEADERS });
    expect(deleteRes.status()).toBe(204);

    // VERIFY DELETED
    const afterDelete = await request.get(`/api/products/${created.id}`);
    expect(afterDelete.status()).toBe(404);
  });
});
