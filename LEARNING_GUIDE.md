# Learning Guide — How to Explore and Write Playwright Tests

A step-by-step walkthrough of this repo, from zero knowledge to writing confident E2E tests.

---

## How to Use This Guide

Each section maps to one or more spec files in `e2e/tests/`. The recommended path is linear (01 → 13), but
you can jump to any section independently. For each topic:

1. Read the concept explanation below
2. Open the matching spec file and read the comments
3. Run just that file to see it pass: `npx playwright test <filename> --project=chromium`
4. Try modifying one test to experiment

---

## The Big Picture — What Is an E2E Test?

```
Your Test Code
     │
     ▼
Playwright API  ←──────────────────── Controls
     │                                    │
     ▼                                    ▼
Browser (Chrome/Firefox/Safari)    Your App (React UI)
     │                                    │
     ▼                                    ▼
HTTP Request  ───────────────────►  Backend API (.NET)
                                         │
                                         ▼
                                   In-Memory Store
```

A Playwright test:
1. **Opens a browser** (controlled programmatically, not by a human)
2. **Navigates** to a URL
3. **Finds elements** on the page (locators)
4. **Interacts** with them (click, fill, select)
5. **Asserts** that the page is in the expected state

---

## Stage 1 — Environment Setup

Before writing any test, confirm your environment works.

```bash
# Install everything
npm install
npx playwright install --with-deps

# Verify servers start and tests run
npm test

# Open the visual test runner (best for learning)
npm run test:ui
```

**Playwright UI mode** (`npm run test:ui`) is the recommended way to explore while learning. It shows:
- All test files in a sidebar
- Live test execution in a browser
- A timeline with screenshots at each step
- The ability to click any step to inspect the DOM at that moment

---

## Stage 2 — Core Concepts (Files 01–04)

Work through these four files first. They cover the fundamentals that every test needs.

---

### Step 1 — Navigation (`01-navigation.spec.ts`)

**What it teaches**: How to open pages, wait for them to load, move through browser history.

**Key APIs:**
```typescript
await page.goto('/');                          // Navigate to a URL (relative to baseURL)
await page.goto('/', { waitUntil: 'load' });   // Wait until load event
await expect(page).toHaveURL('/');             // Assert current URL
await page.waitForURL('/products/new');        // Wait until URL changes
await page.goBack();                           // Browser back button
await page.goForward();                        // Browser forward button
await page.reload();                           // Refresh the page
await page.waitForLoadState('networkidle');    // Wait until no network activity
```

**Rule of thumb**: Always prefer waiting for a specific element (`expect(locator).toBeVisible()`)
over `waitForLoadState('networkidle')`. Networkidle is slow and fragile.

**Run it:**
```bash
npx playwright test 01-navigation.spec.ts --project=chromium
```

---

### Step 2 — Locators (`02-locators.spec.ts`)

**What it teaches**: How to find elements on a page. This is the most important skill in Playwright.

**Decision tree — pick the first one that applies:**

```
1. Semantic role available?        → getByRole('button', { name: 'Submit' })
2. data-testid on the element?     → getByTestId('submit-product-form')
3. A <label> links to the input?   → getByLabel('Product Name')
4. Visible text on the element?    → getByText('No products found')
5. A placeholder attribute?        → getByPlaceholder('Search products...')
6. An alt text on an <img>?        → getByAltText('Laptop Pro')
7. A title attribute?              → getByTitle('Edit product')
8. Order is meaningful?            → getByRole('row').nth(1)
❌ NEVER: CSS classes, XPath, selector chains
```

**The most important locator — `getByRole`:**
```typescript
// Buttons
page.getByRole('button', { name: 'Add Product' })

// Headings
page.getByRole('heading', { name: 'Product Catalog' })

// Text inputs (linked to a label)
page.getByRole('textbox', { name: 'Product Name' })

// Table rows
page.getByRole('row', { name: /Laptop Pro/ })
```

**Filtering and chaining** (narrow down results):
```typescript
// Find the Delete button specifically inside the Laptop row
page.getByRole('row', { name: 'Laptop' }).getByRole('button', { name: 'Delete' })

// Among all list items, find those containing "Electronics"
page.getByRole('listitem').filter({ hasText: 'Electronics' })
```

