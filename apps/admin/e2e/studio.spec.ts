import { expect, test, type Page } from '@playwright/test';

/**
 * O estúdio de conteúdo no navegador de verdade, contra o MSW do build de
 * teste: desktop, tema claro e escuro. O que o Vitest (jsdom) não vê: a
 * rolagem horizontal da página e o painel lateral do editor ao lado do conteúdo.
 */

const SCENARIOS = [
  { name: 'desktop, claro', scheme: 'light' },
  { name: 'desktop, escuro', scheme: 'dark' },
] as const;

const SCREENS = [
  { path: '/estudio', table: 'Rascunhos pedidos à IA' },
  { path: '/estudio/novo', table: null },
  { path: '/estudio/novo?tipo=questoes', table: null },
  { path: '/estudio/novo?tipo=notas', table: null },
  { path: '/estudio/apostilas', table: 'Apostilas por unidade' },
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
          page.getByRole('heading', {
            name: 'Estúdio de conteúdo',
            exact: true,
            level: 1,
          }),
        ).toBeVisible();

        if (screen.table !== null) {
          await expect(
            page.getByRole('table', { name: screen.table }),
          ).toBeVisible();
        }

        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test('fila → revisão: as abas do painel cabem ao lado do editor', async ({
      page,
    }) => {
      await page.goto('/estudio');
      await expect(
        page.getByRole('table', { name: 'Rascunhos pedidos à IA' }),
      ).toBeVisible();

      // Um rascunho de lição já pronto, como se a IA tivesse acabado.
      await page.evaluate(() => window.__studioMock?.seedReadyLessonDraft());
      await page.getByRole('button', { name: 'Atualizar agora' }).click();

      const row = page.getByRole('row', {
        name: /Fazer o check-in no aeroporto/,
      });

      await expect(row.getByText('2 bloqueadores')).toBeVisible();
      await row.getByRole('link', { name: /^Revisar/ }).click();

      await expect(
        page.getByRole('heading', { name: 'Versão 1', level: 1 }),
      ).toBeVisible();

      // A revisão abre sozinha (?painel=revisao), com os bloqueadores.
      const review = page.getByRole('tabpanel');

      await expect(
        review.getByRole('heading', { name: 'Revisão automática' }),
      ).toBeVisible();
      await expect(
        review.getByRole('region', { name: 'Bloqueadores' }),
      ).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      // O painel fica ao lado do formulário, não embaixo.
      const form = await page.locator('#editor-panel').boundingBox();
      const side = await review.boundingBox();

      expect(side?.x ?? 0).toBeGreaterThan(
        (form?.x ?? 0) + (form?.width ?? 0) - 1,
      );

      for (const tab of ['Comentários', 'Áudio', 'Preview']) {
        await page.getByRole('tab', { name: new RegExp(tab) }).click();
        await expect(
          page.getByRole('tab', { name: new RegExp(tab), selected: true }),
        ).toBeVisible();
        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      }
    });

    test('aprovar fica travado com bloqueador, e a lista do que falta aparece', async ({
      page,
    }) => {
      await page.goto('/estudio');
      await expect(
        page.getByRole('table', { name: 'Rascunhos pedidos à IA' }),
      ).toBeVisible();
      await page.evaluate(() => window.__studioMock?.seedReadyLessonDraft());
      await page.getByRole('button', { name: 'Atualizar agora' }).click();
      await page
        .getByRole('row', { name: /Fazer o check-in no aeroporto/ })
        .getByRole('link', { name: /^Revisar/ })
        .click();

      await page.getByRole('button', { name: 'Enviar para revisão' }).click();

      await expect(
        page.getByRole('button', { name: 'Aprovar' }),
      ).toBeDisabled();
      await expect(
        page.getByText(/Não dá para aprovar: 2 bloqueador/),
      ).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
