import type { SeedModule } from './seed-module';
import { usersSeed } from './users.seed';

/**
 * Registry dos seeds, na ordem de execução — que é a ordem de dependência
 * dos módulos no CLAUDE.md.
 *
 * Para acrescentar: crie `prisma/seeds/<modulo>.seed.ts` exportando um
 * `SeedModule` e registre aqui.
 */
export const seedModules: SeedModule[] = [
  usersSeed,
  // 4 curriculum  — personagens, temporadas, trilhas
  // 5 content-studio — lições e itens de exemplo
  // 11 billing    — planos e preços
];

export type { SeedModule };
