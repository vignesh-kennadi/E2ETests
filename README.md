# Product Catalog — Playwright E2E Teaching Reference

A fully working demo app built to teach **Playwright E2E testing in TypeScript** from scratch.
Every concept is demonstrated in a real running application, with richly commented test files
you can copy directly into production projects.

---

## Architecture

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                      Playwright Runner                            │
  │  ┌──────────────────┐  ┌───────────────┐  ┌────────────────────┐ │
  │  │ Chromium Browser │  │Firefox Browser│  │ WebKit/Mobile      │ │
  │  └────────┬─────────┘  └───────┬───────┘  └─────────┬──────────┘ │
  └───────────┼────────────────────┼────────────────────┼────────────┘
              │ HTTP (localhost:5173)                    │
  ┌───────────▼────────────────────────────────────────▼────────────┐
  │                  React Frontend — Vite :5173                      │
  │      Products list · Login · Add/Edit form · Search/Filter        │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │ REST API (localhost:5000)
  ┌───────────────────────────────▼─────────────────────────────────┐
  │              .NET 10 Backend — ASP.NET Core Minimal API :5000      │
  │         In-memory store · CRUD · Auth · Test-support endpoints    │
  └──────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| .NET SDK | 9+ | [dotnet.microsoft.com](https://dotnet.microsoft.com/download) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 8+ | bundled with Node.js |

---

## Quick Start (5 commands)

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd E2ETests

# 2. Install root dependencies (Playwright)
npm install

# 3. Install frontend dependencies
npm install --prefix frontend

# 4. Install Playwright browsers (only needed once)
npx playwright install --with-deps

# 5. Run all tests (starts backend + frontend automatically)
npm test
```

Playwright starts the .NET backend and Vite frontend automatically via `webServer` config.
No manual server startup is needed.

---

## Running Tests

```bash
# All tests (all browsers)
npm test

# Interactive UI mode — best for learning and debugging
npm run test:ui

# Headed mode — watch the browser perform actions
npm run test:headed

# Specific browser only
npx playwright test --project=chromium
npx playwright test --project=firefox

# Specific test file
npx playwright test 01-navigation.spec.ts

# Tests matching a name pattern
npx playwright test --grep "creates a product"

# Tests with a specific tag
npx playwright test --grep @smoke

# Exclude tagged tests
npx playwright test --grep-invert @slow

# Debug mode — step through tests interactively
npm run test:debug

# View the HTML report from the last run
npm run test:report

# Sharding (split across machines in CI)
npx playwright test --shard=1/3   # machine 1 of 3
npx playwright test --shard=2/3   # machine 2 of 3
npx playwright test --shard=3/3   # machine 3 of 3
```

---

## Test File Reference

| File | Concepts Covered |
|------|-----------------|
| `01-navigation.spec.ts` | goto, waitForURL, toHaveURL, goBack, goForward, reload, waitForLoadState, URL params, deep links, redirects |
| `02-locators.spec.ts` | getByRole, getByTestId, getByLabel, getByText, getByPlaceholder, getByAltText, getByTitle, filter, chaining, .or(), .nth() |
| `03-assertions.spec.ts` | toBeVisible, toBeHidden, toHaveText, toContainText, toHaveValue, toBeEnabled, toBeFocused, toHaveURL, toHaveCount, toHaveAttribute, soft assertions, custom timeouts |
| `04-interactions.spec.ts` | fill, type, pressSequentially, clear, press, keyboard, Tab order, selectOption, hover, focus, file upload, drag-and-drop, click variants |
| `05-network.spec.ts` | waitForResponse, waitForRequest, route.fulfill, route.abort, route.continue, route.fetch (proxy+mutate), selective interception, slow network simulation, page.on(response/console/pageerror), unroute |
| `06-auth-storage-state.spec.ts` | storageState, auth.setup.ts, logout, protected routes, per-test unauthenticated context, context.cookies() |
| `07-page-object-model.spec.ts` | Raw vs POM comparison, getter-based locators, action naming, no assertions in POMs |
| `08-fixtures.spec.ts` | Built-in fixtures (page/context/browser/request), custom fixtures, setup/teardown lifecycle, worker-scoped fixtures, fixture composability, override built-in fixtures, beforeAll comparison |
| `09-parallel-isolation.spec.ts` | fullyParallel, test independence, unique data, test.describe.serial, workerIndex |
| `10-anti-patterns.spec.ts` | waitForTimeout, CSS selectors, positional nth, non-web-first assertions, UI data setup, over-asserting, test.only, shared state, XPath, nested describes |
| `11-advanced.spec.ts` | Multi-tab, multi-user contexts, page.evaluate, parameterized tests, custom matchers, visual regression, mobile viewport, test annotations (tag/skip/fixme/slow), performance timing, soft assertions |
| `12-api-testing.spec.ts` | request fixture, CRUD API tests, status codes, response shape (toMatchObject), headers, 401/400 validation, full lifecycle test |

---

## Playwright Concepts Guide

### When to Use Playwright

Use Playwright for testing **user behavior in a real browser**:
- Multi-page flows (login → create → view → delete)
- Authentication and authorization
- Form submissions and validation
- Real frontend ↔ backend integration
- Testing UI error states (404, 500, network failure)

Do NOT use Playwright for:
- Pure unit tests of functions (use Jest/Vitest)
- API contract tests in isolation (use `request` fixture or Supertest)
- Performance benchmarks (use k6, Artillery)

---

### Locator Strategy Decision Tree

```
Does the element have a semantic role?
  → YES: page.getByRole('button', { name: 'Submit' })     ← BEST

Does it have a data-testid attribute?
  → YES: page.getByTestId('submit-product-form')           ← VERY GOOD

Does it have a <label>?
  → YES: page.getByLabel('Product Name')                   ← GOOD

Is there unique visible text?
  → YES: page.getByText('No products found')               ← GOOD

Does it have a placeholder?
  → YES: page.getByPlaceholder('Search...')                ← GOOD

Does it have an alt attribute (image)?
  → YES: page.getByAltText('Laptop Pro')                   ← GOOD

Is position stable and meaningful?
  → YES: page.getByRole('row').nth(1)                      ← USE CAREFULLY

CSS class or selector chain?
  → NEVER: page.locator('.product-row')                    ← FRAGILE
  → NEVER: page.locator('#root > div > button')            ← FRAGILE
  → NEVER: page.locator('//div[@class="row"]')             ← FRAGILE
```

---

### Assertion Reference Card

| Assertion | What it checks |
|-----------|---------------|
| `toBeVisible()` | Element is rendered and visible |
| `toBeHidden()` | Element is hidden (may be in DOM) |
| `toBeAttached()` | Element is in the DOM |
| `toHaveText('...')` | Element's text content matches |
| `toContainText('...')` | Element contains the given text |
| `toHaveValue('...')` | Input value matches |
| `toBeChecked()` | Checkbox/radio is checked |
| `toBeEnabled()` | Form element is not disabled |
| `toBeDisabled()` | Form element is disabled |
| `toBeFocused()` | Element has focus |
| `toBeEmpty()` | Input/textarea is empty |
| `toHaveURL('...')` | Page URL matches (string or regex) |
| `toHaveTitle('...')` | Page `<title>` matches |
| `toHaveCount(n)` | Locator matches exactly n elements |
| `toHaveAttribute('key', 'val')` | HTML attribute matches |
| `toHaveClass(/pattern/)` | CSS class matches regex |

**All assertions are web-first** — they retry automatically until the condition is true or the timeout (5s default) expires.

---

### Best Practices Checklist

- [ ] Use `getByRole` first — it's accessibility-aligned and most semantic
- [ ] Add `data-testid` to every interactive element in your app
- [ ] Never use `waitForTimeout` — wait for a specific condition instead
- [ ] Set up test data via API helpers, not through the UI
- [ ] Use fixtures for per-test setup/teardown instead of `beforeEach`
- [ ] Keep each test focused on ONE logical concept
- [ ] Make test data unique (include `Date.now()` in names) for parallel safety
- [ ] Never put assertions inside Page Object Models
- [ ] Use `forbidOnly: !!process.env.CI` to catch accidental `test.only` in CI
- [ ] Set `strictPort: true` in Vite config to prevent silent port changes

---

### Debugging Guide

```bash
# 1. Playwright UI Mode — best starting point
npm run test:ui
# Opens a visual interface to run/debug tests, see screenshots and traces

# 2. Debug mode — step through tests with Inspector
npm run test:debug
# Or: npx playwright test --debug 01-navigation.spec.ts

# 3. Headed mode — watch the browser
npm run test:headed

# 4. page.pause() — pause inside a test (add temporarily, remove before commit)
# await page.pause();  // Opens Playwright Inspector at this point in the test

# 5. Trace Viewer — post-mortem debugging
npx playwright show-report
# Click on a failed test → View Trace
# The trace has: DOM snapshots, screenshots, network log, console messages

# 6. Increase timeout for a specific test
test('slow test', async ({ page }) => {
  test.setTimeout(60_000);  // 60 seconds for this test only
  // ...
});
```

---

### CI Integration

The `.github/workflows/playwright.yml` workflow:
1. Sets up .NET 9 and Node 20
2. Installs dependencies
3. Installs Playwright browsers (with OS deps via `--with-deps`)
4. Runs all tests (`CI=true` enables retries and stricter settings)
5. Uploads the HTML report as an artifact on failure

**Test sharding** (run 1/3 of tests per machine):
```bash
npx playwright test --shard=1/3   # runs tests 1–N/3
npx playwright test --shard=2/3   # runs tests N/3+1–2N/3
npx playwright test --shard=3/3   # runs tests 2N/3+1–N
```
Combine results: `npx playwright merge-reports ./all-reports`

---

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:5173` | Frontend URL used by Playwright |
| `API_BASE_URL` | `http://localhost:5000` | Backend URL used by test helpers |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend URL used by the React app |
| `CI` | (unset) | When set, enables retries and stricter CI settings |

---

## Project Structure

```
E2ETests/
├── playwright.config.ts       # ← START HERE: config, webServer, projects, storageState
├── package.json               # Playwright scripts
├── .github/workflows/         # CI config (GitHub Actions)
│
├── backend/                   # .NET 10 Minimal API
│   ├── Models/Product.cs      # Data model
│   ├── Data/InMemoryProductStore.cs  # Thread-safe in-memory store
│   └── Endpoints/
│       ├── ProductEndpoints.cs       # CRUD endpoints
│       ├── AuthEndpoints.cs          # Login + me endpoints
│       └── TestSupportEndpoints.cs   # /api/test/reset + seed (dev only)
│
├── frontend/                  # React + Vite + TypeScript
│   └── src/
│       ├── api/productsApi.ts # Backend API client
│       ├── context/AuthContext.tsx   # Auth state
│       ├── components/        # ProductCard, ProductList, ConfirmDialog, SearchBar
│       └── pages/             # ProductsPage, ProductFormPage, LoginPage
│
└── e2e/
    ├── global-setup.ts        # Reset + seed data once before all tests
    ├── auth.setup.ts          # Login once, save storageState
    ├── helpers/api.ts         # Direct API helpers for test data
    ├── pages/                 # Page Object Models
    │   ├── LoginPage.ts
    │   ├── ProductsPage.ts
    │   └── ProductFormPage.ts
    ├── fixtures/
    │   ├── product.fixture.ts # Custom fixtures (createdProduct, POMs)
    │   └── index.ts           # Barrel export
    └── tests/
        ├── 01-navigation.spec.ts
        ├── 02-locators.spec.ts
        ├── 03-assertions.spec.ts
        ├── 04-interactions.spec.ts
        ├── 05-network.spec.ts
        ├── 06-auth-storage-state.spec.ts
        ├── 07-page-object-model.spec.ts
        ├── 08-fixtures.spec.ts
        ├── 09-parallel-isolation.spec.ts
        ├── 10-anti-patterns.spec.ts
        ├── 11-advanced.spec.ts
        └── 12-api-testing.spec.ts
```

---

## Demo Credentials

```
Username: admin
Password: password
```
