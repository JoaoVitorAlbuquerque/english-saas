import { expect, test } from '@playwright/test';

/**
 * `/perfil` e as três subtelas no navegador de verdade, contra o MSW do build
 * de teste: celular e desktop, tema claro e escuro. O que o Vitest (jsdom) não
 * vê: rolagem horizontal da página e o service worker de push de verdade.
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

const SCREENS = [
  { path: '/perfil', heading: 'Perfil' },
  { path: '/perfil/estudo', heading: 'Estudo' },
  { path: '/perfil/notificacoes', heading: 'Notificações' },
  { path: '/perfil/privacidade', heading: 'Privacidade e conta' },
] as const;

for (const scenario of SCENARIOS) {
  test.describe(scenario.name, () => {
    test.use({ viewport: scenario.viewport, colorScheme: scenario.scheme });

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

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('navegação', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('__e2e_authenticated__', '1');
    });
  });

  test('os cartões do perfil levam às subtelas e dá para voltar', async ({
    page,
  }) => {
    await page.goto('/perfil');

    for (const { link, heading, path } of [
      { link: /Estudo/, heading: 'Estudo', path: '/perfil/estudo' },
      {
        link: /Notificações/,
        heading: 'Notificações',
        path: '/perfil/notificacoes',
      },
      {
        link: /Privacidade e conta/,
        heading: 'Privacidade e conta',
        path: '/perfil/privacidade',
      },
    ]) {
      // `main` exclui o link de mesmo nome da barra de navegação.
      await page.getByRole('main').getByRole('link', { name: link }).click();
      await expect(page).toHaveURL(path);
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();

      await page.getByRole('link', { name: 'Voltar ao perfil' }).click();
      await expect(page).toHaveURL('/perfil');
    }
  });
});

test.describe('service worker de push', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('__e2e_authenticated__', '1');
    });
  });

  test('registra em escopo próprio, ativa, e o worker do MSW continua respondendo', async ({
    page,
  }) => {
    await page.goto('/perfil/notificacoes');
    await expect(
      page.getByRole('heading', { name: 'Notificações', exact: true }),
    ).toBeVisible();

    // O mesmo registro que `browserPushEnvironment` faz no clique de "Ativar".
    const scopes = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register(
        '/push-sw.js',
        { scope: '/push-sw/' },
      );
      const worker =
        registration.installing ?? registration.waiting ?? registration.active;

      if (worker && worker.state !== 'activated') {
        await new Promise<void>((resolve, reject) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') resolve();
            if (worker.state === 'redundant') reject(new Error('redundant'));
          });
        });
      }

      const all = await navigator.serviceWorker.getRegistrations();
      return all.map((item) => new URL(item.scope).pathname).sort();
    });

    // Dois workers, em escopos diferentes: um não derrubou o outro.
    expect(scopes).toContain('/push-sw/');
    expect(scopes).toContain('/');

    // E as chamadas da tela continuam sendo respondidas pelo MSW.
    const preferences = await page.evaluate(async () => {
      const response = await fetch(
        'http://localhost:3333/me/notifications/preferences',
      );
      return (await response.json()) as { types: Record<string, boolean> };
    });
    expect(preferences.types.dailyReminder).toBe(true);
  });

  test('o arquivo do worker é servido como JavaScript', async ({ request }) => {
    const response = await request.get('/push-sw.js');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/javascript/);
    expect(await response.text()).toContain("addEventListener('push'");
  });
});
