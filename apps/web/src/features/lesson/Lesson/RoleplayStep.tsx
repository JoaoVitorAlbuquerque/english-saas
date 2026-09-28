import {
  useFinishRoleplay,
  useRoleplay,
  useStartRoleplay,
  useSubmitRoleplayTurn,
} from '@english-saas/api-client';
import type { CatalogLesson } from '@english-saas/api-client';
import {
  Badge,
  Button,
  Card,
  CharacterAvatar,
  Chip,
  Input,
} from '@english-saas/ui';
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

export function RoleplayStep({
  content,
  lessonId,
  stepIndex,
  targetSkills,
  onContinue,
}: RoleplayStepProps) {
  const [roleplayId, setRoleplayId] = useState<string | null>(null);
  const [text, setText] = useState('');
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
  const lastCharacterTurn = [...(view?.turns ?? [])]
    .reverse()
    .find((turn) => turn.role === 'CHARACTER' && turn.feedback);
  const helpPhrase = lastCharacterTurn?.feedback?.helpPhrase ?? null;
  const hasPendingTurn =
    view?.turns.some((turn) => turn.status === 'PENDING') ?? false;
  const isFinished = view?.status === 'FINISHED';

  function skillTitle(skillId: string): string {
    return targetSkills.find((skill) => skill.id === skillId)?.title ?? skillId;
  }

  function handleSend(): void {
    if (view === undefined || text.trim().length === 0) {
      return;
    }

    submitTurn.mutate({ id: view.id, input: { text: text.trim() } });
    setText('');
  }

  if (view === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-sm text-muted">
        {t('lesson.roleplay.preparing')}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <p className="text-sm text-ink">{content.scenario}</p>

      <div className="flex flex-wrap gap-2">
        {view.goals.map((goal) => (
          <Badge key={goal.id} tone={goal.met ? 'ok' : 'muted'}>
            {goal.description}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {view.turns.map((turn) => (
          <div
            key={turn.index}
            className={`flex items-start gap-2 ${turn.role === 'STUDENT' ? 'flex-row-reverse' : ''}`}
          >
            {turn.role === 'CHARACTER' ? (
              <CharacterAvatar name={view.character.name} size="sm" />
            ) : null}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                turn.role === 'STUDENT'
                  ? 'bg-accent text-white'
                  : 'border border-line bg-surface text-ink'
              }`}
            >
              {turn.status === 'PENDING' ? '…' : turn.text}
              {turn.feedback?.inlineCorrection ? (
                <p className="mt-1 text-xs text-muted">
                  {turn.feedback.inlineCorrection.original} →{' '}
                  {turn.feedback.inlineCorrection.suggestion}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!isFinished ? (
        <div className="flex flex-col gap-2">
          {helpPhrase ? (
            <Chip type="button" onClick={() => setText(helpPhrase)}>
              {t('lesson.roleplay.helpPrefix')}: {helpPhrase}
            </Chip>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('lesson.roleplay.placeholder')}
              disabled={hasPendingTurn || view.turnsLeft <= 0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={
                hasPendingTurn ||
                view.turnsLeft <= 0 ||
                text.trim().length === 0
              }
            >
              {t('lesson.common.send')}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => finish.mutate(view.id)}
            className="self-end"
          >
            {t('lesson.roleplay.finish')}
          </Button>
        </div>
      ) : null}

      {isFinished && view.summary ? (
        <Card className="flex flex-col gap-3">
          <h3 className="font-display text-lg text-ink">
            {t('lesson.roleplay.summaryTitle')}
          </h3>

          <div className="flex flex-col gap-1">
            {view.summary.goals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-2 text-sm">
                <Badge tone={goal.met ? 'ok' : 'error'}>
                  {goal.met
                    ? t('lesson.rubric.met')
                    : t('lesson.rubric.notMet')}
                </Badge>
                <p className="text-ink">{goal.description}</p>
              </div>
            ))}
          </div>

          {view.summary.topCorrections.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {view.summary.topCorrections.map((correction, index) => (
                <div key={index} className="text-sm">
                  <p>
                    <s className="text-muted">{correction.original}</s>{' '}
                    <span className="text-ink">{correction.suggestion}</span>
                  </p>
                  <p className="text-muted">{correction.explanationPtBr}</p>
                </div>
              ))}
            </div>
          ) : null}

          {view.summary.expressionSkillIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {view.summary.expressionSkillIds.map((skillId) => (
                <Badge key={skillId} tone="accent">
                  {skillTitle(skillId)}
                </Badge>
              ))}
            </div>
          ) : null}

          <Button onClick={onContinue} className="self-end">
            {t('lesson.common.continue')}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
