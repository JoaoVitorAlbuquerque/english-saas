import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { profileCalls, profileState } from '../../../mocks/profile-handlers';
import { server } from '../../../mocks/server';
import { useAuthStore } from '../../../stores/auth-store';
import { API_URL, mockStudent, renderAppAt } from '../test-helpers';

async function openPrivacy() {
  mockStudent();
  renderAppAt('/perfil/privacidade');
  await screen.findByRole('heading', { name: 'Privacidade e conta' });
}

describe('Perfil → Privacidade: consentimentos', () => {
  it('termos e política são obrigatórios (sem interruptor); os outros dois alternam', async () => {
    await openPrivacy();

    expect(await screen.findByText('Termos de uso')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Termos de uso' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Política de privacidade' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Obrigatório para ter uma conta.')).toHaveLength(
      2,
    );

    expect(
      screen.getByRole('checkbox', { name: /Personalizar meu estudo/ }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Receber novidades e ofertas/ }),
    ).not.toBeChecked();
    // A versão do documento aparece junto da data do aceite.
    expect(screen.getAllByText(/versão 2026-01-01/).length).toBeGreaterThan(0);
  });

  it('ligar as novidades grava o aceite', async () => {
    await openPrivacy();

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: /Receber novidades e ofertas/,
      }),
    );

    expect(
      await screen.findByRole('checkbox', {
        name: /Receber novidades e ofertas/,
        checked: true,
      }),
    ).toBeInTheDocument();
    expect(profileCalls.consentPuts).toEqual([
      { type: 'MARKETING', granted: true },
    ]);
  });

  it('retirar a personalização pede confirmação antes de gravar', async () => {
    await openPrivacy();

    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Personalizar meu estudo/ }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Retirar a personalização?' }),
    ).toBeInTheDocument();
    expect(profileCalls.consentPuts).toEqual([]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Retirar consentimento' }),
    );

    expect(
      await screen.findByRole('checkbox', {
        name: /Personalizar meu estudo/,
        checked: false,
      }),
    ).toBeInTheDocument();
    expect(profileCalls.consentPuts).toEqual([
      { type: 'DATA_PERSONALIZATION', granted: false },
    ]);
  });

  it('"Manter" na confirmação não grava nada', async () => {
    await openPrivacy();

    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Personalizar meu estudo/ }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Manter' }),
    );

    expect(profileCalls.consentPuts).toEqual([]);
    expect(
      screen.getByRole('checkbox', { name: /Personalizar meu estudo/ }),
    ).toBeChecked();
  });

  it('documento com versão nova: avisa e deixa aceitar', async () => {
    mockStudent();
    profileState.consents = profileState.consents.map((consent) =>
      consent.type === 'PRIVACY_POLICY'
        ? { ...consent, upToDate: false, version: '2025-01-01' }
        : consent,
    );
    renderAppAt('/perfil/privacidade');

    expect(
      await screen.findByText('Há uma versão nova deste documento.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Aceitar a versão nova' }),
    );

    await screen.findByText('Termos de uso');
    expect(profileCalls.consentPuts).toEqual([
      { type: 'PRIVACY_POLICY', granted: true },
    ]);
    expect(
      screen.queryByText('Há uma versão nova deste documento.'),
    ).not.toBeInTheDocument();
  });
});

