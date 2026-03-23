# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Playwright E2E testing reference project** used for learning and demonstrating testing patterns. It consists of three parts:
- **Playwright tests** (root) — 13 test spec files covering progressive topics
- **React frontend** (`frontend/`) — Vite + React 18 + TypeScript on port 5173
- **.NET 10 backend** (`backend/`) — ASP.NET Core Minimal API with in-memory store on port 5000

## Commands

### Running E2E Tests (from root)
```bash
npm test                    # Run all tests headlessly
npm run test:ui             # Interactive UI mode (recommended for development)
npm run test:headed         # Watch the browser run tests
npm run test:debug          # Step through with Playwright Inspector
npm run test:report         # View HTML report after a run

# Run a single test file
npx playwright test e2e/tests/01-navigation.spec.ts

# Run tests matching a pattern
npx playwright test --grep "should search"

# Run only in one browser
npx playwright test --project=chromium
```

### Frontend (from `frontend/`)
```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint
```

### Backend (from `backend/`)
```bash
dotnet run --project ProductCatalog.Api.csproj   # Start API (port 5000)
dotnet build                                      # Build only
```

> **Note:** `npm test` automatically starts both servers via Playwright's `webServer` config — you don't need to start them manually for tests.

## Architecture

### Test Execution Flow
1. **Global setup** (`e2e/global-setup.ts`) — runs once: resets DB and seeds 3 products via API
2. **Auth setup** (`e2e/auth.setup.ts`) — runs once per browser: logs in as `admin`/`password`, saves browser state to `e2e/.auth/user.json`
3. **Tests** — each test starts already authenticated; parallel execution with isolated data

### Test Data Strategy
- Create test data directly via API (helpers in `e2e/helpers/api.ts`), not through the UI
- Use unique names per test to avoid parallel conflicts (e.g., `Product-${Date.now()}`)
- The `createdProduct` fixture in `e2e/fixtures/product.fixture.ts` handles create + cleanup automatically

### Page Object Models
Located in `e2e/pages/`: `LoginPage.ts`, `ProductsPage.ts`, `ProductFormPage.ts`. Custom fixtures in `e2e/fixtures/product.fixture.ts` wire these up for tests.

### Backend Test Support
The backend exposes `/api/test/reset` and `/api/test/seed` endpoints (development only) for test setup. These are called by `global-setup.ts` and the `resetProductStore()`/`seedProducts()` helpers.

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `http://localhost:5173` | Playwright base URL |
| `API_BASE_URL` | `http://localhost:5000` | Backend URL for test helpers |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend URL used by React app |

Defined in `.env.test` (root) and `frontend/.env` (frontend).

## Key Patterns Used

- **Storage state auth** — authentication performed once and reused across tests via saved browser state
- **Fixtures** — custom Playwright fixtures compose POMs and test data lifecycle
- **Parallel isolation** — `fullyParallel: true`; tests use unique identifiers to avoid data collisions
- **Network interception** — `page.route()` used in `05-network.spec.ts` for mocking/modifying requests
- **API testing** — `request` fixture used in `12-api-testing.spec.ts` for direct HTTP assertions

## CI

GitHub Actions workflow at `.github/workflows/playwright.yml` runs on push to `main`/`develop` and PRs to `main`. Sets `CI=true` which triggers: 1 retry per test, max 2 workers, and `forbidOnly` (prevents accidental `test.only` commits).
