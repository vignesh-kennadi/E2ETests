# Lessons Learned — Playwright E2E Guide

This document captures the problems encountered during implementation and the approaches tried
before arriving at the final working solution. It's a living record of *why* things are the
way they are — useful for anyone maintaining or extending this repo.

---

## 1. Auth Setup Project Couldn't Find `auth.setup.ts`

### Problem
```
No tests found matching: /auth\.setup\.ts/
```
The `setup` project in `playwright.config.ts` looked for `auth.setup.ts` inside `testDir`
(`./e2e/tests`), but the file lives at `./e2e/auth.setup.ts` (one level up).

### Approaches Tried
- Moving `auth.setup.ts` into `e2e/tests/` — broke import paths.
- Changing `testMatch` pattern — still used the project's default `testDir`.

### Solution
Add `testDir: './e2e'` directly on the `setup` project to override the global `testDir`:
```typescript
{ name: 'setup', testDir: './e2e', testMatch: /auth\.setup\.ts/ }
```

### Lesson
Each project in `playwright.config.ts` can have its own `testDir`. The global `testDir` is
only a default. Auth setup files typically live outside the main test directory.

---

## 2. `storageState: undefined` Does Not Clear Project-Level Auth

### Problem
The `noAuthTest.use({ storageState: undefined })` call inside a describe block had no effect
— tests still loaded the project-level `e2e/.auth/user.json` and ran as authenticated.

### Approaches Tried
- `noAuthTest.use({ storageState: undefined })` — silently ignored; inherits project default.
- Creating a separate `no-auth` project in playwright.config.ts — worked, but then the same
  spec file runs twice (once with auth, once without), causing auth-requiring tests to fail
  in the no-auth run.

### Solution
Use an empty storageState object to actually clear cookies and origins:
```typescript
noAuthTest.use({ storageState: { cookies: [], origins: [] } });
```
Also ensure the `use()` call is scoped to the same test object as the `describe`:
```typescript
// ❌ WRONG: different test objects
const noAuthTest = test as typeof base;
test.describe(...);
noAuthTest.use(...); // not in scope

// ✅ CORRECT: same test object owns both describe and use
noAuthTest.describe('Unauthenticated', () => {
  noAuthTest.use({ storageState: { cookies: [], origins: [] } });
  noAuthTest('...', async ({ page }) => { ... });
});
```

### Lesson
`undefined` does not override a non-undefined value in Playwright fixture overrides. To clear
cookies and localStorage, pass `{ cookies: [], origins: [] }` explicitly.

---

## 3. Parallel Store Resets Race With Each Other

### Problem
With `fullyParallel: true`, tests from different spec files run concurrently. Many spec files
have `beforeEach` hooks that call `resetProductStore()` (a nuclear wipe of all products).
These resets fire mid-test in other workers, causing:
- Products created by one test to disappear before assertions
- Count assertions to see unexpected numbers (too few or too many products)
- Delete operations to return 404 (product already gone), leaving the row cached in the UI

### Approaches Tried
1. **Hard-coded counts** (`toHaveCount(3)`) — fragile; any parallel activity changes the count.
2. **`getAllProducts()` before navigation** — count returned by API and count shown in UI can
   diverge if a reset fires between the API call and the page load.
3. **`beforeEach` resets in more describe blocks** — made things worse; more resets = more races.
4. **Wrapping test files in `test.describe.serial`** — prevents intra-file races but different
   files still run concurrently in separate workers.

### Solutions (multiple, applied together)
- **`waitForResponse('**/api/products')` before `page.goto()`** — captures the exact API
  response the page renders from, then assert `products.length` from that same response.
  ```typescript
  const responsePromise = page.waitForResponse('**/api/products');
  await page.goto('/');
  const apiProducts = await (await responsePromise).json();
  await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(apiProducts.length);
  ```
- **Read product IDs from DOM after navigation**, not from API before navigation — so you always
  act on what's actually rendered.
  ```typescript
  const rowTestId = await productsPage.productRows.first().getAttribute('data-testid');
  const targetId = rowTestId!.replace('product-row-', '');
  ```
- **`countBefore + 1` instead of hard-coded counts** for create-then-count tests.
- **Reload after delete** to get fresh server state (avoids stale UI cache after 404 deletes).
- **`retries: 1`** — absorbs the remaining rare races that slip through.

### Lesson
Shared mutable state (an in-memory backend) + `fullyParallel: true` is inherently racy. Design
tests to observe state synchronously with the API response they render from, not from a
separately timed API call. Avoid hard-coded counts; prefer `n + 1` or response-derived counts.

---

## 4. `test.describe.serial` Across Files Does Not Help

