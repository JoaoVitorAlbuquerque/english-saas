import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';

import { QUEUES } from 'src/infra/queue/queues';
import { ExampleQueueService } from 'src/infra/queue/example/example-queue.service';

import { createTestApp, type TestApp } from './utils/create-test-app';

/** Espera o job sair da fila (concluído ou falho) sem travar o teste. */
async function waitForJob(
  queue: Queue,
  jobId: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);

    if (job) {
      const state = await job.getState();

      if (state === 'completed' || state === 'failed') {
        return state;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Job ${jobId} não concluiu em ${String(timeoutMs)}ms`);
}

describe('Fila de exemplo (e2e)', () => {
  let context: TestApp;
  let queue: Queue;
  let basicAuth: string;

  beforeAll(async () => {
    context = await createTestApp();
    queue = context.app.get<Queue>(getQueueToken(QUEUES.EXAMPLE));

    const user = process.env['BULL_BOARD_USER'] ?? '';
    const password = process.env['BULL_BOARD_PASSWORD'] ?? '';
    basicAuth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await context.close();
  });

  it('processa um job enfileirado pelo serviço', async () => {
    const exampleQueue = context.app.get(ExampleQueueService);

    const { jobId } = await exampleQueue.enqueue('ping do teste');

    await expect(waitForJob(queue, jobId)).resolves.toBe('completed');

    const job = await queue.getJob(jobId);
    expect(job?.returnvalue).toMatchObject({ echo: 'ping do teste' });
  });

  it('exige basic auth no endpoint administrativo', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/admin/example-jobs')
      .send({ message: 'sem credencial' });

    expect(response.status).toBe(401);
  });

  it('enfileira pelo endpoint quando a credencial está correta', async () => {
    const response = await request(context.app.getHttpServer())
      .post('/admin/example-jobs')
      .set('Authorization', basicAuth)
      .send({ message: 'ping autenticado' });

    expect(response.status).toBe(201);
    expect(response.body.jobId).toEqual(expect.any(String));

    await expect(waitForJob(queue, response.body.jobId)).resolves.toBe(
      'completed',
    );
  });
});
