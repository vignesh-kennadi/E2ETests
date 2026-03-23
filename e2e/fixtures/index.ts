/**
 * Barrel export — tests import from one place:
 *   import { test, expect } from '../fixtures';
 *
 * This makes it easy to add more fixtures later without updating every test file.
 */
export { expect, test } from './product.fixture';
