import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { profileCalls, profileState } from '../../../mocks/profile-handlers';
import { server } from '../../../mocks/server';
import { API_URL, mockStudent, renderAppAt } from '../test-helpers';

const WEEK = { mon: 20, tue: 20, wed: 20, thu: 20, fri: 20, sat: 0, sun: 0 };

async function openStudy() {
  mockStudent();
  renderAppAt('/perfil/estudo');
  await screen.findByRole('heading', { name: 'Estudo' });
}

const saveButton = () => screen.getByRole('button', { name: 'Salvar' });

describe('Perfil → Estudo', () => {
  it('mostra o que está salvo e só habilita "Salvar" depois de uma mudança', async () => {
    await openStudy();

    expect(screen.getByRole('button', { name: 'Viajar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Segunda')).toHaveValue(20);
    expect(screen.getByLabelText('Sábado')).toHaveValue(0);
    expect(screen.getByLabelText('Nível que você quer alcançar')).toHaveValue(
      'B1',
    );
    expect(screen.getByText('Total por semana: 100 min')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('salvar disponibilidade avisa que o plano será recalculado e manda a semana inteira', async () => {
    await openStudy();

    await userEvent.clear(screen.getByLabelText('Sábado'));
    await userEvent.type(screen.getByLabelText('Sábado'), '30');
    await userEvent.click(saveButton());

    // O aviso vem antes de qualquer chamada.
    expect(
      await screen.findByRole('heading', { name: 'Recalcular o seu plano?' }),
    ).toBeInTheDocument();
    expect(profileCalls.profilePatches).toEqual([]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar e recalcular' }),
    );

    expect(
      await screen.findByText('Salvo. Estamos recalculando o seu plano.'),
    ).toBeInTheDocument();
    expect(profileCalls.profilePatches).toEqual([
      { availabilityMinutes: { ...WEEK, sat: 30 } },
    ]);
    // O nível-alvo não mudou: nada de rebuild explícito (o PATCH já recalcula).
    expect(profileCalls.rebuilds).toEqual([]);
    expect(profileCalls.interestPuts).toEqual([]);
    expect(profileState.profile.availabilityMinutes.sat).toBe(30);
    // O botão volta a ficar parado: não há mais o que salvar.
    expect(saveButton()).toBeDisabled();
  });

  it('"Voltar" no aviso não salva nada', async () => {
    await openStudy();

    await userEvent.clear(screen.getByLabelText('Domingo'));
    await userEvent.type(screen.getByLabelText('Domingo'), '15');
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Voltar' }),
    );

    expect(profileCalls.profilePatches).toEqual([]);
    expect(screen.getByLabelText('Domingo')).toHaveValue(15);
  });

  it('mudar o nível-alvo recalcula o plano com o nível escolhido', async () => {
    await openStudy();

    await userEvent.selectOptions(
      screen.getByLabelText('Nível que você quer alcançar'),
      'B2',
    );
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Salvar e recalcular' }),
    );

    expect(
      await screen.findByText('Salvo. Estamos recalculando o seu plano.'),
    ).toBeInTheDocument();
    expect(profileCalls.rebuilds).toEqual([{ targetLevel: 'B2' }]);
    expect(profileCalls.profilePatches).toEqual([]);
  });

  it('data-alvo: manda só a data; no passado, bloqueia; dá para tirar', async () => {
    await openStudy();
    const date = screen.getByLabelText('Data-alvo (opcional)');

    fireEvent.change(date, { target: { value: '2020-01-01' } });
    expect(
      screen.getByText('Escolha uma data a partir de amanhã.'),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.change(date, { target: { value: '2099-03-01' } });
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Salvar e recalcular' }),
    );

    await screen.findByText('Salvo. Estamos recalculando o seu plano.');
    expect(profileCalls.profilePatches).toEqual([{ targetDate: '2099-03-01' }]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Tirar a data-alvo' }),
    );
    expect(screen.getByLabelText('Data-alvo (opcional)')).toHaveValue('');
  });

  it('zero minutos na semana é recusado, como no onboarding', async () => {
    await openStudy();

    for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
      await userEvent.clear(screen.getByLabelText(day));
    }

    expect(
      screen.getByText(/Escolha pelo menos alguns minutos/),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('sem nenhum objetivo, bloqueia o salvar', async () => {
    await openStudy();

    await userEvent.click(screen.getByRole('button', { name: 'Viajar' }));

    expect(
      screen.getByText('Escolha pelo menos um objetivo.'),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('só interesses: salva direto, sem o aviso de plano', async () => {
    await openStudy();

    await userEvent.click(screen.getByRole('button', { name: 'Música' }));
    await userEvent.click(saveButton());

    expect(await screen.findByText('Estudo atualizado.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Recalcular o seu plano?' }),
    ).not.toBeInTheDocument();
    expect(profileCalls.interestPuts).toEqual([
      {
        interests: [
          { topic: 'history', weight: 50 },
          { topic: 'music', weight: 50 },
        ],
      },
    ]);
    expect(profileCalls.profilePatches).toEqual([]);
  });

  it('tema livre vira slug válido para a API', async () => {
    await openStudy();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar um tema' }),
      'Copa do Mundo',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Adicionar "Copa do Mundo"/ }),
    );
    await userEvent.click(saveButton());

    await screen.findByText('Estudo atualizado.');
    expect(profileCalls.interestPuts).toEqual([
      {
        interests: [
          { topic: 'history', weight: 50 },
          { topic: 'copa-do-mundo', weight: 50 },
        ],
      },
    ]);
  });

  it('se uma parte falha, avisa que salvou só parte e deixa pendente só o que falta', async () => {
    await openStudy();
    server.use(
      http.put(`${API_URL}/me/interests`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro.' } },
          { status: 500 },
        ),
      ),
    );

    await userEvent.clear(screen.getByLabelText('Sábado'));
    await userEvent.type(screen.getByLabelText('Sábado'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Música' }));
    await userEvent.click(saveButton());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Salvar e recalcular' }),
    );

    // O perfil entrou; os interesses falharam.
    expect(
      await screen.findByText(/Parte das mudanças foi salva e parte não/),
    ).toBeInTheDocument();
    expect(profileCalls.profilePatches).toHaveLength(1);
    expect(profileState.profile.availabilityMinutes.sat).toBe(30);

    // A tela continua mostrando o que a pessoa escolheu, e só os interesses
    // seguem pendentes: tentar de novo não repete o PATCH do perfil.
    expect(screen.getByLabelText('Sábado')).toHaveValue(30);
    expect(saveButton()).toBeEnabled();
    server.use(
      http.put(`${API_URL}/me/interests`, async ({ request }) => {
        profileCalls.interestPuts.push(await request.json());
        return HttpResponse.json([]);
      }),
    );
    await userEvent.click(saveButton());

    await screen.findByText('Estudo atualizado.');
    expect(profileCalls.profilePatches).toHaveLength(1);
    expect(profileCalls.interestPuts).toHaveLength(1);
  });
});
