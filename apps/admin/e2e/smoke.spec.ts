import { expect, test } from '@playwright/test';

test('a tela de login do admin sobe e mostra o formulário', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'Entrar no painel' }),
  ).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
});
