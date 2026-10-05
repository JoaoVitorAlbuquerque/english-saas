import type { Span } from '@english-saas/shared';

/**
 * Mantém as marcações de um texto de pé quando o texto muda.
 *
 * Os índices do span são posições no texto (UTF-16). Se alguém digita no
 * começo da frase, todo span depois dele desloca; se não corrigirmos, a
 * marcação passa a cobrir outro trecho **sem aviso** — e o aluno veria a
 * estrutura errada destacada.
 *
 * A mudança é achada pelo prefixo e pelo sufixo que o texto velho e o novo
 * têm em comum; o miolo é o que mudou. Cada span cai num de três casos:
 *
 * - inteiro antes do miolo: não mexe;
 * - inteiro depois: desloca pelo tanto que o texto cresceu ou encolheu;
 * - envolve o miolo (digitou **dentro** do trecho marcado): fica, com o fim
 *   ajustado. Se o trecho sumiu, o span sai;
 * - qualquer outro (o miolo pegou só um pedaço do trecho): sai. Não existe
 *   jeito certo de adivinhar o que a pessoa quis marcar.
 */

export type RebaseResult = {
  spans: Span[];
  /** O que não sobreviveu à edição — a tela avisa. */
  dropped: Span[];
};

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let length = 0;

  while (length < limit && a[length] === b[length]) {
    length += 1;
  }

  return length;
}

function commonSuffixLength(a: string, b: string, prefix: number): number {
  const limit = Math.min(a.length, b.length) - prefix;
  let length = 0;

  while (
    length < limit &&
    a[a.length - 1 - length] === b[b.length - 1 - length]
  ) {
    length += 1;
  }

  return length;
}

export function rebaseSpans(
  oldText: string,
  newText: string,
  spans: readonly Span[],
): RebaseResult {
  if (oldText === newText) {
    return { spans: [...spans], dropped: [] };
  }

  const prefix = commonPrefixLength(oldText, newText);
  const suffix = commonSuffixLength(oldText, newText, prefix);
  const changedStart = prefix;
  const changedEndOld = oldText.length - suffix;
  const delta = newText.length - oldText.length;

  const kept: Span[] = [];
  const dropped: Span[] = [];

  for (const span of spans) {
    if (span.end <= changedStart) {
      kept.push(span);
    } else if (span.start >= changedEndOld) {
      kept.push({ ...span, start: span.start + delta, end: span.end + delta });
    } else if (span.start <= changedStart && span.end >= changedEndOld) {
      const end = span.end + delta;

      if (end > span.start) {
        kept.push({ ...span, end });
      } else {
        dropped.push(span);
      }
    } else {
      dropped.push(span);
    }
  }

  return { spans: kept, dropped };
}

/**
 * Os spans que dá para desenhar sem repetir texto: dentro do texto, com
 * trecho de verdade e sem sobreposição (o primeiro de cada trecho ganha).
 * O editor mostra o texto marcado enquanto a validação ainda reclama do
 * resto — `MarkedText` supõe spans que não se sobrepõem.
 */
export function renderableSpans(text: string, spans: readonly Span[]): Span[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const result: Span[] = [];
  let cursor = 0;

  for (const span of ordered) {
    if (
      span.start >= cursor &&
      span.end > span.start &&
      span.end <= text.length
    ) {
      result.push(span);
      cursor = span.end;
    }
  }

  return result;
}
