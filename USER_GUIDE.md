# User Guide — Product Catalog Playwright Reference

Complete setup, tooling, and command reference for running the E2E test suite.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | https://nodejs.org or `nvm install --lts` |
| .NET SDK | ≥ 9.0 | https://dotnet.microsoft.com/download |
| npm | ≥ 9 | Bundled with Node.js |

Check your versions:
```bash
node --version       # v18+
dotnet --version     # 9.x
npm --version        # 9+
```

---

## First-Time Setup (clone → green tests)

```bash
# 1. Clone the repository
git clone <repo-url>
cd E2ETests

# 2. Install root dependencies (Playwright, TypeScript, etc.)
npm install

# 3. Install Playwright browser binaries
npx playwright install --with-deps

# 4. Restore .NET packages (done automatically on first run, but you can pre-fetch)
dotnet restore backend/ProductCatalog.Api.csproj

# 5. Run the full test suite (starts both servers automatically)
npm test
```

That's it. No manual server startup needed — `playwright.config.ts` uses `webServer` to start
and stop the .NET backend (`localhost:5000`) and Vite dev server (`localhost:5173`) automatically.

---

## Running Tests

### All tests, all browsers
```bash
npm test
# equivalent to:
npx playwright test
```

### All tests, single browser (fastest for development)
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=mobile-chrome
```

### Specific spec file
```bash
npx playwright test 01-navigation.spec.ts
npx playwright test e2e/tests/12-api-testing.spec.ts
```

### Specific test by name (grep)
```bash
npx playwright test --grep "creates a product"
npx playwright test --grep "POM"
```

### Tag-based filtering
```bash
# Run only smoke tests (tagged with @smoke)
npx playwright test --grep "@smoke"

# Run everything except slow tests
npx playwright test --grep-invert "@slow"
```

### Headed mode (browser visually opens)
```bash
npx playwright test --headed
npx playwright test --headed --project=chromium
```

### Playwright UI mode (interactive, live reload)
```bash
npx playwright test --ui
# or
npm run test:ui
```

### Debug mode (step through with Inspector)
```bash
npx playwright test --debug
npx playwright test 07-page-object-model.spec.ts --debug
```

### Show HTML report after a run
```bash
npx playwright show-report
```

### Retry failed tests only
```bash
npx playwright test --last-failed
```

### Control parallelism
```bash
# Single worker (sequential, useful for debugging races)
npx playwright test --workers=1

# Specific number of workers
npx playwright test --workers=4
```

### Update visual regression snapshots
```bash
npx playwright test --update-snapshots
npx playwright test 11-advanced.spec.ts --update-snapshots
```

### CI mode (forbid .only, retries on)
```bash
CI=true npm test
```

### Sharding (for large suites across machines)
```bash
# Machine 1
npx playwright test --shard=1/3

# Machine 2
npx playwright test --shard=2/3

# Machine 3
npx playwright test --shard=3/3
```

---

## npm Scripts (defined in `package.json`)

| Script | What it does |
|---|---|
| `npm test` | Full suite, all browsers, headless |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:headed` | Headed Chromium |
| `npm run test:debug` | Debug mode |
| `npm run test:report` | Open last HTML report |

---

## Starting Servers Manually (optional)

Playwright starts and stops both servers automatically. If you want to run them independently
(e.g., during frontend development):

### .NET Backend (port 5000)
```bash
dotnet run --project backend/ProductCatalog.Api.csproj --launch-profile http
```
API available at:
- `http://localhost:5000/api/products`
- `http://localhost:5000/api/auth/login`
- `http://localhost:5000/api/test/reset` (dev only)
- `http://localhost:5000/api/test/seed` (dev only)

### React/Vite Frontend (port 5173)
```bash
npm run dev --prefix frontend
# or from frontend/ directory:
cd frontend && npm run dev
```
App available at `http://localhost:5173`

