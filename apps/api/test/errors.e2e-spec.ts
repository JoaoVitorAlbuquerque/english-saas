import { apiErrorSchema } from '@english-saas/shared';
import request from 'supertest';

import { createTestApp, type TestApp } from './utils/create-test-app';

describe('Formato de erro (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  it('responde 404 no envelope { error: { code, message } }', async () => {
    const response = await request(context.app.getHttpServer()).get(
      '/rota-que-nao-existe',
    );

    expect(response.status).toBe(404);
    expect(() => apiErrorSchema.parse(response.body)).not.toThrow();
    expect(response.body.error.code).toBe('NOT_FOUND');
    // Código em inglês, mensagem em pt-BR para o aluno.
    expect(response.body.error.message).toBe(
      'Não encontramos o que você procura.',
    );
  });

  it('devolve o requestId no header junto do erro', async () => {
    const response = await request(context.app.getHttpServer()).get(
      '/rota-que-nao-existe',
    );

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('reporta falha de validação do zod com os detalhes', async () => {
    const user = process.env['BULL_BOARD_USER'] ?? '';
    const password = process.env['BULL_BOARD_PASSWORD'] ?? '';
    const basicAuth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

    const response = await request(context.app.getHttpServer())
      .post('/admin/example-jobs')
      .set('Authorization', basicAuth)
      .send({ message: '' });

    expect(response.status).toBe(400);
    expect(() => apiErrorSchema.parse(response.body)).not.toThrow();
    expect(response.body.error.details).toBeDefined();
  });
});
