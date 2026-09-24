import type { PrismaClient } from '@prisma/client';

/**
 * Um seed por módulo. O runner executa todos na ordem do registry, e cada um
 * precisa ser idempotente — o seed roda de novo a cada `pnpm db:seed`, então
 * use `upsert` ou cheque antes de inserir.
 */
export type SeedModule = {
  /** Nome do módulo, igual ao da tabela do CLAUDE.md. */
  name: string;
  run: (prisma: PrismaClient) => Promise<void>;
};
