import { expect, test } from '@playwright/test';

/**
 * A lição seed "Nice to meet you" do início ao fim, contra o MSW do
 * navegador (`src/mocks/browser.ts`, ligado só neste build pelo
 * `VITE_E2E_MOCKS` do `playwright.config.ts`). O `beforeEach` liga a sessão
 * autenticada e onboarded (`src/mocks/browser.ts`), então o teste começa
 * direto na lição.
 */

test.beforeEach(async ({ page }) => {
  // Liga o cenário "aluno logado" do `src/mocks/browser.ts`.
  await page.addInitScript(() => {
    window.localStorage.setItem('__e2e_authenticated__', '1');
  });
});

test('faz a lição inteira: cena, cards, prática, produção livre, roleplay e resumo', async ({
  page,
}) => {
  await page.goto('/licoes/nice-to-meet-you');

  // --- Cena -----------------------------------------------------------
  await expect(page.getByText('Hi! Are you new here?')).toBeVisible();
  await page.getByRole('button', { name: /Ouvir/ }).first().click();
  await page.getByRole('button', { name: 'Estrutura gramatical' }).click();
  await expect(page.getByText('Yes, I am. I am Lucas.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // --- Cards de explicação ---------------------------------------------
  await expect(page.getByText("I'm = I am")).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // --- Prática -----------------------------------------------------------
  await expect(page.getByText('Complete: I ___ Lucas.')).toBeVisible();
  // Tocar a alternativa já responde — sem confirmar.
  await page.getByRole('radio', { name: '1. am' }).click();
  await expect(page.getByText('Certo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    page.getByText('Escreva "Eu sou do Brasil" em inglês.'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Sua resposta' })
    .fill("I'm from Brazil.");
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Certo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // --- Produção livre ---------------------------------------------------
  await expect(
    page.getByText('Se apresente: diga seu nome e de onde você é.'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Sua resposta' })
    .fill("I'm Lucas. I'm from Brazil.");
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Mandou bem!')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // --- Roleplay -----------------------------------------------------------
  await expect(page.getByText('Hey! Going up?')).toBeVisible();
  await page.getByPlaceholder('Escreva sua resposta').fill('I am Lucas.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText("That's great! Nice to meet you.")).toBeVisible();
  await expect(page.getByText('My name is Lucas')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar conversa' }).click();
  await expect(page.getByText('Como foi a conversa')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // --- Resumo -----------------------------------------------------------
  await expect(page.getByText('O que você aprendeu')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir lição' }).click();
  await expect(page.getByText('30 XP')).toHaveCount(2);
  await expect(page.getByText('100% de acerto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refazer' })).toBeVisible();
});

test('sair no meio e voltar retoma na mesma etapa', async ({ page }) => {
  await page.goto('/licoes/nice-to-meet-you');

  await expect(page.getByText('Hi! Are you new here?')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText("I'm = I am")).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Complete: I ___ Lucas.')).toBeVisible();

  // "Fechar a aba e reabrir": recarrega a mesma rota do zero.
  await page.goto('/licoes/nice-to-meet-you');

  await expect(page.getByText('Complete: I ___ Lucas.')).toBeVisible();
  await expect(page.getByText('Hi! Are you new here?')).not.toBeVisible();
});

test('lição fora do plano abre o paywall', async ({ page }) => {
  await page.goto('/licoes/locked-lesson');

  await expect(page.getByText('Isso é do plano Base')).toBeVisible();
  await expect(
    page.getByText(
      'Esse conteúdo faz parte dos planos pagos. Dá uma olhada nos planos para liberar.',
    ),
  ).toBeVisible();
});

test('sem crédito de IA, a produção livre avisa e deixa seguir', async ({
  page,
}) => {
  // Tentativa já com cena, cards e prática feitos: cai direto na produção.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      '__mock_lesson_state__',
      JSON.stringify({
        status: 'IN_PROGRESS',
        completedSteps: [0, 1, 2],
        answeredItemIds: [
          'd1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
          'e1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
        ],
        xpEarned: 0,
      }),
    );
  });
  await page.goto('/licoes/nice-to-meet-you');

  await expect(
    page.getByText('Se apresente: diga seu nome e de onde você é.'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Sua resposta' })
    .fill("I'm Lucas. [sem-credito]");
  await page.getByRole('button', { name: 'Enviar' }).click();

  await expect(
    page.getByText(
      'Você não tem créditos de IA agora. Sua resposta foi salva, mas não deu para corrigir desta vez.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Hey! Going up?')).toBeVisible();
});
