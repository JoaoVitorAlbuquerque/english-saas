import { curriculumSeed } from './curriculum.seed';
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
  curriculumSeed,
  // 5 content-studio — áudio das cenas gerado pelo TTS
  // 11 billing    — planos e preços
];

export type { SeedModule };
