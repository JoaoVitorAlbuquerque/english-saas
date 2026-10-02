import { expect, test } from '@playwright/test';

/**
 * `/progresso` no navegador de verdade, contra o MSW do build de teste:
 * celular e desktop, tema claro e escuro. O que o Vitest (jsdom) não vê:
 * se a página ganha rolagem horizontal e se os gráficos aparecem de fato.
 */

const SCENARIOS = [
  {
    name: 'celular, claro',
    viewport: { width: 390, height: 844 },
    scheme: 'light',
  },
  {
    name: 'celular, escuro',
    viewport: { width: 390, height: 844 },
    scheme: 'dark',
  },
  {
    name: 'desktop, claro',
    viewport: { width: 1280, height: 800 },
    scheme: 'light',
  },
  {
    name: 'desktop, escuro',
    viewport: { width: 1280, height: 800 },
    scheme: 'dark',
  },
] as const;

for (const scenario of SCENARIOS) {
  test.describe(scenario.name, () => {
    test.use({ viewport: scenario.viewport, colorScheme: scenario.scheme });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('__e2e_authenticated__', '1');
      });
    });

    test('mostra os gráficos sem rolagem horizontal da página', async ({
      page,
    }) => {
      await page.goto('/progresso');

      await expect(
        page.getByRole('heading', { name: 'Seu progresso' }),
      ).toBeVisible();

      // Os três gráficos: barras por habilidade, linha do nível, planejado × feito.
      for (const title of [
        'Nível por habilidade',
        'Evolução do nível',
        'Cumprimento do plano',
      ]) {
        await expect(page.getByRole('figure', { name: title })).toBeVisible();
      }

      // Confiança baixa vem escrita, não só em cor.
      await expect(page.getByText('Poucos dados — pode mudar')).toBeVisible();
      await expect(page.getByText('Meta: B1')).toBeVisible();

      // A página nunca ganha barra de rolagem horizontal (o gráfico de
      // semanas rola por dentro).
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('os gráficos pegam as cores do tema (a barra muda entre claro e escuro)', async ({
  browser,
}) => {
  async function barColor(scheme: 'light' | 'dark'): Promise<string> {
    const context = await browser.newContext({
      colorScheme: scheme,
      viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('__e2e_authenticated__', '1');
    });
    const page = await context.newPage();
    await page.goto('/progresso');
    await page.getByRole('figure', { name: 'Nível por habilidade' }).waitFor();
    const color = await page
      .locator('figure span.absolute.inset-y-0.left-0')
      .first()
      .evaluate((element) => getComputedStyle(element).color);
    await context.close();
    return color;
  }

  const light = await barColor('light');
  const dark = await barColor('dark');

  expect(light).not.toBe('');
  expect(light).not.toBe(dark);
});
