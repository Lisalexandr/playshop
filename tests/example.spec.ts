import { test, expect } from '@playwright/test';

const { TEST_USER_1, TEST_PASSWORD_1 } = process.env;
if (!TEST_USER_1 || !TEST_PASSWORD_1) throw new Error('Missing creds in .env');

test.beforeEach(async ({ request }) => {
  // Restore products, users and orders to the seed state before every test.
  await request.post('/api/test/reset');
});

test('home page shows categories and featured products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to PlayShop' })).toBeVisible();
  await expect(page.getByTestId('category-tile')).toHaveCount(5);
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});

test('user can sign in and sees their name in the header', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER_1);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD_1);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByTestId('user-menu-button')).toHaveText(/Hi, Alice/);
});

test('guest can add a product to the cart', async ({ page }) => {
  await page.goto('/products?category=books');
  const card = page.getByTestId('product-card').filter({ hasText: 'The Midnight Garden' });
  await card.getByRole('button', { name: 'Add to cart' }).click();

  await expect(page.getByTestId('cart-count')).toHaveText('1');
  await page.getByRole('link', { name: /Cart/ }).click();
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('summary-subtotal')).toHaveText('$14.99');
});
