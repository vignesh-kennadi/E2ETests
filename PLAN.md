# Implementation Plan: Product Catalog — Playwright Teaching Reference

> This is the original implementation plan for the E2ETests project.
> It was written before any code was produced and served as the specification.

---

## Goal

Build a **fully running** Product Catalog demo app (React + .NET 9 backend) that serves as a
complete, production-grade Playwright reference. Every spec file is richly commented so a
developer can copy any pattern directly into a real project. The finished repo runs with
`npm test` from a clean clone — no manual server startup needed.

---

## App Features (drives Playwright coverage)

| Feature | Enables Playwright concept |
|---|---|
| Product CRUD | Core E2E flows, form interactions, fixtures |
| Search + category filter | `waitForResponse`, keyboard, URL params |
| Login page | `storageState`, auth setup, protected routes |
| Product image URL + `<img alt>` | `getByAltText()` |
| Image file upload (product photo) | File upload API |
| Drag-to-reorder products | Drag-and-drop |
| Confirm delete dialog | Browser dialog events |

---

## Folder Structure

```
E2ETests/
├── playwright.config.ts
├── package.json                          # root: @playwright/test + scripts
├── tsconfig.json
├── .env.test                             # VITE_API_BASE_URL, BASE_URL for CI
├── .github/workflows/playwright.yml      # CI config (GitHub Actions)
├── README.md
│
├── backend/
│   ├── ProductCatalog.Api.csproj
│   ├── Program.cs
│   ├── Properties/launchSettings.json    # fixed port 5000
│   ├── Models/Product.cs
│   ├── Data/InMemoryProductStore.cs
│   └── Endpoints/
│       ├── ProductEndpoints.cs
│       ├── AuthEndpoints.cs              # POST /api/auth/login
│       └── TestSupportEndpoints.cs       # /api/test/reset + seed (dev only)
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts                    # port 5173, strictPort: true
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types/product.ts
│       ├── api/productsApi.ts
│       ├── context/AuthContext.tsx
│       ├── components/
│       │   ├── ProductList.tsx           # sortable list (drag-to-reorder)
│       │   ├── ProductCard.tsx           # includes <img alt="...">
│       │   ├── ProductSearchBar.tsx
│       │   └── ConfirmDialog.tsx         # role="dialog"
│       └── pages/
│           ├── LoginPage.tsx
│           ├── ProductsPage.tsx
│           └── ProductFormPage.tsx       # includes file upload input
│
└── e2e/
    ├── global-setup.ts                   # reset + seed once before all tests
    ├── auth.setup.ts                     # login once, save storageState
    ├── helpers/
    │   ├── api.ts                        # direct fetch helpers
    │   └── auth.ts
    ├── pages/                            # Page Object Models
    │   ├── LoginPage.ts
    │   ├── ProductsPage.ts
    │   └── ProductFormPage.ts
    ├── fixtures/
    │   ├── product.fixture.ts
    │   └── index.ts                      # barrel: export { test, expect }
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

## Backend (.NET 9 Minimal API)

### Product Model (`Models/Product.cs`)

```csharp
public record Product {
  public Guid Id { get; init; } = Guid.NewGuid();
  public required string Name { get; set; }
  public required string Category { get; set; }
  public string Description { get; set; } = string.Empty;
  public decimal Price { get; set; }
  public string? ImageUrl { get; set; }     // enables getByAltText demo
  public int SortOrder { get; set; }        // enables drag-reorder demo
  public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
```

### API Endpoints

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/api/products` | No | 200 `Product[]` |
| GET | `/api/products/{id}` | No | 200 / 404 |
| POST | `/api/products` | Yes | 201 + Location |
| PUT | `/api/products/{id}` | Yes | 200 / 404 |
| DELETE | `/api/products/{id}` | Yes | 204 / 404 |
| PUT | `/api/products/reorder` | Yes | 200 (accepts `{id, sortOrder}[]`) |
| POST | `/api/auth/login` | No | 200 `{token}` / 401 |
| GET | `/api/auth/me` | Yes | 200 `{username}` |
| POST | `/api/test/reset` | No | 200 (dev only) |
| POST | `/api/test/seed` | No | 200 (dev only) |

- Validation: 400 `ProblemDetails` for empty Name or Price < 0
- CORS: allow `http://localhost:5173`, allow credentials
- Fixed port: `http://localhost:5000` in `launchSettings.json`
- Auth: simple bearer token hardcoded for demo (`admin`/`password` → returns a static token)
- `TestSupportEndpoints` only registered when `app.Environment.IsDevelopment()`

---

## Frontend

- Auth token in `localStorage`, sent as `Authorization: Bearer <token>`
- `AuthContext` provides `isLoggedIn`, `login()`, `logout()`
- Protected routes: redirect to `/login` if not authenticated for write operations
- Search: debounced, updates URL `?q=` and `?category=`
- Image field: `<img src={imageUrl} alt={name} data-testid="product-image-{id}" />`
- File upload: `<input type="file" data-testid="field-image-upload" />`
- Drag-to-reorder: HTML5 drag-and-drop on product rows

### `data-testid` Convention

```
# Pages
login-page, products-page, product-form-page

# Auth
login-username, login-password, login-submit, login-error

# Product list
search-input, category-filter, product-count, add-product-btn, empty-state
loading-indicator, error-message

# Product rows (id = product UUID)
product-row-{id}, product-name-{id}, product-price-{id}, product-image-{id}
edit-product-{id}, delete-product-{id}

# Confirm dialog
confirm-delete, cancel-delete

# Form fields
field-name, field-category, field-price, field-description
field-image-url, field-image-upload
submit-product-form, form-error, form-success
```

---

## Playwright Config (`playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }], ['dot']],
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  expect: { timeout: 5000 },

