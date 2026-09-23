import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed do conteúdo base — igual para todos os alunos.
 *
 * Vai crescer com os módulos: personagens e cenas (4 curriculum),
 * lições e itens (5 content-studio), planos e preços (11 billing).
 */
async function main(): Promise<void> {
  console.warn('Seed: nada a semear ainda (módulo 0 — setup).');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
