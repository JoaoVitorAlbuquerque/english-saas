import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../test-helpers';

async function openLesson(id = 'lesson-1') {
  renderAdminAt(`/conteudo/licoes/${id}`);
  await screen.findByRole('heading', { name: 'Versões' });
}

function row(version: number): HTMLElement {
  return screen
    .getByRole('heading', { name: `Versão ${String(version)}` })
    .closest('li') as HTMLElement;
}

describe('Conteúdo → lição e suas versões', () => {
  it('lista as versões da mais nova para a mais antiga, com estado e datas', async () => {
    await openLesson();

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings.slice(0, 2)).toEqual(['Versão 2', 'Versão 1']);

    expect(within(row(2)).getByText('Publicado')).toBeInTheDocument();
    expect(within(row(2)).getByText('No ar')).toBeInTheDocument();
    expect(within(row(2)).getByText(/Aprovada em/)).toBeInTheDocument();
    expect(within(row(2)).getByText(/Publicada em/)).toBeInTheDocument();
    expect(within(row(1)).getByText('Arquivado')).toBeInTheDocument();
    expect(within(row(1)).queryByText('No ar')).not.toBeInTheDocument();
  });

  it('cada versão leva ao editor', async () => {
    await openLesson();

    await userEvent.click(
      within(row(2)).getByRole('link', { name: 'Abrir Versão 2' }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/conteudo/versoes/version-1-2',
    );
  });

  it('só mostra as ações que valem para o estado da versão', async () => {
    await openLesson('lesson-2');

    // Rascunho: enviar para revisão e arquivar.
    expect(
      within(row(1)).getByRole('button', { name: 'Enviar para revisão' }),
    ).toBeInTheDocument();
    expect(
      within(row(1)).queryByRole('button', { name: 'Publicar' }),
    ).not.toBeInTheDocument();
  });

  describe('criar nova versão', () => {
    it('clona a publicada em rascunho e abre o editor', async () => {
      await openLesson();

      await userEvent.click(
        screen.getByRole('button', { name: 'Criar nova versão' }),
      );

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\/conteudo\/versoes\//,
        ),
      );

      const created = mockState.versions.find((v) => v.version === 3);

      expect(created).toMatchObject({ lessonId: 'lesson-1', status: 'DRAFT' });
      expect(created?.steps).toHaveLength(6);
    });

    it('com versão aberta, o botão fica desligado e explica o motivo', async () => {
      await openLesson('lesson-2');

      expect(
        screen.getByRole('button', { name: 'Criar nova versão' }),
      ).toBeDisabled();
      expect(
        screen.getByText(/A versão 1 ainda está aberta/),
      ).toBeInTheDocument();
    });

    it('se a API disser que já existe uma aberta (corrida), mostra qual', async () => {
      await openLesson();
      failNext('create-version', {
        status: 409,
        code: 'DRAFT_ALREADY_OPEN',
        message: 'A versão 3 ainda está aberta.',
        details: { version: 3 },
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Criar nova versão' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A versão 3 ainda está aberta. Publique ou arquive ela antes de começar outra.',
      );
    });
  });

  describe('comparar versões', () => {
    it('mostra o que mudou entre a mais nova e a anterior, antes → depois', async () => {
      await openLesson();

      const compare = screen
        .getByRole('heading', { name: 'Comparar versões' })
        .closest('section') as HTMLElement;

      // v1 → v2: objetivo e tempo mudaram, e a v2 tem três etapas a mais.
      expect(within(compare).getByText('Objetivo')).toBeInTheDocument();
      expect(
        within(compare).getByText(
          'Se apresentar e perguntar de onde a pessoa é.',
        ),
      ).toBeInTheDocument();
      expect(
        within(compare).getByText('Tempo estimado (min)'),
      ).toBeInTheDocument();
      expect(
        within(compare).getByText('Adicionadas: chunk.nice-to-meet-you'),
      ).toBeInTheDocument();
      expect(
        within(compare).getByText('Etapa 4: Produção livre adicionada'),
      ).toBeInTheDocument();
      expect(
        within(compare).getByText('3 etapas sem mudança'),
      ).toBeInTheDocument();
    });

    it('escolher duas versões iguais pede para escolher outras', async () => {
      await openLesson();

      const compare = screen
        .getByRole('heading', { name: 'Comparar versões' })
        .closest('section') as HTMLElement;

      await userEvent.selectOptions(
        within(compare).getByLabelText('De'),
        'version-1-2',
      );

      expect(
        within(compare).getByText(
          'Escolha duas versões diferentes para comparar.',
        ),
      ).toBeInTheDocument();
    });

    it('lição com uma versão só não mostra a comparação', async () => {
      await openLesson('lesson-2');

      expect(
        screen.queryByRole('heading', { name: 'Comparar versões' }),
      ).not.toBeInTheDocument();
    });
  });
});
