import type { AdminCharacter } from '@english-saas/api-client';

import type { StepContent } from '../../lib/step-content';
import type { FieldIssue } from '../../lib/validation';

/** O que todo editor de etapa recebe. */
export type StepEditorProps = {
  /** Conteúdo da etapa (rascunho, pode estar incompleto). */
  content: StepContent;
  onChange: (content: StepContent) => void;
  /** Problemas desta etapa, por caminho dentro dela. */
  issues: FieldIssue[];
  readOnly: boolean;
  characters: AdminCharacter[];
};