**Run it:**
```bash
npx playwright test 02-locators.spec.ts --project=chromium
```

---

### Step 3 — Assertions (`03-assertions.spec.ts`)

**What it teaches**: How to verify the page is in the correct state.

**Critical concept — web-first assertions:**
Playwright assertions automatically *retry* until the condition is true or a timeout is reached.
This means you do NOT need manual waits before asserting.

```typescript
// ❌ WRONG — checks snapshot at this instant, no retry
expect(await locator.isVisible()).toBe(true);

// ✅ CORRECT — retries for up to 5 seconds before failing
await expect(locator).toBeVisible();
```

**Common assertions:**
```typescript
// Visibility
await expect(locator).toBeVisible()
await expect(locator).toBeHidden()

// Text content
await expect(locator).toHaveText('Laptop Pro')       // exact match
await expect(locator).toContainText('Laptop')         // partial match
await expect(locator).toHaveText(/\$[\d.]+/)          // regex match

// Input state
await expect(input).toHaveValue('admin')
await expect(checkbox).toBeChecked()
await expect(button).toBeEnabled()
await expect(button).toBeDisabled()
await expect(input).toBeFocused()

// Page state
await expect(page).toHaveURL('/products/new')
await expect(page).toHaveTitle(/Product Catalog/)

// Count
await expect(page.getByRole('row')).toHaveCount(4)

// Attributes
await expect(locator).toHaveAttribute('aria-label', 'Delete')

// Soft assertions — collect all failures instead of stopping at first
await expect.soft(locator).toHaveText('Expected')
await expect.soft(page).toHaveURL('/expected')
// All soft failures are reported together at the end of the test
```

**Run it:**
```bash
npx playwright test 03-assertions.spec.ts --project=chromium
```

---

### Step 4 — Interactions (`04-interactions.spec.ts`)

**What it teaches**: How to simulate user actions — typing, clicking, selecting, uploading files.

**Key interactions:**
```typescript
// Text input
await locator.fill('Gaming Chair')       // Clear and type (fastest)
await locator.pressSequentially('abc')   // Simulate keystrokes one by one
await locator.clear()                    // Clear the field

// Keyboard
await locator.press('Enter')
await locator.press('Tab')
await page.keyboard.press('Escape')

// Dropdown
await locator.selectOption('Electronics')
await locator.selectOption({ label: 'Electronics' })
await locator.selectOption({ index: 2 })

// Mouse
await locator.hover()
await locator.focus()
await locator.click()
await locator.dblclick()
await locator.click({ button: 'right' })

// File upload
await page.getByTestId('field-image-upload').setInputFiles('path/to/image.jpg')
await page.getByTestId('field-image-upload').setInputFiles([])  // Clear

// Drag and drop
await page.dragAndDrop('[data-testid="row-abc"]', '[data-testid="row-xyz"]')
```

**Run it:**
```bash
npx playwright test 04-interactions.spec.ts --project=chromium
```

---

## Stage 3 — Intermediate Concepts (Files 05–08)

Once you're comfortable with the basics, these files cover patterns you'll use in real projects.

---

### Step 5 — Network (`05-network.spec.ts`)

**What it teaches**: How to intercept, wait for, and mock API calls.

**When to use network tools:**
- **`waitForResponse`**: Sync a UI assertion with the API call that produced the data
- **`route.fulfill`**: Replace a real API call with a mock (fast, offline, test error states)
- **`route.abort`**: Simulate a network failure
- **`route.fetch` + modify**: Pass through to the real server but mutate the response

**Most common pattern — waiting for a response:**
```typescript
// Register the listener BEFORE the action that triggers the request
const responsePromise = page.waitForResponse('**/api/products');
await page.goto('/');
const response = await responsePromise;

const products = await response.json();
expect(response.status()).toBe(200);
```

**Mocking a response:**
```typescript
await page.route('**/api/products', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: '1', name: 'Mock Product', price: 9.99 }]),
  });
});
await page.goto('/');
// Page now renders the mocked data
```

