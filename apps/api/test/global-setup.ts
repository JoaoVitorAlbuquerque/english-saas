import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { config } from 'dotenv';

/**
 * Roda uma vez, antes de qualquer suíte e2e: aplica as migrations no banco
 * de teste. O `postgres-test` roda em tmpfs e é recriado quando o container
 * sobe, então ele pode chegar aqui completamente vazio.
 */
export default function globalSetup(): void {
  config({ path: join(__dirname, '..', '..', '..', '.env') });

  const databaseUrl =
    process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error(
      'Defina DATABASE_TEST_URL no .env da raiz para rodar os testes e2e.',
    );
  }

  execSync('prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
