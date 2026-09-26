import { expect, test } from '@playwright/test';

test('a tela de login sobe e mostra o formulário', async ({ page }) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'Entre na sua conta' }),
  ).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
});
