import { SPAN_KIND_LABELS } from '@english-saas/shared';
import type { Span } from '@english-saas/shared';
import { Fragment } from 'react';

import { Mark } from '../Mark/Mark';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover/Popover';

export type MarkedTextProps = {
  text: string;
  spans: Span[];
  onSpanClick?: (span: Span, text: string) => void;
  className?: string;
};

type Segment =
  | { kind: 'plain'; text: string }
  | { kind: 'marked'; span: Span; text: string };

/** Spans não se sobrepõem (regra do curriculum) — ordenar por início basta. */
function toSegments(text: string, spans: readonly Span[]): Segment[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const span of ordered) {
    if (span.start > cursor) {
      segments.push({ kind: 'plain', text: text.slice(cursor, span.start) });
    }

    segments.push({
      kind: 'marked',
      span,
      text: text.slice(span.start, span.end),
    });
    cursor = span.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'plain', text: text.slice(cursor) });
  }

  return segments;
}

/**
 * Texto com trechos destacados (cena, card, material) — cada marcação abre
 * um popover ao ser ativada. Este componente não conhece Skill/RegisterNote:
 * o popover mostra o que já tem (o tipo da marcação e o trecho); telas com
 * os dados resolvidos usam `onSpanClick` para complementar.
 */
export function MarkedText({
  text,
  spans,
  onSpanClick,
  className,
}: MarkedTextProps) {
  const segments = toSegments(text, spans);

  return (
    <p className={className}>
      {segments.map((segment, index) => {
        if (segment.kind === 'plain') {
          return <Fragment key={index}>{segment.text}</Fragment>;
        }

        return (
          <Popover
            key={index}
            onOpenChange={(open) => {
              if (open) {
                onSpanClick?.(segment.span, segment.text);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button type="button" className="cursor-pointer">
                <Mark kind={segment.span.kind}>{segment.text}</Mark>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-64 text-sm">
              <p className="font-medium text-ink">
                {SPAN_KIND_LABELS[segment.span.kind]}
              </p>
              <p className="mt-1 text-muted">&ldquo;{segment.text}&rdquo;</p>
            </PopoverContent>
          </Popover>
        );
      })}
    </p>
  );
}
