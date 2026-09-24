import request from 'supertest';

import { buildOpenApiDocument } from 'src/common/swagger/setup-swagger';

import { createTestApp, type TestApp } from './utils/create-test-app';

describe('Swagger em /docs (e2e)', () => {
  let context: TestApp;

  beforeAll(async () => {
    context = await createTestApp({ swagger: true });
  });

  afterAll(async () => {
    await context.close();
  });

  it('serve a página do Swagger', async () => {
    const response = await request(context.app.getHttpServer()).get('/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });

  it('serve o documento OpenAPI com as rotas registradas', async () => {
    const response = await request(context.app.getHttpServer()).get(
      '/docs-json',
    );

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining(['/health', '/admin/example-jobs']),
    );
  });

  it('descreve o body do job de exemplo a partir do DTO zod', () => {
    const document = buildOpenApiDocument(context.app, 'http://localhost:3333');

    const dto = document.components?.schemas?.['EnqueueExampleJobDto'];

    // Sem a integração do nestjs-zod, o schema viria sem propriedade nenhuma.
    expect(dto).toBeDefined();
    expect(JSON.stringify(dto)).toContain('message');
  });
});