**Run it:**
```bash
npx playwright test 05-network.spec.ts --project=chromium
```

---

### Step 6 — Authentication (`06-auth-storage-state.spec.ts`)

**What it teaches**: How to handle login state efficiently across all tests.

**The problem**: Logging in via the UI before every test is slow and fragile.

**The solution**: Log in once, save the browser's storage (cookies + localStorage) to a file,
load that file for every subsequent test.

```
auth.setup.ts
  └── Logs in via UI
  └── Saves e2e/.auth/user.json   ◄── Contains auth_token in localStorage

All other tests
  └── Load e2e/.auth/user.json at start
  └── Every test begins already authenticated — zero logins
```

**For unauthenticated tests** (testing the login page, protected routes):
```typescript
// Override the project-level storageState with an empty one
test.describe('Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page).toHaveURL('/login');
  });
});
```

**Key gotcha**: `storageState: undefined` does NOT clear a project-level storageState.
You must use `{ cookies: [], origins: [] }` explicitly.

**Run it:**
```bash
npx playwright test 06-auth-storage-state.spec.ts --project=chromium
```

---

### Step 7 — Page Object Model (`07-page-object-model.spec.ts`)

**What it teaches**: How to organise test code so it doesn't become a mess.

**The problem**: Tests with raw `page.getByTestId(...)` calls scattered everywhere are hard to
maintain. When a selector changes, you update it in every test.

**The solution**: Wrap page interactions in a class. Tests call intent-named methods; the class
owns all selectors.

```typescript
// Without POM — fragile, repetitive
await page.getByTestId('add-product-btn').click();
await page.getByRole('textbox', { name: 'Name' }).fill('Laptop');
await page.getByTestId('submit-product-form').click();

// With POM — readable, maintainable
await productsPage.clickAddProduct();
await productFormPage.fillName('Laptop');
await productFormPage.submit();
```

**POM design rules:**
1. **Locators are getters** (lazy — no stale element references)
2. **Methods are named after user intent**, not DOM events (`clickAddProduct` not `clickButton`)
3. **No assertions in POMs** — POMs perform actions, tests verify outcomes
4. **Constructor takes only `Page`**

```typescript
export class ProductsPage {
  constructor(private readonly page: Page) {}

  // Getters — lazy, always fresh
  get heading()   { return this.page.getByRole('heading', { name: 'Product Catalog' }); }
  get addButton() { return this.page.getByTestId('add-product-btn'); }
  get productRows() { return this.page.locator('[data-testid^="product-row-"]'); }

  // Actions
  async goto()             { await this.page.goto('/'); }
  async clickAddProduct()  { await this.addButton.click(); }
}
```

**Run it:**
```bash
npx playwright test 07-page-object-model.spec.ts --project=chromium
```

---

### Step 8 — Fixtures (`08-fixtures.spec.ts`)

**What it teaches**: How to set up and tear down test dependencies automatically and reliably.

**The problem**: Creating test data in `beforeEach` and cleaning it in `afterEach` is error-prone
— if the test throws, cleanup might not run.

**The solution**: Fixtures use a `use()` function. Code after `use()` always runs (guaranteed
teardown), even if the test fails.

```typescript
// Custom fixture — creates a product before the test, deletes it after
createdProduct: async ({}, use) => {
  const product = await createProduct({ name: 'Test Product', price: 9.99 });
  await use(product);                                    // ← test runs here
  await deleteProduct(product.id).catch(() => {});       // ← always runs
}

// Test that uses it — product exists, auto-cleaned up
test('can edit the product', async ({ page, createdProduct }) => {
  await page.goto(`/products/${createdProduct.id}/edit`);
  // ...
});
```

**Fixture scope:**
- `'test'` (default): new instance per test — isolation guaranteed
- `'worker'`: shared across all tests in the same worker — use for expensive one-time setup

**Built-in fixtures you get for free:**
- `page` — a fresh browser page
- `browser` — the browser instance
- `context` — the browser context (holds cookies, localStorage)
- `request` — an HTTP client for API calls (no browser needed)

**Run it:**
```bash
npx playwright test 08-fixtures.spec.ts --project=chromium
```

---