### Problem
Wrapping all tests in a spec file with `test.describe.serial` forces sequential execution
**within** that file. But Playwright still runs the file's single worker **in parallel** with
workers for other spec files.

So `07-page-object-model.spec.ts` (serial, worker A) and `11-advanced.spec.ts` (parallel,
workers B/C) still execute concurrently, and 11's `beforeEach` resets interfere with 07's
in-progress UI actions.

### Solution
Combined approach: serial where it matters (07 outer serial), `waitForResponse` for count
assertions, `retries: 1` for the residual flakiness that can't be prevented without `workers: 1`.

### Lesson
`test.describe.serial` does not isolate a file from other files. For true isolation across
files, you need `workers: 1`, which defeats the purpose of parallelism demos. Accept `retries`
as the safety net.

---

## 5. `beforeEach` Reset Fires Between Fixture Setup and Test Body

### Problem
Playwright's fixture setup happens **before** `beforeEach` runs. So:
1. Fixture creates a product (e.g., `createdProduct`)
2. `beforeEach` in another describe block fires a `resetProductStore()` call
3. The product from step 1 is gone before the test body runs

This caused tests using the `createdProduct` fixture to find their product missing.

### Solution
Remove `resetProductStore()` from `beforeEach` hooks in describe blocks that coexist with
fixture-using tests. Use `waitForResponse` to make assertions resilient to whatever state the
store is actually in.

### Lesson
Fixture lifecycle and `beforeEach` hooks don't interleave — fixtures run first, then
`beforeEach`. But if `beforeEach` in a *parallel* test resets the store, fixtures from other
workers are affected. Never reset global state in `beforeEach` if any parallel test depends
on persistent state.

---

## 6. Dynamic `import()` Inside `beforeEach` Doesn't Work

### Problem
```typescript
test.beforeEach(async () => {
  const { resetProductStore } = await import('../helpers/api'); // ❌
  await resetProductStore();
});
```
This caused `is not a function` errors because Playwright's module system doesn't support
dynamic imports in hook callbacks the same way Node.js does in this context.

### Solution
Always use static imports at the top of the file:
```typescript
import { resetProductStore, seedProducts, SEED_PRODUCTS } from '../helpers/api';
```

### Lesson
Use static imports in Playwright test files. Dynamic imports inside hooks are unreliable.

---

## 7. `noAuthTest.use()` Scope Must Match the Test Object

### Problem
```typescript
const noAuthTest = test as typeof base;
test.describe('Unauthenticated', () => {
  noAuthTest.use({ storageState: { cookies: [], origins: [] } }); // ❌ wrong scope
});
```
The `use()` call must be inside a describe block belonging to **the same test object** as the
`use()`. Mixing `test.describe` and `noAuthTest.use` produced no effect.

### Solution
```typescript
noAuthTest.describe('Unauthenticated', () => {
  noAuthTest.use({ storageState: { cookies: [], origins: [] } }); // ✅ same object
  noAuthTest('...', async ({ page }) => { ... });
});
```

### Lesson
In Playwright, `test.use()` is scoped to the test object it is called on. If you use a
different test object for `describe`, `use()` from the original object has no effect inside.

---

## 8. Cross-Platform Keyboard Shortcuts

