import { useCallback, useEffect, useState } from 'react';
import type { DragEvent } from 'react';

import { cn } from '../../lib/cn';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, OrderWordsItemView } from '../types';

/**
 * Tocar move um token entre o banco e a frase montada — funciona em
 * qualquer tela. No desktop, também dá para arrastar para reordenar dentro
 * da frase montada (HTML `draggable` nativo, sem lib nova).
 */
export function OrderWordsItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<OrderWordsItemView>) {
  const [assembled, setAssembled] = useState<string[]>([]);
  const [bank, setBank] = useState<string[]>(item.content.tokens);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;
  const isComplete = assembled.length === item.content.tokens.length;

  function moveToAssembled(index: number) {
    if (!isInteractive) {
      return;
    }

    const token = bank[index];
    if (token === undefined) {
      return;
    }

    setBank((current) => current.filter((_, i) => i !== index));
    setAssembled((current) => [...current, token]);
  }

  function moveToBank(index: number) {
    if (!isInteractive) {
      return;
    }

    const token = assembled[index];
    if (token === undefined) {
      return;
    }

    setAssembled((current) => current.filter((_, i) => i !== index));
    setBank((current) => [...current, token]);
  }

  function reorder(fromIndex: number, toIndex: number) {
    setAssembled((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (moved === undefined) {
        return current;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    if (!isInteractive || dragIndex === null) {
      return;
    }
    reorder(dragIndex, index);
    setDragIndex(null);
  }

  const submit = useCallback(() => {
    if (!isInteractive || !isComplete) {
      return;
    }

    onAnswer?.({
      response: { tokens: assembled },
      responseTimeMs: elapsed(),
      hintsUsed: 0,
    });
  }, [isInteractive, isComplete, assembled, onAnswer, elapsed]);

  // Listener no `document`, não no container: tocar um token o remove de
  // uma lista e o insere em outra, então o elemento focado desaparece do
  // DOM e o foco cai pro `body` — um handler local nunca receberia o Enter.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        submit();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submit]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink">{item.prompt}</p>

      <div
        aria-label="Frase montada"
        className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-3"
      >
        {assembled.length === 0 ? (
          <span className="text-sm text-muted">Toque nas palavras abaixo</span>
        ) : null}
        {assembled.map((token, index) => (
          <button
            key={`${token}-${index}`}
            type="button"
            draggable={isInteractive}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, index)}
            onClick={() => moveToBank(index)}
            disabled={!isInteractive}
            className={cn(
              'flex h-10 items-center rounded-lg border border-accent bg-accent/10 px-3 text-base text-ink',
              isInteractive && 'cursor-grab hover:bg-accent/20',
            )}
          >
            {token}
          </button>
        ))}
      </div>

      <div aria-label="Palavras disponíveis" className="flex flex-wrap gap-2">
        {bank.map((token, index) => (
          <button
            key={`${token}-${index}`}
            type="button"
            onClick={() => moveToAssembled(index)}
            disabled={!isInteractive}
            className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-base text-ink hover:bg-ground disabled:opacity-50"
          >
            {token}
          </button>
        ))}
      </div>

      {feedback ? <ItemFeedbackPanel feedback={feedback} /> : null}
    </div>
  );
}
