/**
 * As regras do banco de questões moram em `packages/shared`
 * (`item-validation.ts`), porque o editor do admin precisa dizer o mesmo que
 * a API. Este arquivo só mantém o caminho antigo dentro do módulo.
 */
export {
  IMMUTABLE_ITEM_FIELDS,
  immutableFieldChanges,
  parseItemContent,
  requiresNewItem,
  validateItem,
  type ImmutableItemField,
  type ItemDefinition,
  type ItemIssue,
} from '@english-saas/shared';
