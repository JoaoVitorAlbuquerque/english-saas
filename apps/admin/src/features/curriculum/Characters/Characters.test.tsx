import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { failNext, mockState } from '../../../mocks/curriculum-mock';
import { renderAdminAt } from '../test-helpers';

async function openCharacters() {
  renderAdminAt('/conteudo/personagens');
  await screen.findByRole('heading', { name: 'Personagens' });
  await screen.findByText('Vizinha de Lucas, fala rápido.');
}

const png = () =>
  new File([new Uint8Array([1, 2, 3])], 'maya.png', { type: 'image/png' });

describe('Conteúdo → personagens', () => {
  it('lista o elenco com bio e voz', async () => {
    await openCharacters();

    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('Voz: voice-maya')).toBeInTheDocument();
    expect(screen.getByText('Sem voz definida')).toBeInTheDocument();
  });

  it('cria um personagem: nome, bio, voz e slug sugerido pelo nome', async () => {
    await openCharacters();

    await userEvent.click(
      screen.getByRole('button', { name: 'Novo personagem' }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Dona Rita');

    expect(within(dialog).getByLabelText(/Identificador/)).toHaveValue(
      'dona-rita',
    );

    await userEvent.type(
      within(dialog).getByLabelText(/Bio/),
      'Dona do café da esquina.',
    );
    await userEvent.type(within(dialog).getByLabelText(/Voz/), 'voice-rita');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(await screen.findByText('Dona Rita')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockState.calls.characterWrites).toEqual([
      {
        body: {
          slug: 'dona-rita',
          name: 'Dona Rita',
          bio: 'Dona do café da esquina.',
          voiceId: 'voice-rita',
          avatarAssetId: null,
        },
      },
    ]);
  });

  it('nome curto e slug repetido aparecem no campo', async () => {
    await openCharacters();

    await userEvent.click(
      screen.getByRole('button', { name: 'Novo personagem' }),
    );

    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'A');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    // Nome curto e, junto, o slug sugerido a partir dele ('a').
    expect(
      within(dialog).getAllByText('Escreva ao menos 2 caracteres.'),
    ).toHaveLength(2);
    expect(mockState.calls.characterWrites).toEqual([]);

    await userEvent.clear(within(dialog).getByLabelText('Nome'));
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Maya');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    expect(
      await within(dialog).findByText(/Já existe conteúdo com o identificador/),
    ).toBeInTheDocument();
    expect(mockState.characters).toHaveLength(2);
  });

  it('editar: o slug fica travado e só o que mudou vai para a API', async () => {
    await openCharacters();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Lucas' }));

    const dialog = await screen.findByRole('dialog');
    const slug = within(dialog).getByLabelText(/Identificador/);

    expect(slug).toBeDisabled();
    expect(slug).toHaveValue('lucas');
    expect(
      within(dialog).getByText('O identificador não muda depois de criado.'),
    ).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/Bio/), 'Mora no 4B.');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    await waitFor(() =>
      expect(mockState.characters.find((c) => c.slug === 'lucas')?.bio).toBe(
        'Mora no 4B.',
      ),
    );
    expect(mockState.calls.characterWrites[0]).toMatchObject({
      id: expect.any(String),
      body: { name: 'Lucas', bio: 'Mora no 4B.', voiceId: null },
    });
    expect(mockState.calls.characterWrites[0]?.body).not.toHaveProperty('slug');
  });

  it('avatar: envia a imagem, mostra a prévia e liga ao personagem', async () => {
    await openCharacters();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maya' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.upload(within(dialog).getByLabelText('Avatar'), png());

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Trocar imagem' }),
      ).toBeInTheDocument(),
    );
    expect(mockState.calls.uploads).toEqual([
      { name: 'maya.png', type: 'image/png', size: 3 },
    ]);
    // A prévia é o <img> dentro do avatar.
    expect(dialog.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/images/maya.png',
    );

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    await waitFor(() =>
      expect(
        mockState.characters.find((c) => c.slug === 'maya')?.avatarAssetId,
      ).toBe(mockState.assets[0]?.id),
    );
    // De volta na lista, o card já mostra a foto.
    await waitFor(() =>
      expect(
        [...document.querySelectorAll('img')].some(
          (img) =>
            img.getAttribute('src') ===
            'https://cdn.example.com/images/maya.png',
        ),
      ).toBe(true),
    );
  });

  it('avatar: tipo que não é imagem aceita é barrado antes de enviar', async () => {
    await openCharacters();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maya' }));

    const dialog = await screen.findByRole('dialog');
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(
      within(dialog).getByLabelText('Avatar'),
      new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }),
    );

    expect(
      await within(dialog).findByText('Envie uma imagem JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
    expect(mockState.calls.uploads).toEqual([]);
  });

  it('avatar: arquivo acima de 2 MB é barrado antes de enviar', async () => {
    await openCharacters();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maya' }));

    const dialog = await screen.findByRole('dialog');
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', {
      type: 'image/png',
    });

    await userEvent.upload(within(dialog).getByLabelText('Avatar'), big);

    expect(
      await within(dialog).findByText(
        'A imagem passa de 2 MB. Envie uma menor.',
      ),
    ).toBeInTheDocument();
    expect(mockState.calls.uploads).toEqual([]);
  });

  it('avatar: se a API recusar o envio, mostra a mensagem dela', async () => {
    await openCharacters();
    failNext('upload', {
      status: 422,
      code: 'INVALID_IMAGE',
      message: 'Envie uma imagem JPEG, PNG ou WebP.',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maya' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.upload(within(dialog).getByLabelText('Avatar'), png());

    expect(
      await within(dialog).findByText('Envie uma imagem JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
  });

  it('avatar: dá para tirar a imagem e salvar sem ela', async () => {
    mockState.assets.push({
      id: 'asset-existing',
      mimeType: 'image/png',
      storageKey: 'content/images/x.png',
      url: 'https://cdn.example.com/images/x.png',
    });
    const maya = mockState.characters.find((c) => c.slug === 'maya');

    if (maya) {
      maya.avatarAssetId = 'asset-existing';
    }

    await openCharacters();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Maya' }));

    const dialog = await screen.findByRole('dialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Tirar imagem' }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );

    await waitFor(() =>
      expect(
        mockState.characters.find((c) => c.slug === 'maya')?.avatarAssetId,
      ).toBeNull(),
    );
  });
});
