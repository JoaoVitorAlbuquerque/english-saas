import { PrismaClient } from '@prisma/client';

import { seedModules } from './seeds';

const prisma = new PrismaClient();

/**
 * Semeia o conteúdo base — igual para todos os alunos.
 *
 * Não implementa seed nenhum: só executa, em ordem, os seeds que cada módulo
 * registra em `prisma/seeds/index.ts`.
 */
async function main(): Promise<void> {
  if (seedModules.length === 0) {
    console.warn('Seed: nenhum módulo registrado ainda.');
    return;
  }

  for (const seedModule of seedModules) {
    const startedAt = Date.now();
    await seedModule.run(prisma);
    console.warn(`Seed: ${seedModule.name} (${Date.now() - startedAt}ms)`);
  }

  console.warn(`Seed: ${seedModules.length} módulo(s) concluído(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
