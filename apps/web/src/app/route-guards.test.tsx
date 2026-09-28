import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../App';
import {
  completedProfileFixture,
  freshProfileFixture,
  sessionFixture,
} from '../mocks/handlers';
import { server } from '../mocks/server';

function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

function mockAuthenticatedSession() {
  server.use(
    http.post('http://localhost:3333/auth/refresh', () =>
      HttpResponse.json(sessionFixture),
    ),
  );
}

describe('guardas de rota', () => {
  it('sem sessão, /hoje redireciona para /login', async () => {
    renderAppAt('/hoje');

    expect(await screen.findByText('Entre na sua conta')).toBeInTheDocument();
  });

  it('com sessão mas sem onboarding, /hoje redireciona para o onboarding', async () => {
    mockAuthenticatedSession();
    server.use(
      http.get('http://localhost:3333/me/profile', () =>
        HttpResponse.json(freshProfileFixture),
      ),
    );

    renderAppAt('/hoje');

    expect(
      await screen.findByText('O que te trouxe até aqui?'),
    ).toBeInTheDocument();
  });

  it('com onboarding completo, /onboarding/objetivo redireciona para /hoje', async () => {
    mockAuthenticatedSession();
    server.use(
      http.get('http://localhost:3333/me/profile', () =>
        HttpResponse.json(completedProfileFixture),
      ),
    );

    renderAppAt('/onboarding/objetivo');

    expect(
      await screen.findByText('Sua lição de hoje ainda não chegou aqui'),
    ).toBeInTheDocument();
  });
});

describe('refresh de sessão ao recarregar', () => {
  it('restaura a sessão via cookie sem pedir login de novo', async () => {
    mockAuthenticatedSession();
    server.use(
      http.get('http://localhost:3333/me/profile', () =>
        HttpResponse.json(completedProfileFixture),
      ),
    );

    renderAppAt('/hoje');

    expect(
      await screen.findByText('Sua lição de hoje ainda não chegou aqui'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Entre na sua conta')).not.toBeInTheDocument();
  });
});
