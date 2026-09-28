import { ErrorState } from '@english-saas/ui';

import { FullScreenLoader } from '../../../components/FullScreenLoader';
import { t } from '../../../messages/pt-BR';
import { ExitConfirmDialog } from './ExitConfirmDialog';
import { ExplanationCardsStep } from './ExplanationCardsStep';
import { FreeProductionStep } from './FreeProductionStep';
import { PracticeStep } from './PracticeStep';
import { RoleplayStep } from './RoleplayStep';
import { SceneStep } from './SceneStep';
import { SummaryStep } from './SummaryStep';
import { TopBar } from './TopBar';
import { useLessonController } from './useLessonController';

export function Lesson() {
  const controller = useLessonController();
  const { lesson, attempt } = controller;

  if (controller.isLoadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
        <ErrorState
          title={t('lesson.error.loadTitle')}
          onRetry={controller.retryLoad}
        />
      </div>
    );
  }

  if (controller.isLoading || lesson === null || attempt === null) {
    return <FullScreenLoader label={t('lesson.loading')} />;
  }

  const displayStepIndex = Math.min(
    controller.currentStepIndex,
    lesson.steps.length - 1,
  );
  const step = lesson.steps[displayStepIndex];

  return (
    <div className="min-h-dvh bg-ground pb-10">
      <TopBar
        lesson={lesson}
        stepIndex={displayStepIndex}
        totalSteps={lesson.steps.length}
        sessionXp={controller.completionXp?.total ?? controller.sessionXp}
        onExit={controller.openExitDialog}
      />

      {controller.error ? (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <ErrorState description={controller.error} />
        </div>
      ) : null}

      {step?.type === 'SCENE' ? (
        <SceneStep
          content={step.content}
          characters={lesson.characters}
          assets={lesson.assets}
          onContinue={() => controller.onCompleteStep()}
        />
      ) : null}

      {step?.type === 'EXPLANATION_CARDS' ? (
        <ExplanationCardsStep
          content={step.content}
          onContinue={() => controller.onCompleteStep()}
        />
      ) : null}

      {step?.type === 'PRACTICE' ? (
        <PracticeStep
          content={step.content}
          items={lesson.items}
          assets={lesson.assets}
          answeredItemIds={attempt.answeredItemIds}
          answers={controller.answers}
          onAnswer={controller.onSubmitAnswer}
          onContinue={() => controller.onCompleteStep()}
        />
      ) : null}

      {step?.type === 'FREE_PRODUCTION' ? (
        <FreeProductionStep
          content={step.content}
          lessonId={lesson.id}
          stepIndex={displayStepIndex}
          onContinue={(text) => controller.onCompleteStep({ text })}
        />
      ) : null}

      {step?.type === 'ROLEPLAY' ? (
        <RoleplayStep
          content={step.content}
          lessonId={lesson.id}
          stepIndex={displayStepIndex}
          targetSkills={lesson.targetSkills}
          onContinue={() => controller.onCompleteStep()}
        />
      ) : null}

      {step?.type === 'SUMMARY' ? (
        <SummaryStep
          content={step.content}
          attempt={attempt}
          sessionXp={controller.sessionXp}
          completionXp={controller.completionXp}
          answers={controller.answers}
          onFinish={controller.onFinishLesson}
          isFinishing={controller.isFinishingLesson}
          onRestart={controller.onRestart}
          isRestarting={controller.isRestarting}
          goToToday={controller.goToToday}
        />
      ) : null}

      <ExitConfirmDialog
        open={controller.isExitDialogOpen}
        onClose={controller.closeExitDialog}
        onConfirm={controller.confirmExit}
      />
    </div>
  );
}
