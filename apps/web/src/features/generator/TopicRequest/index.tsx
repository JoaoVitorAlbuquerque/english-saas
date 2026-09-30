import {
  Button,
  Card,
  Chip,
  ErrorState,
  Input,
  Skeleton,
  Textarea,
} from '@english-saas/ui';
import { Shuffle } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { PlusSample } from '../components/PlusSample';
import { RequestProblemView } from '../components/RequestProblemView';
import { useTopicRequestController } from './useTopicRequestController';

export function TopicRequest() {
  const controller = useTopicRequestController();
  const {
    isGateLoading,
    isGateError,
    retryGate,
    isPlus,
    credits,
    timeZone,
    cost,
    stage,
  } = controller;

  if (isGateLoading) {
    return <Skeleton className="h-48" />;
  }

  if (isGateError) {
    return <ErrorState title={t('tools.errorTitle')} onRetry={retryGate} />;
  }

  if (!isPlus) {
    return <PlusSample />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl text-ink">{t('topic.title')}</h1>

      {stage === 'interest' ? (
        <InterestStage controller={controller} />
      ) : (
        <SuggestionsStage controller={controller} />
      )}

      <RequestProblemView
        problem={controller.generateProblem}
        credits={credits}
        timeZone={timeZone}
      />
      <p className="font-mono text-xs text-muted">
        {t('tools.cost', { cost })}
      </p>
    </div>
  );
}

type Controller = ReturnType<typeof useTopicRequestController>;

function InterestStage({ controller }: { controller: Controller }) {
  const {
    interestText,
    setInterestText,
    interestShortcuts,
    askSuggestions,
    isAsking,
    askProblem,
    credits,
    timeZone,
    surprise,
    isGenerating,
  } = controller;

  return (
    <Card className="flex flex-col gap-4">
      <Textarea
        label={t('topic.interestLabel')}
        placeholder={t('topic.interestPlaceholder')}
        value={interestText}
        maxLength={500}
        rows={3}
        onChange={(event) => setInterestText(event.target.value)}
      />

      {interestShortcuts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">{t('topic.fromProfile')}</span>
          <div className="flex flex-wrap gap-2">
            {interestShortcuts.map((shortcut) => (
              <Chip
                key={shortcut.topic}
                selected={interestText === shortcut.label}
                onClick={() => setInterestText(shortcut.label)}
              >
                {shortcut.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Button
          className="w-full sm:w-auto sm:self-start"
          disabled={interestText.trim().length < 2}
          isLoading={isAsking}
          onClick={askSuggestions}
        >
          {t('topic.suggest')}
        </Button>
        <span className="text-xs text-muted">{t('topic.suggestFree')}</span>
      </div>

      <RequestProblemView
        problem={askProblem}
        credits={credits}
        timeZone={timeZone}
      />

      <Button
        variant="ghost"
        className="self-start"
        disabled={isGenerating}
        onClick={surprise}
        leftIcon={<Shuffle className="size-4" aria-hidden="true" />}
      >
        {t('topic.surprise')}
      </Button>
    </Card>
  );
}

function SuggestionsStage({ controller }: { controller: Controller }) {
  const {
    isThinking,
    suggestionsFailed,
    suggestionsMessage,
    suggestions,
    changeInterest,
    chooseSuggestion,
    ownTitle,
    setOwnTitle,
    chooseOwnTitle,
    surprise,
    isGenerating,
  } = controller;

  if (isThinking) {
    return (
      <Card className="flex flex-col gap-3" aria-busy="true">
        <p className="text-sm text-muted">{t('topic.thinking')}</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </Card>
    );
  }

  if (suggestionsFailed) {
    return (
      <Card className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-ink">
          {suggestionsMessage}
        </p>
        <Button variant="ghost" className="self-start" onClick={changeInterest}>
          {t('topic.again')}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink">
          {t('topic.suggestionsTitle')}
        </h2>
        <button
          type="button"
          onClick={changeInterest}
          className="text-sm font-medium text-accent underline"
        >
          {t('topic.again')}
        </button>
      </div>

      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="flex flex-col gap-2">
          <h3 className="font-medium text-ink">{suggestion.title}</h3>
          <p className="text-sm text-muted">{suggestion.whyInteresting}</p>
          <Button
            className="w-full sm:w-auto sm:self-start"
            disabled={isGenerating}
            onClick={() => chooseSuggestion(suggestion.id)}
            aria-label={`${t('topic.choose')}: ${suggestion.title}`}
          >
            {t('topic.choose')}
          </Button>
        </Card>
      ))}

      <Card className="flex flex-col gap-2">
        <Button
          variant="ghost"
          className="self-start"
          disabled={isGenerating}
          onClick={surprise}
          leftIcon={<Shuffle className="size-4" aria-hidden="true" />}
        >
          {t('topic.surprise')}
        </Button>
        <span className="text-xs text-muted">{t('topic.surpriseHint')}</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <Input
          label={t('topic.ownTitleLabel')}
          placeholder={t('topic.ownTitlePlaceholder')}
          value={ownTitle}
          maxLength={160}
          onChange={(event) => setOwnTitle(event.target.value)}
        />
        <Button
          variant="ghost"
          className="self-start"
          disabled={isGenerating || ownTitle.trim().length < 2}
          onClick={chooseOwnTitle}
        >
          {t('topic.ownTitleSubmit')}
        </Button>
      </Card>
    </div>
  );
}