## Stage 4 — Reliability and Scale (Files 09–11)

These files cover patterns for running tests reliably at scale — parallelism, avoiding common
mistakes, and advanced features.

---

### Step 9 — Parallel Isolation (`09-parallel-isolation.spec.ts`)

**What it teaches**: How Playwright runs tests concurrently and how to keep them independent.

**How parallelism works:**
```
Worker 1          Worker 2          Worker 3
────────          ────────          ────────
test A            test D            test G
test B            test E            test H
test C            test F            test I
```

Each worker gets its own browser process. Tests in different workers run at the same time.
If they all touch shared state (like an in-memory database), they will interfere with each other.

**Rules for parallel-safe tests:**
1. Each test creates its own data (via fixtures) — never rely on data another test created
2. Use unique names: `` `Product-${Date.now()}-${test.info().workerIndex}` ``
3. Avoid global `beforeEach` resets when other tests depend on persistent data
4. Use `test.describe.serial()` only as a last resort for tests that truly must be sequential

**When order matters** (use sparingly):
```typescript
test.describe.serial('steps that depend on each other', () => {
  test('step 1 — creates', async ({ page }) => { ... });
  test('step 2 — reads', async ({ page }) => { ... });
  test('step 3 — deletes', async ({ page }) => { ... });
});
```

**Run it:**
```bash
npx playwright test 09-parallel-isolation.spec.ts --project=chromium
```

---

### Step 10 — Anti-Patterns (`10-anti-patterns.spec.ts`)

**What it teaches**: The 12 most common mistakes, shown side-by-side with the correct approach.

**Quick reference — things to avoid:**

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| `await page.waitForTimeout(2000)` | Arbitrary sleep — always too short or too long | `await expect(locator).toBeVisible()` |
| CSS class selectors (`.MuiButton`) | Breaks when styles change | `getByRole` or `getByTestId` |
| `expect(await locator.isVisible()).toBe(true)` | No retry — flaky on slow pages | `await expect(locator).toBeVisible()` |
| Creating test data via UI | Slow, fragile, tests depend on each other | Create via API helper in a fixture |
| `test.only` in committed code | Silently skips the whole suite in CI | `forbidOnly: true` blocks this in CI |
| Hard-coded counts (`toHaveCount(3)`) | Breaks when parallel tests add/remove data | `waitForResponse` derived count |
| Assertions inside POMs | POM becomes hard to reuse; unclear which layer owns verification | Assertions belong in tests |
| Deeply nested describe blocks | Hard to read | Flat structure with descriptive test names |

**Run it:**
```bash
npx playwright test 10-anti-patterns.spec.ts --project=chromium
```

---

### Step 11 — Advanced Features (`11-advanced.spec.ts`)

**What it teaches**: Multi-tab scenarios, injecting JavaScript, parameterised tests, visual regression, custom matchers, mobile viewports, and test tags.

**Highlights:**

**Multi-tab:**
```typescript
const newPage = await context.newPage();
await newPage.goto('/login');
await expect(newPage.getByTestId('login-page')).toBeVisible();
```

**Run JavaScript in the browser:**
```typescript
const tokenInStorage = await page.evaluate(
  (key) => window.localStorage.getItem(key),
  'auth_token'
);
```

**Parameterised tests (data-driven):**
```typescript
const categories = ['Electronics', 'Furniture', 'Appliances'];
for (const category of categories) {
  test(`filters by ${category}`, async ({ page }) => {
    await page.getByTestId('category-filter').selectOption(category);
    await expect(page.locator('[data-testid^="product-row-"]').first()).toBeVisible();
  });
}
```

**Visual regression:**
```typescript
await expect(page).toHaveScreenshot('products-page.png', { maxDiffPixels: 100 });
```

**Test tags for selective running:**
```typescript
test('is tagged as slow', { tag: '@slow' }, async ({ page }) => { ... });
// Run only: npx playwright test --grep @slow
// Skip:     npx playwright test --grep-invert @slow
```

**Run it:**
```bash
npx playwright test 11-advanced.spec.ts --project=chromium
```

---

## Stage 5 — API Testing (File 12)

### Step 12 — Pure API Tests (`12-api-testing.spec.ts`)

