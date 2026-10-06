import { expect, test, type Page } from '@playwright/test';

/**
 * A taxonomia e o banco de questões no navegador de verdade, contra o MSW do
 * build de teste: desktop, tema claro e escuro. O que o Vitest (jsdom) não
 * vê: a rolagem horizontal da página e o desenho real do preview.
 */

const SCENARIOS = [
  { name: 'desktop, claro', scheme: 'light' },
  { name: 'desktop, escuro', scheme: 'dark' },
] as const;

const ITEM_AM = '44444444-4444-4444-8444-444444444444';
const ITEM_READING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM_TYPE = '99999999-9999-4999-8999-999999999999';

const SCREENS = [
  { path: '/conteudo/taxonomia/skills', heading: 'Taxonomia', level: 1 },
  { path: '/conteudo/taxonomia/erros', heading: 'Taxonomia', level: 1 },
  { path: '/conteudo/taxonomia/registro', heading: 'Taxonomia', level: 1 },
  { path: '/conteudo/questoes', heading: 'Banco de questões', level: 1 },
  { path: '/conteudo/questoes/nova', heading: 'Nova questão', level: 1 },
  { path: `/conteudo/questoes/${ITEM_AM}`, heading: 'Questão', level: 1 },
  { path: `/conteudo/questoes/${ITEM_READING}`, heading: 'Questão', level: 1 },
  { path: `/conteudo/questoes/${ITEM_TYPE}`, heading: 'Questão', level: 1 },
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
            name: screen.heading,
            exact: true,
            level: screen.level,
          }),
        ).toBeVisible();

        expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test('banco: a tabela abre, filtra por problemáticos e cabe na página', async ({
      page,
    }) => {
      await page.goto('/conteudo/questoes');

      await expect(
        page.getByRole('table', { name: 'Questões do banco' }),
      ).toBeVisible();

      await page.getByRole('checkbox', { name: 'Só os problemáticos' }).click();

      await expect(
        page.getByRole('link', { name: 'Traduza: Ela é de Austin' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Monte a frase.' }),
      ).toHaveCount(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('editor: o preview da leitura aparece ao lado, e "Ver gabarito" mostra a explicação', async ({
      page,
    }) => {
      await page.goto(`/conteudo/questoes/${ITEM_READING}`);

      const preview = page.getByTestId('item-preview');

      await expect(preview).toBeVisible();
      await expect(preview.getByText('Onde o Lucas mora?')).toBeVisible();

      // O preview fica ao lado do formulário (duas colunas no desktop).
      const form = await page.locator('#item-editor-panel').boundingBox();
      const side = await preview.boundingBox();

      expect(side?.x ?? 0).toBeGreaterThan(
        (form?.x ?? 0) + (form?.width ?? 0) - 1,
      );

      await page.getByRole('button', { name: 'Ver gabarito' }).click();

      await expect(
        preview.getByText('O texto diz "lives in Austin".'),
      ).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('editor: digitar atualiza o preview e salvar mostra "Salvo"', async ({
      page,
    }) => {
      await page.goto(`/conteudo/questoes/${ITEM_AM}`);
      await expect(page.getByText('Tudo salvo')).toBeVisible();

      await page
        .getByLabel('Explicação')
        .fill('Com "I", o verbo certo é "am".');

      await expect(page.getByText('Alterações não salvas')).toBeVisible();

      await page.getByRole('button', { name: 'Salvar' }).click();

      await expect(page.getByText(/^Salvo às /)).toBeVisible();
    });

    test('taxonomia: o diálogo da skill abre e cabe na tela', async ({
      page,
    }) => {
      await page.goto('/conteudo/taxonomia/skills');
      await page.getByRole('button', { name: 'Nova skill' }).click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();

      expect((box?.y ?? -1) + (box?.height ?? 0)).toBeLessThanOrEqual(900);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
