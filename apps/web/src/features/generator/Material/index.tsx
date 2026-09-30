import type { AnswerResult, MaterialDetail } from '@english-saas/api-client';
import { CEFR_LEVEL_LABELS } from '@english-saas/shared';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  ItemRenderer,
  MarkedText,
  Skeleton,
  SpokenStandardToggle,
  toItemView,
} from '@english-saas/ui';
import type { ReactNode } from 'react';

import { t } from '../../../messages/pt-BR';
import {
  useMaterialController,
  type RateOption,
} from './useMaterialController';

type Controller = ReturnType<typeof useMaterialController>;

const RATE_OPTIONS: { option: RateOption; label: string }[] = [
  { option: 'LIKED', label: t('material.rateLiked') },
  { option: 'TOO_EASY', label: t('material.rateTooEasy') },
  { option: 'TOO_HARD', label: t('material.rateTooHard') },
];

export function Material() {
  const controller = useMaterialController();
  const { isLoading, isError, retry, material } = controller;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || material === null) {
    return <ErrorState title={t('material.errorTitle')} onRetry={retry} />;
  }

  const { content } = material;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink">{material.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            {material.level} · {CEFR_LEVEL_LABELS[material.level]}
          </Badge>
          <span className="text-xs text-muted">{material.topic}</span>
        </div>
        <Attribution material={material} />
      </header>

      <Section title={t('material.textTitle')} hint={t('material.textHint')}>
        <MarkedText
          text={content.text}
          spans={content.spans}
          describeSpan={(span) => controller.explanationFor(span)}
          className="whitespace-pre-line text-base leading-relaxed text-ink"
        />
      </Section>

      {content.grammarSpotlight.length > 0 ? (
        <Section title={t('material.spotlightTitle')}>
          <div className="flex flex-col gap-3">
            {content.grammarSpotlight.map((entry) => (
              <div key={entry.skillId} className="rounded-xl bg-ground p-3">
                <p className="font-medium text-ink">{entry.structure}</p>
                <p className="mt-1 text-sm text-muted">
                  {entry.explanationPtBr}
                </p>
                {entry.examplesFromText.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {entry.examplesFromText.map((example) => (
                      <li key={example} className="text-sm italic text-ink">
                        &ldquo;{example}&rdquo;
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {content.spokenVersion.lines.length > 0 ? (
        <Section title={t('material.spokenTitle')}>
          <p className="text-sm text-muted">{content.spokenVersion.setup}</p>
          <div className="mt-3 flex flex-col gap-4">
            {content.spokenVersion.lines.map((line, index) => (
              <div key={index} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">
                  {line.speaker}
                </span>
                {line.standard !== null && line.standard !== line.spoken ? (
                  <SpokenStandardToggle
                    spoken={line.spoken}
                    standard={line.standard}
                  />
                ) : (
                  <p className="text-base text-ink">{line.spoken}</p>
                )}
              </div>
            ))}
          </div>
          {content.registerNotes.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink">
                {t('material.registerNotesTitle')}
              </p>
              {content.registerNotes.map((note) => (
                <p key={note.spoken} className="text-sm text-muted">
                  <span className="text-ink">{note.spoken}</span> ×{' '}
                  <span className="text-ink">{note.standard}</span> —{' '}
                  {note.notePtBr}
                </p>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {content.vocabulary.length > 0 ? (
        <Section title={t('material.vocabularyTitle')}>
          <Vocabulary material={material} controller={controller} />
        </Section>
      ) : null}

      {material.exercises.length > 0 ? (
        <Section title={t('material.exercisesTitle')}>
          <Exercises material={material} controller={controller} />
        </Section>
      ) : null}

      <Section title={t('material.rateTitle')}>
        <div className="flex flex-wrap gap-2" role="group">
          {RATE_OPTIONS.map(({ option, label }) => (
            <Chip
              key={option}
              selected={controller.rateOption === option}
              disabled={controller.isRating}
              onClick={() => controller.rateMaterial(option)}
            >
              {label}
            </Chip>
          ))}
        </div>
        {controller.rateSaved ? (
          <p role="status" className="mt-2 text-sm text-muted">
            {t('material.rateThanks')}
          </p>
        ) : null}
      </Section>
    </article>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {children}
    </Card>
  );
}

/** "Baseado em: Wikipedia — [título], CC BY-SA", o link do artigo, ou o texto colado. */
function Attribution({ material }: { material: MaterialDetail }) {
  const { attribution, referenceUrl } = material;

  if (attribution !== null) {
    return (
      <p className="text-xs text-muted">
        {t('material.basedOn')} {attribution.provider} —{' '}
        <a
          href={attribution.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          {attribution.title}
        </a>
        ,{' '}
        {attribution.licenseUrl ? (
          <a
            href={attribution.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {attribution.license}
          </a>
        ) : (
          attribution.license
        )}
      </p>
    );
  }

  if (referenceUrl !== null) {
    return (
      <p className="text-xs text-muted">
        {t('material.basedOn')}{' '}
        <a
          href={referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-accent underline"
        >
          {referenceUrl}
        </a>
      </p>
    );
  }

  return <p className="text-xs text-muted">{t('material.basedOnPasted')}</p>;
}

function Vocabulary({
  material,
  controller,
}: {
  material: MaterialDetail;
  controller: Controller;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {material.content.vocabulary.map((entry) => {
        const isPending = controller.pendingTermKey === entry.termKey;

        return (
          <li
            key={entry.termKey}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-ink">
                {entry.term}{' '}
                <span className="font-mono text-xs text-muted">
                  {entry.cefr}
                </span>
              </span>
              <span className="text-sm text-muted">{entry.meaningPtBr}</span>
              <span className="text-sm italic text-ink">{entry.example}</span>
            </div>
            {entry.inReview ? (
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="ok">{t('material.inReview')}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => controller.toggleTerm(entry.termKey, false)}
                  aria-label={`${t('material.removeFromReview')}: ${entry.term}`}
                >
                  {t('material.removeFromReview')}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 self-start"
                disabled={isPending}
                onClick={() => controller.toggleTerm(entry.termKey, true)}
                aria-label={`${t('material.addToReview')}: ${entry.term}`}
              >
                {t('material.addToReview')}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Exercises({
  material,
  controller,
}: {
  material: MaterialDetail;
  controller: Controller;
}) {
  return (
    <ol className="flex flex-col gap-6">
      {material.exercises.map((exercise, index) => {
        const result: AnswerResult | undefined =
          controller.answers[exercise.id];
        // Respondido numa visita anterior: só o acerto volta da API (uma
        // resposta por exercício — refazer não conta de novo).
        const answeredBefore = result === undefined && exercise.answer !== null;

        return (
          <li key={exercise.id} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted">
              {index + 1} / {material.exercises.length}
            </span>
            {answeredBefore ? (
              <Badge tone={exercise.answer?.isCorrect ? 'ok' : 'error'}>
                {exercise.answer?.isCorrect
                  ? t('material.alreadyCorrect')
                  : t('material.alreadyWrong')}
              </Badge>
            ) : null}
            <ItemRenderer
              item={toItemView(exercise, exercise.assets)}
              mode="practice"
              feedback={result ?? null}
              disabled={
                answeredBefore ||
                result !== undefined ||
                controller.answeringItemId !== null
              }
              onAnswer={(payload) => controller.answer(exercise.id, payload)}
            />
            {controller.answerErrorItemId === exercise.id ? (
              <p role="alert" className="text-sm text-error">
                {t('material.answerError')}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
