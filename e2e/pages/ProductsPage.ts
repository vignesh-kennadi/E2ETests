import type { Page } from '@playwright/test';

/**
 * Page Object Model for the Products listing page ("/").
 *
 *  — Why getters instead of constructor properties?
 *
 * BAD (constructor assignment):
 *   this.heading = page.locator('h1');  // ← locator created once at construction
 *
 * GOOD (getter):
 *   get heading() { return this.page.locator('h1'); }  // ← evaluated each time
 *
 * Both work because Playwright locators are lazy. But the getter makes it
 * EXPLICIT that the locator is evaluated fresh on every call — no confusion
 * about whether a stale handle might be reused.
 */
export class ProductsPage {
  constructor(private readonly page: Page) {}

  // --- Locators ---

  get heading()          { return this.page.getByRole('heading', { name: 'Product Catalog' }); }
  get addProductButton() { return this.page.getByTestId('add-product-btn'); }
  get logoutButton()     { return this.page.getByTestId('logout-btn'); }
  get loginLink()        { return this.page.getByTestId('login-link'); }
  get loadingIndicator() { return this.page.getByTestId('loading-indicator'); }
  get errorMessage()     { return this.page.getByTestId('error-message'); }
  get emptyState()       { return this.page.getByTestId('empty-state'); }
  get productCount()     { return this.page.getByTestId('product-count'); }
  get searchInput()      { return this.page.getByTestId('search-input'); }
  get categoryFilter()   { return this.page.getByTestId('category-filter'); }

  // Rows: match any data-testid starting with "product-row-"
  get productRows() { return this.page.locator('[data-testid^="product-row-"]'); }

  // Per-product locators (by ID)
  productRow(id: string)    { return this.page.getByTestId(`product-row-${id}`); }
  productName(id: string)   { return this.page.getByTestId(`product-name-${id}`); }
  productPrice(id: string)  { return this.page.getByTestId(`product-price-${id}`); }
  productImage(id: string)  { return this.page.getByTestId(`product-image-${id}`); }
  editButton(id: string)    { return this.page.getByTestId(`edit-product-${id}`); }
  deleteButton(id: string)  { return this.page.getByTestId(`delete-product-${id}`); }

  // Dialog locators
  get confirmDeleteButton() { return this.page.getByTestId('confirm-delete'); }
  get cancelDeleteButton()  { return this.page.getByTestId('cancel-delete'); }
  get confirmDialog()       { return this.page.getByRole('dialog'); }

  // --- Actions ---

  async goto() {
    await this.page.goto('/');
  }

  /** Wait until the loading spinner disappears — meaning products have loaded. */
  async waitForProductsLoaded() {
    await this.loadingIndicator.waitFor({ state: 'hidden' });
  }

  async clickAddProduct() {
    await this.addProductButton.click();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption(category);
  }

  /**
   * Deletes a product by ID: clicks the delete button, waits for the dialog,
   * then confirms. This is a compound action named after USER INTENT.
   *
   * : compound actions belong in the POM.
   * Tests should say "delete this product" — not "click delete, wait for dialog, click confirm".
   */
  async deleteProduct(id: string) {
    await this.deleteButton(id).click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.confirmDeleteButton.click();
    await this.confirmDialog.waitFor({ state: 'hidden' });
  }

  async cancelDelete(id: string) {
    await this.deleteButton(id).click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.cancelDeleteButton.click();
    await this.confirmDialog.waitFor({ state: 'hidden' });
  }

  async clickEdit(id: string) {
    await this.editButton(id).click();
  }

  async logout() {
    await this.logoutButton.click();
  }
}