**What it teaches**: Using Playwright's `request` fixture to test the backend API directly —
no browser, no UI, just HTTP.

**Why use Playwright for API tests?**
- Same test runner, same CI pipeline
- Can combine API setup with UI verification in one test
- Great for verifying the contract between frontend and backend

```typescript
// Override baseURL for this file only
test.use({ baseURL: 'http://localhost:5000' });

test('GET /api/products returns products', async ({ request }) => {
  const response = await request.get('/api/products');
  expect(response.status()).toBe(200);

  const products = await response.json();
  expect(products.length).toBeGreaterThan(0);
  expect(products[0]).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    price: expect.any(Number),
  });
});

test('POST /api/products requires auth', async ({ request }) => {
  const response = await request.post('/api/products', {
    data: { name: 'Test', category: 'Test', price: 1 },
    // No Authorization header
  });
  expect(response.status()).toBe(401);
});
```

**Run it (no browser needed):**
```bash
npx playwright test 12-api-testing.spec.ts --project=chromium
```

---

## Stage 6 — Full E2E Journey (File 13)

### Step 13 — End-to-End User Journey (`13-e2e-user-journey.spec.ts`)

**What it teaches**: How all the pieces fit together in a real workflow. This file covers the
complete user journey in one serial test suite.

**The journey:**
```
1. Logout  →  Login via form  →  Verify auth token in localStorage
2. Create a product  →  Verify count increased
3. Search for the product  →  Verify it appears, others are filtered out
4. Edit the product  →  Verify form is pre-populated, verify changes saved
5. Filter by category  →  Verify product appears in correct category
6. Delete the product  →  Cancel first (verify no change), then confirm
7. Verify deletion  →  Page shows product is gone + API confirms it's gone
```

This file also contains:
- **Happy path test**: One test that does the entire CRUD cycle
- **Error handling test**: Submit invalid data, verify error messages, recover
- **Unauthenticated journey**: Verify public access works, protected routes redirect to login

**Run it:**
```bash
npx playwright test 13-e2e-user-journey.spec.ts --project=chromium
```

---

## Writing Your First Test — A Checklist

Use this when writing a new test from scratch:

```
□ 1. Pick the right file
      New concept to demonstrate?  → Add to the matching numbered spec file
      Full user flow?              → Add to 13-e2e-user-journey.spec.ts
      Pure API test?               → Add to 12-api-testing.spec.ts

□ 2. Arrange — set up test data
      Use a fixture if the test needs a product to exist (createdProduct)
      Use API helpers (createProduct, deleteProduct) for programmatic setup
      Never set up test data via UI clicks in beforeEach

□ 3. Act — perform the user action
      Use page.goto() to navigate
      Use getByRole / getByTestId to find elements
      Use fill(), click(), selectOption() to interact

□ 4. Assert — verify the outcome
      Use web-first assertions: await expect(locator).toBeVisible()
      Assert one logical thing per test
      Use waitForResponse pattern when asserting counts

□ 5. Verify isolation
      Does this test create any data? Make sure it cleans it up (use a fixture)
      Does this test assume a specific number of products exists? Use waitForResponse
      Would this test interfere with parallel tests? Use unique data

□ 6. Run in isolation first
      npx playwright test <your-file> --project=chromium
      npx playwright test --grep "your test name" --project=chromium

□ 7. Run the full suite
      npm test
      Check that nothing else broke
```

---

## Anatomy of a Well-Written Test

