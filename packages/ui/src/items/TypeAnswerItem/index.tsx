import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { useHint } from '../hooks/use-hint';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, TypeAnswerItemView } from '../types';

export function TypeAnswerItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<TypeAnswerItemView>) {
  const [text, setText] = useState('');
  const hint = useHint();
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
      hintsUsed: hint.hintsUsed,
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
      {item.content.sourceText ? (
        <p className="italic text-muted">
          &ldquo;{item.content.sourceText}&rdquo;
        </p>
      ) : null}

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

      {item.content.hint && mode !== 'assessment' ? (
        <div>
          {hint.revealed ? (
            <p className="text-sm text-muted">{item.content.hint}</p>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={!isInteractive}
              onClick={hint.reveal}
              leftIcon={<Lightbulb className="size-4" aria-hidden="true" />}
            >
              Dica
            </Button>
          )}
        </div>
      ) : null}

      {feedback ? <ItemFeedbackPanel feedback={feedback} /> : null}
    </div>
  );
}
