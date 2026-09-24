import { healthResponseSchema } from '@english-saas/shared';
import request from 'supertest';

import { createTestApp, type TestApp } from './utils/create-test-app';

describe('GET /health (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  it('responde ok com banco, Redis e storage de pé', async () => {
    const response = await request(context.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
        storage: { status: 'up' },
      },
    });
  });

  it('respeita o contrato de health de packages/shared', async () => {
    const response = await request(context.app.getHttpServer()).get('/health');

    expect(() => healthResponseSchema.parse(response.body)).not.toThrow();
  });

  it('devolve o requestId no header para correlacionar com o log', async () => {
    const response = await request(context.app.getHttpServer()).get('/health');

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
