import {
  useFinishRoleplay,
  useRoleplay,
  useStartRoleplay,
  useSubmitRoleplayTurn,
} from '@english-saas/api-client';
import type { CatalogLesson } from '@english-saas/api-client';
import { RoleplayView } from '@english-saas/ui';
import type { RoleplayContent } from '@english-saas/shared';
import { useEffect, useRef, useState } from 'react';

import { t } from '../../../messages/pt-BR';

export type RoleplayStepProps = {
  content: RoleplayContent;
  lessonId: string;
  stepIndex: number;
  targetSkills: CatalogLesson['targetSkills'];
  onContinue: () => void;
};

/**
 * A tela é `RoleplayView` (packages/ui, também usada no preview do admin);
 * aqui ficam a sessão com a IA, os turnos e o encerramento.
 */
export function RoleplayStep({
  content,
  lessonId,
  stepIndex,
  targetSkills,
  onContinue,
}: RoleplayStepProps) {
  const [roleplayId, setRoleplayId] = useState<string | null>(null);
  const startedRef = useRef(false);

  const start = useStartRoleplay();
  const submitTurn = useSubmitRoleplayTurn();
  const finish = useFinishRoleplay();
  const roleplay = useRoleplay(roleplayId);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start
        .mutateAsync({ lessonId, stepIndex })
        .then((view) => setRoleplayId(view.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = roleplay.data;

  if (view === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-sm text-muted">
        {t('lesson.roleplay.preparing')}
      </div>
    );
  }

  return (
    <RoleplayView
      scenario={content.scenario}
      characterName={view.character.name}
      goals={view.goals}
      turns={view.turns}
      turnsLeft={view.turnsLeft}
      finished={view.status === 'FINISHED'}
      summary={view.summary}
      skillTitle={(skillId) =>
        targetSkills.find((skill) => skill.id === skillId)?.title ?? skillId
      }
      onSend={(text) => submitTurn.mutate({ id: view.id, input: { text } })}
      onFinish={() => finish.mutate(view.id)}
      onContinue={onContinue}
    />
  );
}