When running servers manually, Playwright uses `reuseExistingServer: true` (local mode) and
won't start duplicate processes.

---

## Project Structure

```
E2ETests/
├── playwright.config.ts          # All Playwright configuration
├── package.json                  # Root: scripts + @playwright/test dep
├── tsconfig.json                 # TypeScript config for e2e/ + backend/
├── PLAN.md                       # Original implementation plan
├── LESSONS_LEARNED.md            # Implementation pitfalls and solutions
├── USER_GUIDE.md                 # This file
│
├── backend/                      # .NET 9 Minimal API
│   ├── ProductCatalog.Api.csproj
│   ├── Program.cs
│   ├── Models/Product.cs
│   ├── Data/InMemoryProductStore.cs
│   └── Endpoints/
│       ├── ProductEndpoints.cs   # GET/POST/PUT/DELETE /api/products
│       ├── AuthEndpoints.cs      # POST /api/auth/login, GET /api/auth/me
│       └── TestSupportEndpoints.cs  # POST /api/test/reset, /api/test/seed
│
├── frontend/                     # React + Vite app
│   ├── package.json
│   ├── vite.config.ts            # port 5173, strict
│   └── src/
│       ├── App.tsx
│       ├── context/AuthContext.tsx
│       ├── api/productsApi.ts
│       ├── components/           # ProductList, ConfirmDialog, SearchBar...
│       └── pages/                # ProductsPage, LoginPage, ProductFormPage
│
└── e2e/                          # All Playwright files
    ├── global-setup.ts           # Runs once before all tests: reset + seed
    ├── auth.setup.ts             # Logs in once, saves storageState
    ├── helpers/
    │   └── api.ts                # resetProductStore, seedProducts, createProduct...
    ├── pages/                    # Page Object Models
    │   ├── ProductsPage.ts
    │   ├── ProductFormPage.ts
    │   └── LoginPage.ts
    ├── fixtures/
    │   ├── product.fixture.ts    # createdProduct, productsPage, productFormPage...
    │   └── index.ts              # barrel: re-export test + expect
    └── tests/                    # 13 spec files (see below)
```

---

## Test File Reference

| File | Topic | Key Playwright APIs |
|---|---|---|
| `01-navigation.spec.ts` | URL navigation, history | `goto`, `waitForURL`, `goBack`, `reload` |
| `02-locators.spec.ts` | All locator strategies | `getByRole`, `getByTestId`, `getByLabel`, `filter`, chaining |
| `03-assertions.spec.ts` | Every assertion type | `toBeVisible`, `toHaveText`, `toHaveCount`, soft assertions |
| `04-interactions.spec.ts` | Keyboard, mouse, upload, drag | `fill`, `press`, `selectOption`, `setInputFiles`, `dragAndDrop` |
| `05-network.spec.ts` | Request interception | `waitForResponse`, `route.fulfill`, `route.abort`, modify |
| `06-auth-storage-state.spec.ts` | Auth flows | `storageState`, login/logout, protected routes, cookies |
| `07-page-object-model.spec.ts` | POM design | Lazy getters, no-assertions-in-POMs, with/without POM comparison |
| `08-fixtures.spec.ts` | Fixture lifecycle | `test.extend`, scope, composition, worker-scoped fixtures |
| `09-parallel-isolation.spec.ts` | Parallelism | `fullyParallel`, isolation, `test.describe.serial`, `workerIndex` |
| `10-anti-patterns.spec.ts` | Common mistakes | 12 patterns: ❌ wrong → ✅ correct |
| `11-advanced.spec.ts` | Advanced features | Multi-tab, multi-user, `page.evaluate`, parameterized, mobile |
| `12-api-testing.spec.ts` | Pure API tests | `request` fixture, full CRUD via HTTP, status codes, headers |
| `13-e2e-user-journey.spec.ts` | Full E2E journey | Complete user workflow: login → create → search → edit → delete |

---

## Playwright Config Summary

