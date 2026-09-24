import { join } from 'node:path';

import { config } from 'dotenv';

// Carrega o .env da raiz do monorepo e aponta o Prisma para o banco de teste
// (serviço `postgres-test` do docker-compose, porta 5433).
config({ path: join(__dirname, '..', '..', '..', '.env') });

process.env['NODE_ENV'] = 'test';

if (process.env['DATABASE_TEST_URL']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'];
}

// Namespace de fila só dos testes. Sem isso, uma API rodando em
// desenvolvimento consome os jobs do teste — e o obliterate do teste apaga a
// fila de desenvolvimento.
process.env['QUEUE_PREFIX'] = `${
  process.env['QUEUE_PREFIX'] ?? 'english-saas'
}-test`;

// Worker de teste processa um job por vez: torna a ordem previsível.
process.env['QUEUE_CONCURRENCY'] = '1';
