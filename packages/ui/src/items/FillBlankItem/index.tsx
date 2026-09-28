import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '../../components/Button/Button';
import { Chip } from '../../components/Chip/Chip';
import { Input } from '../../components/Input/Input';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { useHint } from '../hooks/use-hint';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { FillBlankItemView, ItemTypeProps } from '../types';

export function FillBlankItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<FillBlankItemView>) {
  const [text, setText] = useState('');
  const hint = useHint();
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;

  const [before, ...restParts] = item.content.sentence.split('___');
  const after = restParts.join('___');

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

      <p className="text-lg text-ink">
        {before}
        <span className="mx-1 inline-block min-w-16 border-b-2 border-accent px-1 text-center font-medium text-accent">
          {text || '＿＿＿'}
        </span>
        {after}
      </p>

      {item.content.choices ? (
        <div className="flex flex-wrap gap-2" onKeyDown={handleKeyDown}>
          {item.content.choices.map((choice) => (
            <Chip
              key={choice}
              selected={text === choice}
              disabled={!isInteractive}
              onClick={() => setText(choice)}
            >
              {choice}
            </Chip>
          ))}
        </div>
      ) : (
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
      )}

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
