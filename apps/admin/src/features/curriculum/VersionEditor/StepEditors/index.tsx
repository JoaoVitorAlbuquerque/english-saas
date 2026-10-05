import type { LessonStepType } from '@english-saas/shared';

import { CardsEditor } from './CardsEditor';
import { FreeProductionEditor } from './FreeProductionEditor';
import { PracticeEditor } from './PracticeEditor';
import { RoleplayEditor } from './RoleplayEditor';
import { SceneEditor } from './SceneEditor';
import { SummaryEditor } from './SummaryEditor';
import type { StepEditorProps } from './types';

export type { StepEditorProps } from './types';

/** O editor específico de cada tipo de etapa. */
export function StepEditor({
  type,
  ...props
}: StepEditorProps & { type: LessonStepType }) {
  switch (type) {
    case 'SCENE':
      return <SceneEditor {...props} />;
    case 'EXPLANATION_CARDS':
      return <CardsEditor {...props} />;
    case 'PRACTICE':
      return <PracticeEditor {...props} />;
    case 'FREE_PRODUCTION':
      return <FreeProductionEditor {...props} />;
    case 'ROLEPLAY':
      return <RoleplayEditor {...props} />;
    case 'SUMMARY':
      return <SummaryEditor {...props} />;
  }
}
