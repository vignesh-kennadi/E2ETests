import type { Page } from '@playwright/test';

export interface ProductFormData {
  name?: string;
  category?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
}

/**
 * Page Object Model for the Product form page ("/products/new" and "/products/:id/edit").
 *
 * One POM handles both create and edit modes because the DOM structure is identical.
 */
export class ProductFormPage {
  constructor(private readonly page: Page) {}

  // --- Locators ---

  get pageTitle()        { return this.page.getByRole('heading'); }
  get nameInput()        { return this.page.getByTestId('field-name'); }
  get categoryInput()    { return this.page.getByTestId('field-category'); }
  get priceInput()       { return this.page.getByTestId('field-price'); }
  get descriptionInput() { return this.page.getByTestId('field-description'); }
  get imageUrlInput()    { return this.page.getByTestId('field-image-url'); }
  get imageUpload()      { return this.page.getByTestId('field-image-upload'); }
  get submitButton()     { return this.page.getByTestId('submit-product-form'); }
  get formError()        { return this.page.getByTestId('form-error'); }
  get cancelButton()     { return this.page.getByRole('button', { name: 'Cancel' }); }

  // --- Navigation ---

  async gotoCreate() {
    await this.page.goto('/products/new');
  }

  async gotoEdit(id: string) {
    await this.page.goto(`/products/${id}/edit`);
  }

  // --- Actions ---

  /**
   * Fill only the provided fields — leave others untouched.
   * Useful for partial updates in edit mode.
   */
  async fillForm(data: ProductFormData) {
    if (data.name !== undefined)        await this.nameInput.fill(data.name);
    if (data.category !== undefined)    await this.categoryInput.fill(data.category);
    if (data.price !== undefined)       await this.priceInput.fill(String(data.price));
    if (data.description !== undefined) await this.descriptionInput.fill(data.description);
    if (data.imageUrl !== undefined)    await this.imageUrlInput.fill(data.imageUrl);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** Fill and immediately submit — the most common test action. */
  async fillAndSubmit(data: ProductFormData) {
    await this.fillForm(data);
    await this.submit();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async uploadImage(filePath: string) {
    await this.imageUpload.setInputFiles(filePath);
  }
}
