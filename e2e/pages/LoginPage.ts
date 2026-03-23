import type { Page } from '@playwright/test';

/**
 * Page Object Model for the Login page.
 *
 *  — POM design rules:
 * 1. Locators are GETTERS (lazy) — evaluated at call time, never stale.
 * 2. Actions are named after USER INTENT ("loginAs") not DOM events ("clickSubmitButton").
 * 3. NO assertions — assertions belong in test specs, not POMs.
 * 4. Constructor takes only `Page` — keeps the POM portable and testable.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  // --- Locators (getters = lazy, always fresh) ---

  get usernameInput() { return this.page.getByTestId('login-username'); }
  get passwordInput() { return this.page.getByTestId('login-password'); }
  get submitButton()  { return this.page.getByTestId('login-submit'); }
  get errorMessage()  { return this.page.getByTestId('login-error'); }
  get heading()       { return this.page.getByRole('heading', { name: 'Sign In' }); }

  // --- Actions ---

  async goto() {
    await this.page.goto('/login');
  }

  async loginAs(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAsAdmin() {
    await this.loginAs('admin', 'password');
  }
}
