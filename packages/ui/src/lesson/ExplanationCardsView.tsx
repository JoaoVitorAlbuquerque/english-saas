import type { ExplanationCardsContent } from '@english-saas/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { MarkedText } from '../components/MarkedText/MarkedText';
import { MarkdownLite } from './MarkdownLite';

export type ExplanationCardsViewProps = {
  content: ExplanationCardsContent;
  onContinue: () => void;
};

const SWIPE_THRESHOLD_PX = 50;

/** Etapa de cards de explicação: um por vez, com setas e deslize. */
export function ExplanationCardsView({
  content,
  onContinue,
}: ExplanationCardsViewProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const card = content.cards[index];
  const isLast = index === content.cards.length - 1;

  function goTo(next: number): void {
    setIndex(Math.min(Math.max(next, 0), content.cards.length - 1));
  }

  function handleTouchStart(event: React.TouchEvent): void {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent): void {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;

    if (startX === null || endX === undefined) {
      return;
    }

    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
      return;
    }

    goTo(delta < 0 ? index + 1 : index - 1);
  }

  if (!card) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="group"
        aria-label={`Card ${index + 1} de ${content.cards.length}`}
      >
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Card anterior"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="hidden size-9 items-center justify-center rounded-full text-muted hover:bg-ground disabled:opacity-30 sm:flex"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>

            <h2 className="flex-1 text-center font-display text-lg text-ink">
              {card.title}
            </h2>

            <button
              type="button"
              aria-label="Próximo card"
              onClick={() => goTo(index + 1)}
              disabled={isLast}
              className="hidden size-9 items-center justify-center rounded-full text-muted hover:bg-ground disabled:opacity-30 sm:flex"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>

          <MarkdownLite text={card.bodyMd} />

          {card.table ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-ground">
                    {card.table.headers.map((header, headerIndex) => (
                      <th key={headerIndex} className="px-3 py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.table.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-line last:border-0"
                    >
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {card.examples.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {card.examples.map((example, exampleIndex) => (
                <div key={exampleIndex}>
                  <MarkedText text={example.text} spans={example.spans} />
                  {example.translation ? (
                    <p className="text-sm text-muted">{example.translation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="mt-3 flex items-center justify-center gap-1.5">
          {content.cards.map((_, dotIndex) => (
            <span
              key={dotIndex}
              aria-hidden="true"
              className={`size-2 rounded-full transition-colors ${
                dotIndex === index ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </div>
      </div>

      {isLast ? (
        <Button onClick={onContinue} className="self-end">
          Continuar
        </Button>
      ) : (
        <Button onClick={() => goTo(index + 1)} className="self-end">
          Próximo
        </Button>
      )}
    </div>
  );
}
