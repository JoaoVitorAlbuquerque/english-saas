import { expect, test, type Page } from '@playwright/test';

/**
 * As telas de gestão (somente ADMIN) no navegador de verdade, contra o MSW do
 * build de teste: desktop, tema claro e escuro. O que o Vitest (jsdom) não vê:
 * a rolagem horizontal da página (tabelas largas e gráficos rolam por dentro)
 * e o menu do editor sem as entradas de gestão.
 */

const SCENARIOS = [
  { name: 'desktop, claro', scheme: 'light' },
  { name: 'desktop, escuro', scheme: 'dark' },
] as const;

const SCREENS = [
  { path: '/alunos', heading: 'Alunos', table: 'Alunos cadastrados' },
  {
    path: '/alunos/student-ana',
    heading: 'Ana Lima',
    table: 'Extrato de créditos do aluno',
  },
  { path: '/assinaturas', heading: 'Planos e créditos', table: 'Planos' },
  {
    path: '/metricas',
    heading: 'Métricas',
    table: 'Retenção por coorte',
  },
  {
    path: '/metricas?aba=conteudo',
    heading: 'Métricas',
    table: 'Lições com pior desempenho',
  },
  {
    path: '/metricas?aba=custos',
    heading: 'Métricas',
    table: 'Alunos que mais consomem IA',
  },
  {
    path: '/auditoria',
    heading: 'Log de auditoria',
    table: 'Ações de administração',
  },
] as const;

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

async function loginAs(page: Page, role: 'ADMIN' | 'EDITOR'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('__e2e_authenticated__', '1');
    window.localStorage.setItem('__e2e_role__', value);
  }, role);
}

for (const scenario of SCENARIOS) {
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      colorScheme: scenario.scheme,
    });

    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'ADMIN');
    });

    for (const screen of SCREENS) {
      test(`${screen.path} abre sem rolagem horizontal da página`, async ({
        page,
      }) => {
        await page.goto(screen.path);

        await expect(
          page.getByRole('heading', {
            name: screen.heading,
            exact: true,
            level: 1,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('table', { name: screen.table }),
        ).toBeVisible();

        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test('conceder créditos pela ficha: o saldo muda e a ação aparece na auditoria', async ({
      page,
    }) => {
      await page.goto('/alunos/student-ana');

      const credits = page.getByRole('region', { name: 'Créditos de IA' });

      await expect(credits.getByText('496')).toBeVisible();
      await credits.getByRole('button', { name: 'Conceder créditos' }).click();

      const dialog = page.getByRole('dialog');

      await dialog.getByLabel('Quantidade de créditos').fill('10');
      await dialog.getByLabel('Motivo').fill('Compensação de teste');
      await expect(
        dialog.getByText('O saldo vai de 496 para 506.'),
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Conceder' }).click();

      await expect(credits.getByText('506')).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      await page
        .getByRole('navigation', { name: 'Navegação principal' })
        .getByRole('link', { name: 'Auditoria' })
        .click();

      await expect(
        page.getByText(
          '+10 créditos (saldo depois: 506) — motivo: Compensação de teste',
        ),
      ).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('o link das filas abre em outra aba e avisa do login próprio', async ({
      page,
    }) => {
      await page.goto('/alunos');

      const link = page
        .getByRole('navigation', { name: 'Navegação principal' })
        .getByRole('link', { name: /Filas \(Bull Board\)/ });

      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('href', /\/admin\/queues$/);
      await expect(
        page.getByText(/pede o usuário e a senha de administração/),
      ).toBeVisible();
    });
  });

  test.describe(`${scenario.name} — editor`, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      colorScheme: scenario.scheme,
    });

    test('o editor não vê as entradas de gestão e é barrado se digitar o endereço', async ({
      page,
    }) => {
      await loginAs(page, 'EDITOR');
      await page.goto('/conteudo');

      const menu = page.getByRole('navigation', {
        name: 'Navegação principal',
      });

      await expect(menu.getByRole('link', { name: 'Conteúdo' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Alunos' })).toHaveCount(0);
      await expect(menu.getByRole('link', { name: 'Auditoria' })).toHaveCount(
        0,
      );
      await expect(menu.getByRole('link', { name: /Filas/ })).toHaveCount(0);

      await page.goto('/metricas');

      await expect(
        page.getByRole('heading', { name: 'Área de administração' }),
      ).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
