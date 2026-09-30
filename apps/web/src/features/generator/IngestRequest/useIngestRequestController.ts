import {
  INGEST_MAX_CHARS,
  INGEST_MIN_CHARS,
  useIngestContent,
  type IngestRequest,
} from '@english-saas/api-client';
import { useState } from 'react';

import { socialPlatformOf } from '../lib/social-link';
import { useGeneratorRequest } from '../lib/use-generator-request';

export type IngestTab = 'text' | 'link';

export type LengthState =
  | { kind: 'empty' }
  | { kind: 'too-short'; missing: number }
  | { kind: 'too-long'; over: number }
  | { kind: 'ok' };

/** Mesmos limites da API — o aluno vê antes de mandar, não depois do 422. */
export function lengthState(text: string): LengthState {
  const length = text.trim().length;

  if (length === 0) return { kind: 'empty' };
  if (length < INGEST_MIN_CHARS) {
    return { kind: 'too-short', missing: INGEST_MIN_CHARS - length };
  }
  if (length > INGEST_MAX_CHARS) {
    return { kind: 'too-long', over: length - INGEST_MAX_CHARS };
  }
  return { kind: 'ok' };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function useIngestRequestController() {
  const request = useGeneratorRequest('GENERATOR_INGEST');
  const ingest = useIngestContent();

  const [tab, setTab] = useState<IngestTab>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');

  const platform = socialPlatformOf(url);
  // Link de rede social só vai com a transcrição (a API recusa sem).
  const typedText = tab === 'text' ? text : platform !== null ? transcript : '';
  const length = lengthState(typedText);
  const urlOk = isHttpUrl(url);

  const canSubmit =
    !ingest.isPending &&
    (tab === 'text'
      ? length.kind === 'ok'
      : urlOk && (platform === null || length.kind === 'ok'));

  function submit(): void {
    if (!canSubmit) return;

    const body: IngestRequest =
      tab === 'text'
        ? { text: text.trim() }
        : platform !== null
          ? { url: url.trim(), text: transcript.trim() }
          : { url: url.trim() };
    const key = `${tab}:${body.url ?? ''}:${body.text?.length ?? 0}`;

    ingest.mutate(
      { ...body, clientRequestId: request.clientRequestIdFor(key) },
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

    tab,
    setTab,
    text,
    setText,
    url,
    setUrl,
    transcript,
    setTranscript,
    platform,
    typedLength: typedText.trim().length,
    length,
    canSubmit,
    submit,
    isSubmitting: ingest.isPending,
    problem: request.problemOf(ingest.error),
  };
}