describe('Perfil → Privacidade: exportar meus dados', () => {
  it('nunca pediu: corpo vazio da API vira "Pedir meus dados"', async () => {
    await openPrivacy();

    expect(
      await screen.findByRole('button', { name: 'Pedir meus dados' }),
    ).toBeEnabled();
  });

  it('pedir e receber o link de download quando fica pronto', async () => {
    await openPrivacy();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir meus dados' }),
    );

    expect(
      await screen.findByText('Seus dados estão prontos.'),
    ).toBeInTheDocument();
    expect(profileCalls.exportRequests).toBe(1);
    expect(
      screen.getByRole('link', { name: 'Baixar meus dados' }),
    ).toHaveAttribute(
      'href',
      'https://files.local/meus-dados-english-saas.json?sig=abc',
    );
    expect(
      screen.getByRole('link', { name: 'Baixar meus dados' }),
    ).toHaveAttribute('download', 'meus-dados-english-saas.json');
    expect(screen.getByText(/Tamanho: 2,0 KB/)).toBeInTheDocument();
  });

  it('enquanto monta, mostra "estamos juntando" e acompanha sozinho até ficar pronto', async () => {
    mockStudent();
    profileState.exportOutcome = 'pending-then-ready';
    renderAppAt('/perfil/privacidade');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir meus dados' }),
    );

    expect(
      await screen.findByText(/Estamos juntando seus dados/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Baixar meus dados' }),
    ).not.toBeInTheDocument();

    // A tela refaz a consulta a cada 3 s; não precisa recarregar.
    expect(
      await screen.findByRole(
        'link',
        { name: 'Baixar meus dados' },
        { timeout: 8_000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Estamos juntando seus dados/),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('voltar à tela com um pedido em andamento retoma de onde estava', async () => {
    mockStudent();
    profileState.latestExport = {
      id: 'export-9',
      status: 'PENDING',
      createdAt: '2026-10-02T10:00:00.000Z',
      expiresAt: null,
      sizeBytes: null,
      downloadUrl: null,
    };
    renderAppAt('/perfil/privacidade');

    expect(
      await screen.findByText(/Estamos juntando seus dados/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pedir meus dados' }),
    ).not.toBeInTheDocument();
  });

  it('falha na montagem: avisa e deixa tentar de novo', async () => {
    mockStudent();
    profileState.exportOutcome = 'failed';
    renderAppAt('/perfil/privacidade');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir meus dados' }),
    );

    expect(
      await screen.findByText(
        'Não conseguimos montar seus dados. Tente de novo.',
      ),
    ).toBeInTheDocument();

    profileState.exportOutcome = 'ready';
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );

    expect(
      await screen.findByRole('link', { name: 'Baixar meus dados' }),
    ).toBeInTheDocument();
    expect(profileCalls.exportRequests).toBe(2);
  });

  it('link vencido: pede para gerar outro', async () => {
    mockStudent();
    profileState.latestExport = {
      id: 'export-1',
      status: 'READY',
      createdAt: '2026-09-01T10:00:00.000Z',
      expiresAt: '2026-09-02T10:00:00.000Z',
      sizeBytes: 2048,
      downloadUrl: null,
    };
    renderAppAt('/perfil/privacidade');

    expect(
      await screen.findByText(/O link do último pedido venceu/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pedir de novo' }),
    ).toBeInTheDocument();
  });

  it('erro ao pedir: mensagem, sem estado falso', async () => {
    mockStudent();
    server.use(
      http.post(`${API_URL}/me/export`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro.' } },
          { status: 500 },
        ),
      ),
    );
    renderAppAt('/perfil/privacidade');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir meus dados' }),
    );

    expect(
      await screen.findByText(
        'Não conseguimos fazer o pedido agora. Tente de novo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Estamos juntando/)).not.toBeInTheDocument();
  });
});

describe('Perfil → Privacidade: excluir a conta', () => {
  async function openDeleteDialog() {
    await openPrivacy();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir minha conta' }),
    );

    return within(await screen.findByRole('dialog'));
  }

  it('explica o prazo de 30 dias antes de pedir a confirmação', async () => {
    const dialog = await openDeleteDialog();

    expect(
      dialog.getByRole('heading', { name: 'Excluir a sua conta?' }),
    ).toBeInTheDocument();
    expect(dialog.getByText(/sai do ar agora/)).toBeInTheDocument();
    expect(
      dialog.getByText(/Em 30 dias, seu nome, e-mail/),
    ).toBeInTheDocument();
    expect(dialog.getByText(/ela é cancelada/)).toBeInTheDocument();
    expect(dialog.getByText(/Peça a exportação antes/)).toBeInTheDocument();
    // A explicação também está na própria seção, fora do diálogo.
    expect(profileCalls.deletions).toBe(0);
  });

  it('o botão só habilita quando a pessoa digita EXCLUIR', async () => {
    const dialog = await openDeleteDialog();
    const confirm = dialog.getByRole('button', { name: 'Excluir minha conta' });

    expect(confirm).toBeDisabled();

    await userEvent.type(
      dialog.getByLabelText('Para confirmar, digite EXCLUIR'),
      'exclu',
    );
    expect(confirm).toBeDisabled();

    await userEvent.type(
      dialog.getByLabelText('Para confirmar, digite EXCLUIR'),
      'ir',
    );
    expect(confirm).toBeEnabled();
  });

  it('confirmar exclui, encerra a sessão e volta ao login com o aviso do prazo', async () => {
    const dialog = await openDeleteDialog();

    await userEvent.type(
      dialog.getByLabelText('Para confirmar, digite EXCLUIR'),
      'EXCLUIR',
    );
    await userEvent.click(
      dialog.getByRole('button', { name: 'Excluir minha conta' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Entre na sua conta' }),
    ).toBeInTheDocument();
    expect(profileCalls.deletions).toBe(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(screen.getByText('Sua conta foi excluída')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Seus dados pessoais serão anonimizados em 30 dias, até/,
      ),
    ).toBeInTheDocument();
  });

  it('se a API falhar, a conta continua e o diálogo avisa', async () => {
    mockStudent();
    server.use(
      http.delete(`${API_URL}/me`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Erro.' } },
          { status: 500 },
        ),
      ),
    );
    renderAppAt('/perfil/privacidade');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir minha conta' }),
    );
    const dialog = within(await screen.findByRole('dialog'));

    await userEvent.type(
      dialog.getByLabelText('Para confirmar, digite EXCLUIR'),
      'EXCLUIR',
    );
    await userEvent.click(
      dialog.getByRole('button', { name: 'Excluir minha conta' }),
    );

    expect(
      await dialog.findByText(
        'Não conseguimos excluir sua conta agora. Nada foi alterado; tente de novo.',
      ),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(
      screen.queryByRole('heading', { name: 'Entre na sua conta' }),
    ).not.toBeInTheDocument();
  });

  it('"Manter minha conta" fecha sem excluir', async () => {
    const dialog = await openDeleteDialog();

    await userEvent.click(
      dialog.getByRole('button', { name: 'Manter minha conta' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(profileCalls.deletions).toBe(0);
  });
});
