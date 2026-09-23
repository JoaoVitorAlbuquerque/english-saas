import { config } from 'dotenv';
import { join } from 'node:path';

// Carrega o .env da raiz do monorepo e aponta o Prisma para o banco de teste
// (serviço `postgres-test` do docker-compose, porta 5433).
config({ path: join(__dirname, '..', '..', '..', '.env') });

process.env['NODE_ENV'] = 'test';

if (process.env['DATABASE_TEST_URL']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'];
}
