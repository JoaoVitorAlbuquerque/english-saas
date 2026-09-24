import type { Span } from '@english-saas/shared';

/**
 * Marcação sobre texto.
 *
 * O zod já garante a forma de cada span isolado (`end > start`, tipo com a
 * referência certa). O que falta é a relação com o texto marcado, e isso
 * depende dos dois juntos — é o que mora aqui.
 *
 * Sobreposição é erro. Duas marcações no mesmo pedaço de frase não têm como
 * ser renderizadas sem ambiguidade; quando um chunk e uma estrutura caem no
 * mesmo trecho, marque o mais específico.
 */

export type SpanIssue = {
  /** Índice do span na lista original. */
  index: number;
  message: string;
};

/** Ordena por início; empate, o mais curto primeiro. */
export function sortSpans(spans: readonly Span[]): Span[] {
  return [...spans].sort(
    (a, b) => a.start - b.start || a.end - a.start - (b.end - b.start),
  );
}

/** O trecho que o span marca. */
export function sliceSpan(text: string, span: Span): string {
  return text.slice(span.start, span.end);
}

/** Confere os spans contra o texto que eles marcam. */
export function validateSpans(
  text: string,
  spans: readonly Span[],
): SpanIssue[] {
  const issues: SpanIssue[] = [];
  const indexed = spans.map((span, index) => ({ span, index }));

  for (const { span, index } of indexed) {
    if (span.end > text.length) {
      issues.push({
        index,
        message: `A marcação passa do fim do texto (${String(span.end)} > ${String(text.length)}).`,
      });
      continue;
    }

    if (sliceSpan(text, span).trim().length === 0) {
      issues.push({ index, message: 'A marcação cobre só espaço em branco.' });
    }
  }

  const ordered = [...indexed].sort((a, b) => a.span.start - b.span.start);

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];

    if (previous === undefined || current === undefined) {
      continue;
    }

    if (current.span.start < previous.span.end) {
      issues.push({
        index: current.index,
        message: 'Duas marcações se sobrepõem no mesmo trecho.',
      });
    }
  }

  return issues;
}