  projects: [
    { name: 'setup', testDir: './e2e', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    // firefox, webkit, mobile-chrome — all load storageState
  ],

  webServer: [
    {
      command: 'dotnet run --project backend/ProductCatalog.Api.csproj --launch-profile http',
      url: 'http://localhost:5000/api/products',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

---

## Auth Setup (`e2e/auth.setup.ts`)

Logs in via UI once, saves `storageState` to `e2e/.auth/user.json`. All browser projects load
this file — no re-login per test.

---

## Page Object Models — Design Rules

1. Locators are **getter properties** (lazy, no stale refs)
2. Actions named after **user intent**, not DOM events
3. **No assertions in POMs** — POMs enable action, tests verify outcome
4. Constructor takes `Page` only
5. Complex multi-step compound actions return `void`

---

## Custom Fixtures (`e2e/fixtures/product.fixture.ts`)

```typescript
export const test = base.extend<{
  productsPage: ProductsPage;
  productFormPage: ProductFormPage;
  createdProduct: Product;      // API-created, auto-deleted after test
  authenticatedRequest: APIRequestContext;
}>({
  productsPage: async ({ page }, use) => use(new ProductsPage(page)),
  productFormPage: async ({ page }, use) => use(new ProductFormPage(page)),
  createdProduct: async ({}, use) => {
    const product = await createProductViaApi({ name: `Product-${Date.now()}`, ... });
    await use(product);
    await deleteProductViaApi(product.id).catch(() => {});
  },
  authenticatedRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'http://localhost:5000',
      extraHTTPHeaders: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    await use(ctx);
    await ctx.dispose();
  },
});
```

---

## All 12 Test Spec Files — Coverage Map

| File | Concepts Covered |
|---|---|
| `01-navigation.spec.ts` | goto, waitForURL, goBack/Forward, reload, URL params |
| `02-locators.spec.ts` | getByRole, getByTestId, getByLabel, getByText, chaining, filtering |
| `03-assertions.spec.ts` | toBeVisible, toHaveText, toHaveCount, toHaveURL, soft assertions |
| `04-interactions.spec.ts` | fill, type, press, selectOption, hover, file upload, drag-drop |
| `05-network.spec.ts` | waitForResponse, route.fulfill, route.abort, proxy+mutate |
| `06-auth-storage-state.spec.ts` | storageState, login/logout, protected routes, cookie inspection |
| `07-page-object-model.spec.ts` | POM design, lazy getters, no-assertions-in-POMs, side-by-side comparison |
| `08-fixtures.spec.ts` | fixture lifecycle, scope, composition, worker-scoped, override |
| `09-parallel-isolation.spec.ts` | fullyParallel, isolation, unique data, test.describe.serial |
| `10-anti-patterns.spec.ts` | 12 anti-patterns with ❌ wrong / ✅ correct side-by-side |
| `11-advanced.spec.ts` | multi-tab, multi-user, evaluate, parameterized, custom matchers, mobile, tags |
| `12-api-testing.spec.ts` | APIRequestContext, full CRUD via API, auth headers, 400/401/404 |

---

## Implementation Order

1. **Backend** — .NET 9 scaffold, model, in-memory store, all endpoints, auth, CORS, fixed port 5000
2. **Frontend** — Vite scaffold, auth context, API client, all components with `data-testid`, search, routing
3. **Playwright infra** — root `package.json`, `playwright.config.ts`, `global-setup.ts`, `auth.setup.ts`, helpers
4. **POMs + Fixtures** — `LoginPage.ts`, `ProductsPage.ts`, `ProductFormPage.ts`, `product.fixture.ts`
5. **Test specs** — implement all 12 spec files in order (01 → 12)
6. **CI** — `.github/workflows/playwright.yml`
7. **README + Documentation**

---

## Verification Checklist

- `npm test` from clean clone → all spec files pass, 4 browser projects, no manual server startup
- `npm run test:ui` → Playwright UI opens, all tests listed and runnable
- `npm run test:headed` → browser visibly performs CRUD, login, search, upload
- `CI=true npm test` → passes with `retries:1`, `workers:2`, `forbidOnly:true`
- `npx playwright test 05-network.spec.ts --project=chromium` → mocked tests pass
- `npx playwright test 12-api-testing.spec.ts` → API tests pass without a browser
- `npx playwright test --grep @smoke` → runs only tagged-slow tests
- `npx playwright show-report` → HTML report with screenshots/video on failure
