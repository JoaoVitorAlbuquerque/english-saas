import type { RegisterNote } from '@english-saas/shared';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Input } from '../../components/Input/Input';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, RegisterSwapItemView } from '../types';

export function RegisterSwapItem({
  item,
  mode,
  onAnswer,
  feedback,
  registerNote,
  disabled,
}: ItemTypeProps<RegisterSwapItemView> & { registerNote?: RegisterNote }) {
  const [text, setText] = useState('');
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;

  function submit() {
    if (!isInteractive || text.trim().length === 0) {
      return;
    }

    onAnswer?.({
      response: { text },
      responseTimeMs: elapsed(),
      hintsUsed: 0,
    });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink">{item.prompt}</p>
      <p className="text-lg italic text-ink">
        &ldquo;{item.content.source}&rdquo;
      </p>

      <Input
        aria-label="Sua resposta"
        value={text}
        disabled={!isInteractive}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />

      {feedback ? (
        <ItemFeedbackPanel feedback={feedback} registerNote={registerNote} />
      ) : null}
    </div>
  );
}
