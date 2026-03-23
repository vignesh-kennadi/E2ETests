import { expect, test } from '../fixtures';

/**
 * 02 — Locator Strategies
 *
 * This file is a REFERENCE CARD for every Playwright locator type.
 * Run this file to see all strategies in action against the real app.
 *
 * DECISION TREE — which locator to use:
 *   1. Is there a semantic role? → getByRole (best for accessibility)
 *   2. Is there a data-testid?   → getByTestId (stable, survives refactors)
 *   3. Is there a <label>?       → getByLabel
 *   4. Is there visible text?    → getByText
 *   5. Is there a placeholder?   → getByPlaceholder
 *   6. Is there an alt text?     → getByAltText
 *   7. Is there a title attr?    → getByTitle
 *   8. Is nth position stable?   → nth() (use only when order is meaningful)
 *   9. NEVER: CSS classes, CSS selector chains, XPath
 */

test.describe('Role-based locators (PREFERRED)', () => {
  test('getByRole: button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // The most semantic locator — matches the accessibility role
    const addBtn = page.getByRole('button', { name: 'Add Product' });
    await expect(addBtn).toBeVisible();
  });

  test('getByRole: heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product Catalog');
    // You can also match by name:
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible();
  });

  test('getByRole: row in a table', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Find a row by visible text in that row
    await expect(page.getByRole('row', { name: /Laptop Pro/ })).toBeVisible();
  });

  test('getByRole: link', async ({ page }) => {
    await page.goto('/products/new');
    // Cancel is a button, not a link — shows the importance of role accuracy
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('getByRole: textbox', async ({ page }) => {
    await page.goto('/products/new');
    // Matches <input> elements with an accessible name (from <label> or aria-label)
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Category' })).toBeVisible();
  });
});

test.describe('Test ID locators (STABLE)', () => {
  test('getByTestId finds elements by data-testid attribute', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // data-testid survives CSS refactors, component renames, and layout changes
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
    await expect(page.getByTestId('search-input')).toBeVisible();
    await expect(page.getByTestId('category-filter')).toBeVisible();
  });
});

test.describe('Semantic attribute locators', () => {
  test('getByLabel finds inputs by their associated <label>', async ({ page }) => {
    await page.goto('/products/new');
    // <label for="field-name">Name</label> + <input id="field-name">
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByLabel('Price (USD)')).toBeVisible();
  });

  test('getByText finds elements by visible text content', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Use for static text that won't change — not for dynamic content
    await expect(page.getByText('Laptop Pro')).toBeVisible();
    // 'Electronics' appears in both the dropdown option AND a table cell.
    // Use getByRole with an exact name to target the visible table cell only.
    await expect(page.getByRole('cell', { name: 'Electronics' })).toBeVisible();
  });

  test('getByPlaceholder finds inputs by placeholder text', async ({ page }) => {
    await page.goto('/');
    // Useful when there is no label but a meaningful placeholder
    await expect(page.getByPlaceholder('Search products...')).toBeVisible();
  });

  test('getByAltText finds images by their alt attribute', async ({ page, createdProduct }) => {
    // Products with imageUrl render: <img alt="Product Name" />
    // createdProduct doesn't have an imageUrl, so use the seeded ones
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // The seeded "Laptop Pro" has imageUrl set
    const img = page.getByAltText('Laptop Pro');
    await expect(img).toBeVisible();
  });

  test('getByTitle finds elements by title attribute', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Edit and Delete buttons have title attributes in ProductCard.tsx
    await expect(page.getByTitle('Edit product').first()).toBeVisible();
    await expect(page.getByTitle('Delete product').first()).toBeVisible();
  });
});

test.describe('Filtering and chaining locators', () => {
  test('chain locators: find a button within a specific row', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Find the Edit button within the "Laptop Pro" row specifically
    // This avoids ambiguity when multiple rows have Edit buttons
    const laptopRow = page.getByRole('row', { name: /Laptop Pro/ });
    await expect(laptopRow.getByTitle('Edit product')).toBeVisible();
  });

  test('filter: find list items that contain specific text', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // Filter rows to only those with "Electronics" visible
    const electronicsRows = page.locator('[data-testid^="product-row-"]').filter({ hasText: 'Electronics' });
    await expect(electronicsRows).toHaveCount(1);
  });

  test('locator.or(): match either of two locators', async ({ page }) => {
    await page.goto('/products/new');
    // Either the submit button OR the cancel button should be visible
    const submitOrCancel = page.getByTestId('submit-product-form').or(page.getByRole('button', { name: 'Cancel' }));
    await expect(submitOrCancel.first()).toBeVisible();
  });

  test('nth(): use when position is stable and meaningful', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('loading-indicator').waitFor({ state: 'hidden' });
    // The header row is row 0, first data row is row 1
    // Use nth() only when the ORDER genuinely matters — not as a shortcut
    const firstDataRow = page.getByRole('row').nth(1);
    await expect(firstDataRow).toBeVisible();
  });
});

test.describe('What NOT to use (fragile locators)', () => {
  test('demonstrates why CSS classes are fragile', async ({ page }) => {
    await page.goto('/');
    // ❌ FRAGILE — CSS class changes during a styling refactor break this test:
    // const btn = page.locator('.add-btn');
    //
    // ✅ STABLE — survives any styling change:
    const btn = page.getByTestId('add-product-btn');
    await expect(btn).toBeVisible();

    // The test itself passes with the good locator; the bad one is shown as a comment.
    // See 10-anti-patterns.spec.ts for the full anti-patterns guide.
  });
});