```typescript
import { expect, test } from '../fixtures';   // ← Always from fixtures barrel, not @playwright/test

test.describe('Product creation', () => {

  // ─── Setup ───────────────────────────────────────────────────────────────
  // If you need a product to already exist, use the createdProduct fixture.
  // If you need a fresh count baseline, capture it with waitForResponse.

  test('creates a product and shows it in the list', async ({ page }) => {

    // ─── Arrange ──────────────────────────────────────────────────────────
    // Capture current count before making any changes
    const responsePromise = page.waitForResponse('**/api/products');
    await page.goto('/');
    const existing = await (await responsePromise).json();
    const countBefore = existing.length;

    // ─── Act ──────────────────────────────────────────────────────────────
    await page.getByTestId('add-product-btn').click();
    await page.waitForURL('/products/new');

    await page.getByRole('textbox', { name: 'Name' }).fill('New Gadget');
    await page.getByRole('textbox', { name: 'Category' }).fill('Electronics');
    await page.getByRole('spinbutton', { name: 'Price' }).fill('49.99');
    await page.getByTestId('submit-product-form').click();

    await page.waitForURL('/');

    // ─── Assert ───────────────────────────────────────────────────────────
    // Check the list grew by exactly one
    await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(countBefore + 1);
    // Check the new product is visible
    await expect(page.getByRole('row', { name: 'New Gadget' })).toBeVisible();
  });

});
```

---

## Debugging Failures

### 1. See what the browser saw

```bash
# Open the HTML report (screenshots + video on failure)
npx playwright show-report

# Step through the test with a live browser
npx playwright test --debug 07-page-object-model.spec.ts

# Watch the test run in a visible browser
npx playwright test --headed --project=chromium
```

### 2. Pause mid-test

```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.pause();   // ← Opens Playwright Inspector. Remove before committing.
  // ...
});
```

### 3. Read the trace

When a test fails in CI (or with `retries: 1`), Playwright captures a trace zip.

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

The trace viewer shows:
- A screenshot at every action
- The full DOM at every step
- All network requests and responses
- Console logs and errors

### 4. Common failure patterns

| Symptom | Likely cause | Fix |
|---|---|---|
| `Locator not found` timeout | Wrong selector, element not rendered yet | Use `--debug` to inspect the DOM at that moment |
| `toHaveCount(3)` fails with 4 or 5 | Parallel test added data to shared store | Switch to `waitForResponse` derived count |
| Test passes alone, fails in full suite | Shared state interference | Use fixtures for data isolation |
| `storageState` not clearing auth | Used `undefined` instead of `{}` | Use `{ cookies: [], origins: [] }` |
| `Timeout exceeded` on navigation | Server not started, wrong port | Check that `webServer` in config started cleanly |

---

## Exploration Path Summary

```
BEGINNER
  │
  ├─ 01-navigation.spec.ts       goto, waitForURL, history
  ├─ 02-locators.spec.ts         getByRole, getByTestId, filtering
  ├─ 03-assertions.spec.ts       toBeVisible, toHaveText, soft assertions
  └─ 04-interactions.spec.ts     fill, click, selectOption, file upload
       │
       ▼
INTERMEDIATE
  │
  ├─ 05-network.spec.ts          waitForResponse, route.fulfill, route.abort
  ├─ 06-auth-storage-state.spec.ts  storageState, login flows
  ├─ 07-page-object-model.spec.ts   POM pattern, lazy getters
  └─ 08-fixtures.spec.ts         fixture lifecycle, scope, teardown
       │
       ▼
ADVANCED
  │
  ├─ 09-parallel-isolation.spec.ts  workers, data isolation
  ├─ 10-anti-patterns.spec.ts       12 patterns: wrong → right
  ├─ 11-advanced.spec.ts            multi-tab, evaluate, tags, visual regression
  └─ 12-api-testing.spec.ts         APIRequestContext, pure HTTP tests
       │
       ▼
REAL-WORLD
  │
  └─ 13-e2e-user-journey.spec.ts    full login → CRUD → logout journey
```

---

## Reference — All Commands

```bash
# Run everything
npm test

# Run a single file
npx playwright test 02-locators.spec.ts --project=chromium

# Run one test by name
npx playwright test --grep "getByRole: button" --project=chromium

# Run by tag
npx playwright test --grep "@smoke"

# Watch mode (live reload on file save)
npm run test:ui

# Headed (browser opens visibly)
npx playwright test --headed --project=chromium

# Debug mode (step through with Inspector)
npx playwright test --debug 07-page-object-model.spec.ts

# Show HTML report
npx playwright show-report

# Update visual snapshots
npx playwright test 11-advanced.spec.ts --update-snapshots

# Single worker (sequential, for debugging race conditions)
npx playwright test --workers=1

# List all tests without running
npx playwright test --list
```
