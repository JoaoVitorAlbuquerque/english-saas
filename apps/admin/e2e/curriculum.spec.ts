import { expect, test, type Page } from '@playwright/test';

/**
 * O painel de conteúdo no navegador de verdade, contra o MSW do build de
 * teste: desktop, tema claro e escuro. O que o Vitest (jsdom) não vê: a
 * rolagem horizontal da página e o tamanho real do quadro do preview.
 */

const SCENARIOS = [
  { name: 'desktop, claro', scheme: 'light' },
  { name: 'desktop, escuro', scheme: 'dark' },
] as const;

const SCREENS = [
  { path: '/conteudo', heading: 'Conteúdo' },
  { path: '/conteudo/personagens', heading: 'Personagens' },
  { path: '/conteudo/licoes/lesson-1', heading: 'Versões' },
  { path: '/conteudo/versoes/version-2-1', heading: 'Versão 1' },
  { path: '/conteudo/versoes/version-1-2', heading: 'Versão 2' },
] as const;

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

for (const scenario of SCENARIOS) {
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      colorScheme: scenario.scheme,
    });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('__e2e_authenticated__', '1');
      });
    });

    for (const screen of SCREENS) {
      test(`${screen.path} abre sem rolagem horizontal da página`, async ({
        page,
      }) => {
        await page.goto(screen.path);

        await expect(
          page.getByRole('heading', { name: screen.heading, exact: true }),
        ).toBeVisible();

        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test('editor: o preview alterna entre celular e desktop sem estourar a página', async ({
      page,
    }) => {
      await page.goto('/conteudo/versoes/version-2-1');
      await expect(
        page.getByRole('heading', { name: 'Versão 1', exact: true }),
      ).toBeVisible();

      const frame = page.getByTestId('preview-frame');

      await expect(frame).toHaveAttribute('data-device', 'phone');
      await expect(
        frame.getByText('Corredor do prédio, em Austin'),
      ).toBeVisible();

      const phone = await frame.boundingBox();

      // 390 px de quadro (a borda de 4 px já está dentro dele).
      expect(Math.round(phone?.width ?? 0)).toBe(390);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      await page.getByRole('button', { name: 'Desktop' }).click();

      await expect(frame).toHaveAttribute('data-device', 'desktop');

      const desktop = await frame.boundingBox();

      expect(desktop?.width ?? 0).toBeGreaterThan(phone?.width ?? 0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('editor: editar um campo mostra "Salvo" e o preview acompanha', async ({
      page,
    }) => {
      await page.goto('/conteudo/versoes/version-2-1');
      await expect(page.getByText('Tudo salvo')).toBeVisible();

      await page
        .getByLabel('Onde a cena acontece')
        .fill('Cafeteria da esquina');

      await expect(page.getByText('Alterações não salvas')).toBeVisible();
      await expect(page.getByText(/^Salvo às /)).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByTestId('preview-frame').getByText('Cafeteria da esquina'),
      ).toBeVisible();
    });

    test('árvore: reordenar uma lição mantém a página sem rolagem horizontal', async ({
      page,
    }) => {
      await page.goto('/conteudo');
      await expect(page.getByText('At the café')).toBeVisible();

      await page
        .getByRole('button', { name: 'Subir a lição At the café' })
        .click();

      const links = page.getByRole('link', { name: /^Abrir / });

      await expect(links.first()).toHaveAccessibleName('Abrir At the café');
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
