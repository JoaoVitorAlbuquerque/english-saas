import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../App';
import { server } from '../../mocks/server';

function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('cadastro → onboarding completo', () => {
  it('leva o aluno recém-cadastrado pelos passos até a tela final', async () => {
    let onboardingBody: unknown;
    server.use(
      http.post('http://localhost:3333/me/onboarding', async ({ request }) => {
        onboardingBody = await request.json();

        return HttpResponse.json({
          userId: 'user-1',
          goals: ['TRAVEL'],
          goalNote: null,
          availabilityMinutes: {
            mon: 10,
            tue: 10,
            wed: 10,
            thu: 10,
            fri: 10,
            sat: 10,
            sun: 10,
          },
          preferredStudyTime: 'ANY',
          targetDate: null,
          selfReportedLevel: 'NONE',
          timezone: 'America/Sao_Paulo',
          nativeLanguage: 'pt-BR',
          onboardingCompletedAt: new Date().toISOString(),
          interests: [],
        });
      }),
    );

    renderAppAt('/cadastro');

    await userEvent.type(await screen.findByLabelText('Nome'), 'Aluno Teste');
    await userEvent.type(screen.getByLabelText('E-mail'), 'aluno@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-correta-123');
    await userEvent.click(screen.getByText('Li e aceito os termos de uso.'));
    await userEvent.click(
      screen.getByText('Li e aceito a política de privacidade.'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(
      await screen.findByText('O que te trouxe até aqui?'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Viajar'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText('Quanto tempo você tem?'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('10 min todo dia'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('O que você gosta?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText('Como está seu inglês hoje?'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('Iniciante total'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Só mais uma coisa')).toBeInTheDocument();
    await userEvent.click(
      screen.getByText(
        'Quero que meu estudo seja personalizado com base no meu progresso e nos meus interesses.',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(await screen.findByText('Tudo pronto!')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Começar no nível A1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fazer o nivelamento' }),
    ).toBeInTheDocument();

    expect(onboardingBody).toMatchObject({
      goals: ['TRAVEL'],
      selfReportedLevel: 'NONE',
    });
  }, 15_000);
});
