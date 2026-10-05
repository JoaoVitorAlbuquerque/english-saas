/**
 * A validação de marcações mora em `packages/shared` (`lesson-validation.ts`),
 * porque o editor do admin precisa dizer o mesmo que a API. Este arquivo só
 * mantém o caminho antigo dentro do módulo.
 */
export {
  sliceSpan,
  sortSpans,
  validateSpans,
  type SpanIssue,
} from '@english-saas/shared';
