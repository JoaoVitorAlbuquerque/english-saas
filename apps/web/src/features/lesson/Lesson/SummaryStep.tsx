import { usePlan } from '@english-saas/api-client';
import type {
  AnswerResult,
  AttemptView,
  CompletionResult,
} from '@english-saas/api-client';
import { SummaryView } from '@english-saas/ui';
import type { SummaryContent } from '@english-saas/shared';
import { useNavigate } from 'react-router-dom';

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

/**
 * A tela é `SummaryView` (packages/ui, também usada no preview do admin);
 * aqui ficam o XP, a taxa de acerto e a próxima lição do plano.
 */
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

  return (
    <SummaryView
      content={content}
      completed={attempt.status === 'COMPLETED'}
      onFinish={onFinish}
      isFinishing={isFinishing}
      xp={completionXp?.total ?? sessionXp}
      accuracy={accuracy}
      nextLesson={nextLesson}
      onStartNextLesson={() => {
        if (nextLesson !== null) {
          navigate(`/licoes/${nextLesson.slug}`);
        }
      }}
      onGoToPlan={goToToday}
      onRestart={onRestart}
      isRestarting={isRestarting}
    />
  );
}
