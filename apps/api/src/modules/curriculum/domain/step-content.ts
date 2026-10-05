/**
 * A validação de etapas mora em `packages/shared` (`lesson-validation.ts`),
 * porque o editor do admin precisa dizer o mesmo que a API. Este arquivo só
 * mantém o caminho antigo dentro do módulo.
 */
export {
  parseStep,
  parseStepContent,
  validateSteps,
  type ParsedStep,
  type StepInput,
  type StepIssue,
  type StepValidation,
} from '@english-saas/shared';
