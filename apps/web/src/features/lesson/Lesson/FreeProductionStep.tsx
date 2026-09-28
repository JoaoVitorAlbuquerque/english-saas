import {
  useCorrectionPoll,
  useCreateCorrection,
  type ApiError,
} from '@english-saas/api-client';
import {
  Badge,
  Button,
  Chip,
  Card,
  SpokenStandardToggle,
  Textarea,
} from '@english-saas/ui';
import type { FreeProductionContent } from '@english-saas/shared';
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { t } from '../../../messages/pt-BR';

export type FreeProductionStepProps = {
  content: FreeProductionContent;
  lessonId: string;
  stepIndex: number;
  /** Conclui a etapa com o texto do aluno — só depois de ele ver a correção. */
  onContinue: (text: string) => void;
};

export function FreeProductionStep({
  content,
  lessonId,
  stepIndex,
  onContinue,
}: FreeProductionStepProps) {
  const [text, setText] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createCorrection = useCreateCorrection();
  const correction = useCorrectionPoll(correctionId);

  const wordCount =
    text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  function insertHelper(helper: string): void {
    setText((current) =>
      current.length === 0 ? helper : `${current} ${helper}`,
    );
    textareaRef.current?.focus();
  }

  function handleSubmit(): void {
    if (text.trim().length === 0 || hasSubmitted) {
      return;
    }

    setHasSubmitted(true);

    createCorrection
      .mutateAsync({ lessonId, stepIndex, text: text.trim() })
      .then((view) => setCorrectionId(view.id))
      .catch((error: ApiError) => {
        if (error.code === 'INSUFFICIENT_AI_CREDITS') {
          setCreditsExhausted(true);
        }
      });
  }

  const result = correction.data?.result ?? null;
  const isCorrecting =
    hasSubmitted &&
    !creditsExhausted &&
    (correction.data === undefined ||
      correction.data.status === 'QUEUED' ||
      correction.data.status === 'TRANSCRIBING');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <Card className="flex flex-col gap-3">
        <p className="text-ink">{content.prompt}</p>

        {content.helpers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {content.helpers.map((helper) => (
              <Chip
                key={helper}
                type="button"
                onClick={() => insertHelper(helper)}
                disabled={hasSubmitted}
              >
                {helper}
              </Chip>
            ))}
          </div>
        ) : null}

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={hasSubmitted}
          rows={5}
          aria-label={t('lesson.production.responseLabel')}
        />
        {content.minWords ? (
          <p className="text-xs text-muted">
            {wordCount} de {content.minWords} palavras
          </p>
        ) : null}

        {!hasSubmitted ? (
          <Button onClick={handleSubmit} disabled={text.trim().length === 0}>
            {t('lesson.production.submit')}
          </Button>
        ) : null}
      </Card>

      {isCorrecting ? (
        <Card
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="size-4 animate-spin text-muted"
            aria-hidden="true"
          />
          <p className="text-sm text-muted">
            {t('lesson.production.correcting')}
          </p>
        </Card>
      ) : null}

      {creditsExhausted ? (
        <Card role="alert" className="text-sm text-error">
          {t('lesson.production.insufficientCredits')}
        </Card>
      ) : null}

      {correction.data &&
      !result &&
      correction.data.status !== 'QUEUED' &&
      correction.data.status !== 'TRANSCRIBING' ? (
        <Card role="status" className="text-sm text-muted">
          {correction.data.message}
        </Card>
      ) : null}

      {result ? (
        <Card className="flex flex-col gap-4">
          {result.fixes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {result.fixes.map((fix, index) => (
                <div key={index} className="text-sm">
                  <p>
                    <s className="text-muted">{fix.original}</s>{' '}
                    <span className="font-medium text-ink">
                      {fix.suggestion}
                    </span>
                  </p>
                  <p className="text-muted">{fix.explanationPtBr}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ok">{t('lesson.production.noErrors')}</p>
          )}

          {result.rubric.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-line pt-3">
              {result.rubric.map((item) => (
                <div
                  key={item.goalId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Badge tone={item.met ? 'ok' : 'error'}>
                    {item.met
                      ? t('lesson.rubric.met')
                      : t('lesson.rubric.notMet')}
                  </Badge>
                  <p className="text-ink">{item.comment}</p>
                </div>
              ))}
            </div>
          ) : null}

          {result.registerTips.map((tip, index) => (
            <SpokenStandardToggle
              key={index}
              spoken={tip.naturalSpokenForm}
              standard={tip.standardForm}
              className="border-t border-line pt-3"
            />
          ))}

          <div className="border-t border-line pt-3 text-sm">
            <p className="text-muted">
              {t('lesson.production.correctedVersion')}
            </p>
            <p className="text-ink">{result.corrected}</p>
          </div>

          <p className="text-sm text-muted">{result.encouragement}</p>
        </Card>
      ) : null}

      {hasSubmitted ? (
        <Button onClick={() => onContinue(text.trim())} className="self-end">
          {t('lesson.common.continue')}
        </Button>
      ) : null}
    </div>
  );
}
