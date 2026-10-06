/**
 * A projeção do item para o aluno mora em `packages/shared`
 * (`student-view.ts`): o preview do admin monta a mesma visão a partir do
 * item que está sendo editado. Este arquivo só mantém o caminho antigo.
 */
export {
  stripAnswerKey,
  toStudentItem,
  type AuthoredItem,
  type StudentItem,
} from '@english-saas/shared';