The key settings in `playwright.config.ts` and why they exist:

```typescript
{
  testDir: './e2e/tests',        // Where Playwright looks for *.spec.ts
  fullyParallel: true,           // Each test gets its own browser context, run concurrently
  forbidOnly: !!process.env.CI,  // Fail CI if test.only is committed
  retries: 1,                    // One retry absorbs rare race conditions in shared backend
  workers: process.env.CI ? 2 : undefined, // Limit CI workers; local uses all CPU cores

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',     // Capture trace on failure (view in Playwright Trace Viewer)
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,       // Each action (click, fill) has 10s timeout
    navigationTimeout: 30_000,   // Each navigation has 30s timeout
  },

  expect: { timeout: 5000 },     // Web-first assertions retry for 5s before failing
}
```

### Projects
```
setup        → runs auth.setup.ts once, saves e2e/.auth/user.json
chromium     → Desktop Chrome, loads storageState (authenticated)
firefox      → Desktop Firefox, loads storageState
webkit       → Desktop Safari, loads storageState
mobile-chrome → Pixel 5 viewport, loads storageState
```

---

## Authentication Model

The app uses a hardcoded static token for demo purposes:
- **Username**: `admin`
- **Password**: `password`
- **Token**: `demo-static-token-12345` (stored in `localStorage` as `auth_token`)

`auth.setup.ts` logs in once via the UI before any tests run and saves the browser's
localStorage to `e2e/.auth/user.json`. All browser projects load this file, so every test
starts already authenticated without any per-test login.

---

## Test Data Strategy

1. **Global setup** (`e2e/global-setup.ts`): Resets and seeds 3 products before the test run.
2. **Per-test fixtures** (`createdProduct`): Creates a product via API, auto-deletes after test.
3. **beforeEach resets**: Some describe blocks reset + re-seed for exact-count assertions.
4. **`waitForResponse` sync**: Count assertions use the API response that the page rendered
   from, not a separately timed API call — prevents race conditions in parallel execution.

---

## Debugging Failures

### View the HTML report
```bash
npx playwright show-report
# Click any failing test to see: timeline, screenshots, video, trace
```

### Open Trace Viewer for a specific failure
```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Step through a test with Inspector
```bash
npx playwright test --debug 07-page-object-model.spec.ts
```

### Add `page.pause()` temporarily
```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Opens Playwright Inspector — remove before commit
  // ...
});
```

### Run with verbose output
```bash
npx playwright test --reporter=list
```

### Check which tests would run (dry run)
```bash
npx playwright test --list
npx playwright test --list --grep "@smoke"
```

---

## CI/CD

The `.github/workflows/playwright.yml` workflow:

1. Sets up Node.js and .NET 9
2. Installs npm dependencies
3. Installs Playwright browsers with system dependencies
4. Runs `npm test` with `CI=true`
5. Uploads the HTML report as an artifact on failure

```bash
# Simulate CI locally
CI=true npx playwright test --workers=2
```

---

## Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| "No tests found" for `auth.setup.ts` | `setup` project missing `testDir: './e2e'` | Add `testDir: './e2e'` to setup project |
| `e2e/.auth/user.json not found` | Auth setup didn't run | Run `npx playwright test --project=setup` first |
| `ECONNREFUSED localhost:5000` | Backend not started | Playwright starts it via `webServer`; check `dotnet` is installed |
| `ECONNREFUSED localhost:5173` | Frontend not started | Same as above; check `npm install` ran in `frontend/` |
| Count assertions flaky | Parallel store resets | Use `waitForResponse` pattern; `retries: 1` handles residual |
| Visual snapshot mismatch | UI content changed | Run `npx playwright test --update-snapshots` |
| `storageState` not clearing auth | Used `undefined` instead of `{}` | Use `{ cookies: [], origins: [] }` |
| Form validation test fails | Browser native validation intercepting | Add `noValidate` to `<form>` element |
