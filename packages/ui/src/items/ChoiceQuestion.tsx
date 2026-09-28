import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { useAnswerTimer } from './hooks/use-answer-timer';
import type {
  ItemAnswerPayload,
  ItemFeedback,
  ItemMode,
  OptionView,
} from './types';

export type ChoiceQuestionProps = {
  options: OptionView[];
  mode: ItemMode;
  onAnswer?: (payload: ItemAnswerPayload) => void;
  feedback?: ItemFeedback | null;
  disabled?: boolean;
};

/**
 * Lista de alternativas de seleção única — MULTIPLE_CHOICE, LISTEN_CHOOSE e
 * a pergunta de READING_COMPREHENSION são a mesma interação por baixo.
 *
 * Teclado: dígitos 1–4 escolhem a alternativa nessa posição, Enter confirma.
 */
export function ChoiceQuestion({
  options,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ChoiceQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;

  const correctOptionIds =
    feedback && 'optionIds' in feedback.correctAnswer
      ? feedback.correctAnswer.optionIds
      : [];

  function submit() {
    if (!isInteractive || !selectedId) {
      return;
    }

    onAnswer?.({
      response: { optionIds: [selectedId] },
      responseTimeMs: elapsed(),
      hintsUsed: 0,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive) {
      return;
    }

    if (event.key === 'Enter') {
      submit();
      return;
    }

    const digit = Number(event.key);
    const option = Number.isInteger(digit) ? options[digit - 1] : undefined;

    if (digit >= 1 && digit <= 4 && option) {
      setSelectedId(option.id);
    }
  }

  return (
    <div
      role="radiogroup"
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-2"
    >
      {options.map((option, index) => {
        const isSelected = selectedId === option.id;
        const isCorrectOption = correctOptionIds.includes(option.id);
        const isWrongPick = answered && isSelected && !isCorrectOption;
        const revealCorrect = answered && isCorrectOption;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${String(index + 1)}. ${option.text}`}
            disabled={!isInteractive}
            onClick={() => setSelectedId(option.id)}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-base text-ink transition-colors',
              isInteractive && 'hover:bg-ground',
              isSelected && !answered && 'border-accent bg-accent/10',
              revealCorrect && 'border-ok bg-ok/10',
              isWrongPick && 'border-error bg-error/10',
              !isInteractive && !answered && 'opacity-60',
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-xs text-muted">
              {index + 1}
            </span>
            <span className="flex-1">{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}
