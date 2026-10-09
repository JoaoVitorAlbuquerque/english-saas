import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { adminState } from '../../mocks/admin-mock';
import { failNext } from '../../mocks/curriculum-mock';
import { renderAdminAt } from '../curriculum/test-helpers';

const MANAGEMENT_ROUTES = [
  '/alunos',
  '/alunos/student-ana',
  '/assinaturas',
  '/metricas',
  '/auditoria',
];

describe('acesso às telas de gestão', () => {
  it.each(MANAGEMENT_ROUTES)(
    'o editor em %s vê o aviso e a tela nem lê dados',
    async (path) => {
      renderAdminAt(path, { role: 'EDITOR' });

      expect(
        await screen.findByRole('heading', { name: 'Área de administração' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/só para administradores/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Voltar ao painel' }),
      ).toHaveAttribute('href', '/');

      // A tela de gestão não chegou a montar: nada foi pedido, nada foi auditado.
      expect(adminState.metricsRequests).toEqual([]);
      expect(adminState.audit.map((entry) => entry.action)).not.toContain(
        'student.view',
      );
    },
  );

  it('o menu do editor não mostra as entradas de gestão nem as filas', async () => {
    renderAdminAt('/conteudo', { role: 'EDITOR' });

    const menu = await screen.findByRole('navigation', {
      name: 'Navegação principal',
    });

    expect(
      within(menu).getByRole('link', { name: 'Conteúdo' }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('link', { name: 'Estúdio IA' }),
    ).toBeInTheDocument();

    for (const name of ['Alunos', 'Assinaturas', 'Métricas', 'Auditoria']) {
      expect(
        within(menu).queryByRole('link', { name }),
      ).not.toBeInTheDocument();
    }
    expect(
      within(menu).queryByRole('link', { name: /Filas/ }),
    ).not.toBeInTheDocument();
  });

  it('o menu do administrador tem tudo, e as filas abrem em outra aba', async () => {
    renderAdminAt('/conteudo', { role: 'ADMIN' });

    const menu = await screen.findByRole('navigation', {
      name: 'Navegação principal',
    });

    for (const [name, href] of [
      ['Alunos', '/alunos'],
      ['Assinaturas', '/assinaturas'],
      ['Métricas', '/metricas'],
      ['Auditoria', '/auditoria'],
    ] as const) {
      expect(within(menu).getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    }

    const queues = within(menu).getByRole('link', {
      name: /Filas \(Bull Board\)/,
    });

    expect(queues).toHaveAttribute(
      'href',
      'http://localhost:3333/admin/queues',
    );
    expect(queues).toHaveAttribute('target', '_blank');
    expect(queues).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(queues).toHaveAccessibleDescription(
      /pede o usuário e a senha de administração do servidor/,
    );
  });

  it('se a API recusar (papel mudou no servidor), a recusa aparece na tela', async () => {
    failNext('users-list', {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar isto.',
    });
    renderAdminAt('/alunos', { role: 'ADMIN' });

    expect(
      await screen.findByText('Você não tem permissão para acessar isto.'),
    ).toBeInTheDocument();
  });
});
