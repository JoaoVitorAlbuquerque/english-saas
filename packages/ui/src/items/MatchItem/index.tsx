import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { cn } from '../../lib/cn';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import { SubmitAnswerButton } from '../SubmitAnswerButton';
import type { ItemTypeProps, MatchItemView } from '../types';

type Pair = { left: string; right: string };

export function MatchItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<MatchItemView>) {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;
  const isComplete = pairs.length === item.content.lefts.length;

  function pairIndexFor(value: string, side: 'left' | 'right'): number {
    return pairs.findIndex((pair) => pair[side] === value);
  }

  function handleLeftClick(left: string) {
    if (!isInteractive) {
      return;
    }

    if (pairIndexFor(left, 'left') >= 0) {
      setPairs((current) => current.filter((pair) => pair.left !== left));
      return;
    }

    setSelectedLeft((current) => (current === left ? null : left));
  }

  function handleRightClick(right: string) {
    if (!isInteractive || selectedLeft === null) {
      return;
    }

    setPairs((current) => [
      ...current.filter((pair) => pair.right !== right),
      { left: selectedLeft, right },
    ]);
    setSelectedLeft(null);
  }

  function submit() {
    if (!isInteractive || !isComplete) {
      return;
    }

    onAnswer?.({
      response: { pairs },
      responseTimeMs: elapsed(),
      hintsUsed: 0,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
      <p className="text-lg text-ink">{item.prompt}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          {item.content.lefts.map((left) => {
            const pairIndex = pairIndexFor(left, 'left');

            return (
              <button
                key={left}
                type="button"
                aria-label={left}
                aria-pressed={selectedLeft === left}
                disabled={!isInteractive}
                onClick={() => handleLeftClick(left)}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-base text-ink',
                  selectedLeft === left && 'border-accent bg-accent/10',
                  pairIndex >= 0 && 'border-ok bg-ok/10',
                )}
              >
                {pairIndex >= 0 ? (
                  <span className="text-xs font-medium text-ok">
                    {pairIndex + 1}
                  </span>
                ) : null}
                {left}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {item.content.rights.map((right) => {
            const pairIndex = pairIndexFor(right, 'right');

            return (
              <button
                key={right}
                type="button"
                aria-label={right}
                disabled={!isInteractive}
                onClick={() => handleRightClick(right)}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-base text-ink',
                  pairIndex >= 0 && 'border-ok bg-ok/10',
                )}
              >
                {pairIndex >= 0 ? (
                  <span className="text-xs font-medium text-ok">
                    {pairIndex + 1}
                  </span>
                ) : null}
                {right}
              </button>
            );
          })}
        </div>
      </div>

      {!answered ? (
        <SubmitAnswerButton
          onClick={submit}
          disabled={!isInteractive || !isComplete}
        />
      ) : null}

      {feedback ? <ItemFeedbackPanel feedback={feedback} /> : null}
    </div>
  );
}