### Problem
`input.press('Control+a')` selected text on Windows/Linux but not on macOS (where it's Cmd+A).
The test was authored on macOS and passed locally but would fail on Linux CI.

### Solution
Use `ControlOrMeta` which Playwright maps to `Ctrl` on Windows/Linux and `Cmd` on macOS:
```typescript
await input.press('ControlOrMeta+a');
await input.press('Backspace');
```

### Lesson
Always use `ControlOrMeta` for keyboard shortcuts that should work cross-platform.
`Control` alone will fail on macOS CI runners.

---

## 9. Native Browser Form Validation Blocks React Handlers

### Problem
Submitting a form with `price: -1` triggered the browser's native `<input type="number">`
validation (which blocks submission), so the React `onSubmit` handler never fired.
The test waited for a `form-error` element that never appeared.

### Solution
Add `noValidate` to the `<form>` element:
```tsx
<form onSubmit={handleSubmit} noValidate>
```
This lets React's own validation run (which shows the correct test-visible error message)
instead of the browser intercepting the submit.

### Lesson
When testing custom form validation, add `noValidate` to let the framework's validation
fire. Without it, browser native validation intercepts the submit event invisibly.

---

## 10. `file.setInputFiles([])` Must Clear the Displayed Filename

### Problem
After calling `setInputFiles([])` (which clears the file input), the displayed filename text
(`imageFileName` state) wasn't reset. The test expected an empty filename but saw the old one.

### Solution
In the `handleFileChange` handler, add an `else` branch:
```tsx
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setImageFileName(file.name);
    setImageUrl(`/uploads/${file.name}`);
  } else {
    setImageFileName(''); // handles setInputFiles([]) in tests
  }
};
```

### Lesson
When testing file upload clear operations, the UI component must explicitly handle the empty
files case. `setInputFiles([])` fires a `change` event with `files` being an empty FileList.

---

## 11. Multi-Tab Test: React Router `navigate()` vs `<a href>`

### Problem
The test tried to open a new tab by clicking a link with `Cmd/Ctrl` modifier:
```typescript
await page.getByTestId('add-product-btn').click({ modifiers: ['Meta'] });
```
This navigated the *current* tab instead of opening a new one because the button uses React
Router's `navigate()` (not an `<a href>`). Browser modifier-click behavior only opens new tabs
for anchor tags.

### Solution
For `context.waitForEvent('page')` demos, use a link that actually creates a new tab, or
programmatically open a new page:
```typescript
const newPage = await context.newPage();
await newPage.goto('/login');
```

### Lesson
`Cmd/Ctrl+click` only opens new tabs for `<a href>` elements. React Router `navigate()` calls
always happen in the current tab regardless of modifiers. Use `context.newPage()` for
programmatic multi-tab demos.

---

## 12. Visual Regression Snapshots Go Stale After Store Resets

### Problem
After adding `beforeEach` resets to test suites, the product list content changed (different
product names/prices per seed) making the visual snapshot mismatch the new baseline.

### Solution
Regenerate snapshots after any content change:
```bash
npx playwright test 11-advanced.spec.ts --update-snapshots
```

### Lesson
Visual regression snapshots must be regenerated whenever the rendered content changes.
Commit snapshot files alongside test code changes.

---

## 13. `Record<string, never>` vs `object` for Worker-Scoped Fixture Types

### Problem
```typescript
// ❌ TypeScript error: type mismatch
const test = base.extend<Record<string, never>>({ ... });
```

### Solution
```typescript
// ✅ Generic object type
const test = base.extend<object>({ ... });
```

### Lesson
For Playwright fixture extension with no additional fixture types, use `object` as the first
generic parameter, not `Record<string, never>`.

---

## 14. `base.beforeAll` Inside `test.describe.serial` — Mixed Test Objects

### Problem
Using `base.beforeAll` inside a block declared with `test.describe.serial` caused the
`beforeAll` hook to not be associated with the correct describe block, so `serialProductId`
was never set and subsequent tests failed.

### Solution
Use the *same* test object (`test`) for both `describe.serial` and `beforeAll`:
```typescript
test.describe.serial('serial tests', () => {
  test.beforeAll(async () => { ... }); // ✅ same 'test' object
  test('step 1', ...);
});
```

### Lesson
All hooks (`beforeAll`, `beforeEach`, `afterAll`, `afterEach`) must belong to the same test
object as the `describe` block they're in. Mixing test objects (e.g., `base.beforeAll` inside
`test.describe`) breaks hook association.

---

## 15. The `no-auth` Project Ran Auth-Requiring Tests Without Auth

### Problem
A `no-auth` project was added to `playwright.config.ts` to cover unauthenticated scenarios.
Its `testMatch` included `06-auth-storage-state.spec.ts`. But that file contains BOTH
authenticated and unauthenticated tests. Running the whole file without auth caused the
"Authenticated state" describe block to fail.

### Solution
Remove the `no-auth` project entirely. The unauthenticated scenarios in
`06-auth-storage-state.spec.ts` are already covered by `noAuthTest.describe` blocks with
`noAuthTest.use({ storageState: { cookies: [], origins: [] } })` — these run correctly
within the main chromium project without needing a separate project.

### Lesson
Mixing auth and unauth tests in one file is manageable with `test.use()` scoped to the right
describe block. A separate project that runs the whole file without auth is too coarse-grained.

---

## Summary: What Works Well in This Architecture

| Pattern | Why It Works |
|---|---|
| `waitForResponse` before count assertions | Sync UI count with the API payload the page rendered from |
| Read IDs from DOM after navigation | Avoids the gap between API response and DOM update |
| `countBefore + 1` for create tests | Resilient to whatever products exist before the test |
| `retries: 1` globally | Absorbs rare races that can't be deterministically prevented |
| Outer `test.describe.serial` per file | Prevents intra-file races; still allows cross-file parallelism |
| `beforeEach` guard in serial blocks | Recreates products deleted by parallel resets |
| `noValidate` on forms | Lets framework validation run instead of browser native |
| `{ cookies: [], origins: [] }` to clear auth | Actually clears state; `undefined` does not |
