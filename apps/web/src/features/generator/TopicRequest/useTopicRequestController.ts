import {
  FINAL_GENERATION_STATUSES,
  useGenerateTopic,
  useGenerationJob,
  useSuggestTopics,
  type GenerateTopicRequest,
} from '@english-saas/api-client';
import { SUGGESTED_INTEREST_LABELS } from '@english-saas/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useGeneratorRequest } from '../lib/use-generator-request';

/** `?sugestoes=<jobId>`: a tela de sugestões sobrevive a sair e voltar. */
const SUGGEST_PARAM = 'sugestoes';

type Choice =
  | { kind: 'suggestion'; suggestionId: string }
  | { kind: 'title'; title: string }
  | { kind: 'surprise' };

function choiceKey(choice: Choice): string {
  switch (choice.kind) {
    case 'suggestion':
      return `suggestion:${choice.suggestionId}`;
    case 'title':
      return `title:${choice.title.trim().toLowerCase()}`;
    case 'surprise':
      return 'surprise';
  }
}

function choiceBody(choice: Choice): GenerateTopicRequest {
  switch (choice.kind) {
    case 'suggestion':
      return { suggestionId: choice.suggestionId };
    case 'title':
      return { title: choice.title.trim() };
    case 'surprise':
      return { surprise: true };
  }
}

export function useTopicRequestController() {
  const request = useGeneratorRequest('GENERATOR_TOPIC');
  const [searchParams, setSearchParams] = useSearchParams();
  const suggestJobId = searchParams.get(SUGGEST_PARAM);

  const [interestText, setInterestText] = useState('');
  const [ownTitle, setOwnTitle] = useState('');

  const suggest = useSuggestTopics();
  const suggestJob = useGenerationJob(suggestJobId);
  const generate = useGenerateTopic();

  const suggestionsJob = suggestJob.data;
  const isThinking =
    suggestJobId !== null &&
    (suggestionsJob === undefined ||
      !FINAL_GENERATION_STATUSES.includes(suggestionsJob.status));

  const interestShortcuts = request.interests.map((interest) => ({
    topic: interest.topic,
    label:
      SUGGESTED_INTEREST_LABELS[interest.topic] ??
      interest.topic.replace(/-/g, ' '),
  }));

  function askSuggestions(): void {
    const text = interestText.trim();
    if (text.length < 2) return;

    suggest.mutate(
      { interestText: text },
      {
        onSuccess: (job) => setSearchParams({ [SUGGEST_PARAM]: job.id }),
      },
    );
  }

  function choose(choice: Choice): void {
    const key = choiceKey(choice);

    generate.mutate(
      {
        ...choiceBody(choice),
        clientRequestId: request.clientRequestIdFor(key),
      },
      {
        onSuccess: (job) => request.openJob(job, key),
        onError: request.refreshCredits,
      },
    );
  }

  return {
    isGateLoading: request.isGateLoading,
    isGateError: request.isGateError,
    retryGate: request.retryGate,
    isPlus: request.isPlus,
    credits: request.credits,
    timeZone: request.timeZone,
    cost: request.cost,

    stage:
      suggestJobId === null ? ('interest' as const) : ('suggestions' as const),
    interestText,
    setInterestText,
    interestShortcuts,
    askSuggestions,
    isAsking: suggest.isPending,
    askProblem: request.problemOf(suggest.error),

    isThinking,
    suggestionsFailed:
      suggestionsJob !== undefined &&
      (suggestionsJob.status === 'FAILED' ||
        suggestionsJob.status === 'REFUSED'),
    suggestionsMessage: suggestionsJob?.message ?? '',
    suggestions:
      suggestionsJob?.status === 'DONE' ? suggestionsJob.suggestions : [],
    changeInterest: () => setSearchParams({}),

    ownTitle,
    setOwnTitle,
    chooseSuggestion: (suggestionId: string) =>
      choose({ kind: 'suggestion', suggestionId }),
    chooseOwnTitle: () => {
      if (ownTitle.trim().length >= 2)
        choose({ kind: 'title', title: ownTitle });
    },
    surprise: () => choose({ kind: 'surprise' }),
    isGenerating: generate.isPending,
    generateProblem: request.problemOf(generate.error),
  };
}
