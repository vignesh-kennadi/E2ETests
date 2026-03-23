import { defineConfig, devices } from '@playwright/test';

/**
 * PLAYWRIGHT CONFIGURATION — Teaching Reference
 *
 * This file controls every aspect of how Playwright runs tests.
 * Read the comments carefully — each setting has a "why" explanation.
 */
export default defineConfig({
  // Where Playwright looks for test files
  testDir: './e2e/tests',

  // Run tests within each file in parallel (each test gets its own browser context)
  fullyParallel: true,

  // Catch .only / .skip.only accidentally left in code during CI runs.
  // Prevents the situation where a developer commits test.only and the full
  // suite stops running in the pipeline.
  forbidOnly: !!process.env.CI,

  // Retry failed tests ONCE to absorb transient flakiness from shared backend state.
  // With fullyParallel: true and a single in-memory store, parallel tests can
  // occasionally race on resets/seeds — one retry is enough to recover.
  retries: 1,

  // Limit workers in CI to avoid resource contention on shared runners.
  // Locally: Playwright uses available CPU cores automatically.
  workers: process.env.CI ? 2 : undefined,

  // Multiple reporters:
  // - html: visual report you can browse after a run
  // - json: machine-readable, useful for dashboard integrations
  // - junit: XML format consumed by Jenkins, GitHub Actions test summaries
  // - dot: compact terminal output
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['dot'],
  ],

  // Global setup: runs ONCE before any test starts (not before each test).
  // Use this for: seeding test data, verifying infrastructure is up.
  // For per-test setup, use custom fixtures instead.
  globalSetup: './e2e/global-setup.ts',

  use: {
    // baseURL means tests can use page.goto('/') instead of full URLs.
    // Override with BASE_URL env var in CI for non-local environments.
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',

    // Collect a Playwright trace on the FIRST retry.
    // Traces are zip files you open with: npx playwright show-trace trace.zip
    // They contain: screenshots, DOM snapshots, network logs, console messages.
    // Collecting on every run is expensive; on-first-retry is the sweet spot.
    trace: 'on-first-retry',

    // Screenshot only on failure — attached to the HTML report for debugging.
    screenshot: 'only-on-failure',

    // Record video on first retry — invaluable for CI debugging.
    video: 'on-first-retry',

    // Per-action timeout: how long a single action (click, fill, etc.) waits.
    // Default is no limit. Setting 10s catches hung actions quickly.
    actionTimeout: 10_000,

    // Navigation timeout: how long page.goto() waits for the page to load.
    navigationTimeout: 30_000,
  },

  // Web-first assertions (expect.toBeVisible etc.) retry until this timeout.
  expect: { timeout: 5000 },

  projects: [
    // --- Auth setup project ---
    // Runs auth.setup.ts BEFORE any other project that depends on it.
    // Saves browser storage state (localStorage, cookies) to a file.
    // All downstream projects load that file — zero logins per test.
    {
      name: 'setup',
      testDir: './e2e',
      testMatch: /auth\.setup\.ts/,
    },

    // --- Main browser projects ---
    // Each loads the saved auth state so tests start already logged in.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // NOTE: a separate no-auth project is intentionally omitted.
    // Unauthenticated scenarios are covered inline in 06-auth-storage-state.spec.ts
    // using noAuthTest.describe with storageState: { cookies: [], origins: [] }.
    // This keeps all auth/unauth tests together in one file and avoids running the
    // same tests twice in a project that would fail on auth-required actions.
  ],

  // webServer: Playwright starts these processes BEFORE running tests
  // and tears them down afterward. No manual server startup needed.
  //
  // Key settings:
  // - url: Playwright polls this URL until it responds (server is ready)
  // - reuseExistingServer: reuse a running server locally (faster iteration),
  //   always start fresh in CI (prevents stale state)
  // - timeout: how long to wait for the server to start
  webServer: [
    {
      // Start the .NET backend
      command: 'dotnet run --project backend/ProductCatalog.Api.csproj --launch-profile http',
      url: 'http://localhost:5000/api/products',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Start the Vite frontend
      command: 'npm run dev --prefix frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
