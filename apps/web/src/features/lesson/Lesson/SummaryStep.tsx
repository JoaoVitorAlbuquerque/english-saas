import { usePlan } from '@english-saas/api-client';
import type {
  AnswerResult,
  AttemptView,
  CompletionResult,
} from '@english-saas/api-client';
import { Badge, Button, Card } from '@english-saas/ui';
import type { SummaryContent } from '@english-saas/shared';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';

export type SummaryStepProps = {
  content: SummaryContent;
  attempt: AttemptView;
  sessionXp: number;
  completionXp: CompletionResult['xp'] | null;
  answers: Record<string, AnswerResult>;
  onFinish: () => void;
  isFinishing: boolean;
  onRestart: () => void;
  isRestarting: boolean;
  goToToday: () => void;
};

export function SummaryStep({
  content,
  attempt,
  sessionXp,
  completionXp,
  answers,
  onFinish,
  isFinishing,
  onRestart,
  isRestarting,
  goToToday,
}: SummaryStepProps) {
  const navigate = useNavigate();
  const plan = usePlan();
  const nextLesson = plan.data?.path[0] ?? null;

  const answerList = Object.values(answers);
  const accuracy =
    answerList.length > 0
      ? Math.round(
          (answerList.filter((answer) => answer.isCorrect).length /
            answerList.length) *
            100,
        )
      : null;

  const isCompleted = attempt.status === 'COMPLETED';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">
          {t('lesson.summary.takeawaysTitle')}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {content.takeaways.map((takeaway, index) => (
            <li key={index}>{takeaway}</li>
          ))}
        </ul>
      </Card>

      {!isCompleted ? (
        <Button onClick={onFinish} isLoading={isFinishing} className="self-end">
          {t('lesson.summary.finish')}
        </Button>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge tone="accent">{completionXp?.total ?? sessionXp} XP</Badge>
              {accuracy !== null ? (
                <Badge tone="ok">
                  {accuracy}
                  {t('lesson.summary.accuracySuffix')}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted">
              {t('lesson.summary.reviewNote')}
            </p>
          </Card>

          {nextLesson !== null ? (
            <Card className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {t('lesson.summary.nextLessonLabel')}
              </p>
              <p className="text-ink">{nextLesson.title}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate(`/licoes/${nextLesson.slug}`)}
                  className="self-start"
                >
                  {t('lesson.summary.startNextLesson')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={goToToday}
                  className="self-start"
                >
                  {t('lesson.summary.goToPlan')}
                </Button>
              </div>
            </Card>
          ) : null}

          <Button
            variant="ghost"
            onClick={onRestart}
            isLoading={isRestarting}
            className="self-end"
          >
            {t('lesson.summary.retake')}
          </Button>
        </>
      )}
    </div>
  );
}
