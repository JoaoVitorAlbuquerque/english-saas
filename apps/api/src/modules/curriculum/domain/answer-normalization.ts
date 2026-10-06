/**
 * A normalização de resposta digitada mora em `packages/shared`
 * (`answer-normalization.ts`): o editor do admin usa a mesma para avisar de
 * respostas equivalentes. Este arquivo só mantém o caminho antigo.
 */
export {
  answerVariants,
  findErrorPattern,
  matchesAnswer,
  normalizeAnswer,
} from '@english-saas/shared';
