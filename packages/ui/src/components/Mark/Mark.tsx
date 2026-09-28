import { SPAN_KIND_LABELS } from '@english-saas/shared';
import type { SpanKind } from '@english-saas/shared';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type MarkKind = SpanKind;

export type MarkProps = {
  kind: MarkKind;
  children: ReactNode;
  className?: string;
};

/** Destaca um trecho de cena/card, no mesmo tipo de marcação salvo em `Span`. */
const KIND_CLASSES: Record<MarkKind, string> = {
  CHUNK: 'bg-chunk-bg text-ink rounded px-1 py-0.5',
  GRAMMAR: 'underline decoration-accent decoration-2 underline-offset-2',
  REGISTER: 'italic text-accent',
  VOCAB: 'bg-accent/10 text-accent rounded px-1 py-0.5',
};

export function Mark({ kind, children, className }: MarkProps) {
  return (
    <mark
      className={cn('bg-transparent', KIND_CLASSES[kind], className)}
      aria-label={`${SPAN_KIND_LABELS[kind]}: ${typeof children === 'string' ? children : ''}`}
    >
      {children}
    </mark>
  );
}
