import { ErrorState } from '@english-saas/ui';

import { FullScreenLoader } from '../../../components/FullScreenLoader';
import { t } from '../../../messages/pt-BR';
import { Intro } from './Intro';
import { QuestionView } from './QuestionView';
import { ResultView } from './ResultView';
import { usePlacementController } from './usePlacementController';

export function Placement() {
  const {
    isLoading,
    isLoadError,
    retryLoad,
    needsIntro,
    state,
    currentItem,
    onBegin,
    isBeginning,
    beginError,
    onAnswer,
    onDontKnow,
    isSubmitting,
    submitError,
    goToToday,
  } = usePlacementController();

  if (state === null) {
    if (isLoading) {
      return <FullScreenLoader label="Carregando o nivelamento…" />;
    }

    if (isLoadError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
          <ErrorState
            title={t('placement.error.loadTitle')}
            onRetry={retryLoad}
          />
        </div>
      );
    }

    if (needsIntro) {
      return (
        <Intro
          onBegin={onBegin}
          isBeginning={isBeginning}
          beginError={beginError}
        />
      );
    }

    return <FullScreenLoader label="Carregando o nivelamento…" />;
  }

  if (state.status === 'IN_PROGRESS' && currentItem !== null) {
    return (
      <QuestionView
        state={state}
        currentItem={currentItem}
        onAnswer={onAnswer}
        onDontKnow={onDontKnow}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  }

  if (state.result !== null) {
    return (
      <ResultView
        result={state.result}
        onRetake={onBegin}
        isRetaking={isBeginning}
        retakeError={beginError}
        goToToday={goToToday}
      />
    );
  }

  return <FullScreenLoader label="Carregando o nivelamento…" />;
}
