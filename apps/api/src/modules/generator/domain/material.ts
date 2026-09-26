import type { CefrLevel, SpanKind } from '@english-saas/shared';

import { findOccurrences } from 'src/modules/content-studio/domain/draft-mapping';

import { normalizeForMatch } from './claims';

/**
 * O material como fica guardado e como o aluno recebe: o texto, os
 * destaques (já com índice), as claims que sobreviveram à checagem, a
 * conversa falada × padrão, as notas de registro e o vocabulário.
 */
export type MaterialSpan = {
  start: number;
  end: number;
  kind: SpanKind;
  skillId?: string;
  registerNoteId?: string;
  explanationPtBr: string;
};

export type MaterialContent = {
  title: string;
  level: CefrLevel;
  text: string;
  spans: MaterialSpan[];
  claims: { sentence: string; sourceQuote: string }[];
  grammarSpotlight: {
    skillId: string;
    structure: string;
    examplesFromText: string[];
    explanationPtBr: string;
  }[];
  spokenVersion: {
    setup: string;
    lines: { speaker: string; spoken: string; standard: string | null }[];
  };
  registerNotes: {
    registerNoteId: string | null;
    spoken: string;
    standard: string;
    notePtBr: string;
  }[];
  vocabulary: {
    term: string;
    meaningPtBr: string;
    example: string;
    cefr: CefrLevel;
  }[];
};

/** Marcação como a IA manda: pelo trecho, nunca por índice. */
export type MarkedMaterialSpan = {
  text: string;
  occurrence: number | null;
  kind: SpanKind;
  skillId: string | null;
  registerNoteId: string | null;
  explanationPtBr: string;
};

export type AllowedRefs = {
  skillIds: ReadonlySet<string>;
  registerNoteIds: ReadonlySet<string>;
};

/** Até quantos termos do vocabulário viram card de revisão. */
export const MAX_TERM_CARDS = 8;

/**
 * Acha cada trecho no texto final e calcula o índice. Marcação cujo trecho
 * sumiu (frase removida na checagem de fatos), que aponta para id que a IA
 * não recebeu, ou que se sobrepõe a outra, é descartada — perder um
 * destaque é melhor que destacar errado.
 */
export function resolveMaterialSpans(
  text: string,
  marks: readonly MarkedMaterialSpan[],
  allowed: AllowedRefs,
): MaterialSpan[] {
  const accepted: MaterialSpan[] = [];

  for (const mark of marks) {
    const skillId =
      mark.skillId !== null && allowed.skillIds.has(mark.skillId)
        ? mark.skillId
        : undefined;
    const registerNoteId =
      mark.registerNoteId !== null &&
      allowed.registerNoteIds.has(mark.registerNoteId)
        ? mark.registerNoteId
        : undefined;

    if (
      ((mark.kind === 'GRAMMAR' || mark.kind === 'CHUNK') &&
        skillId === undefined) ||
      (mark.kind === 'REGISTER' && registerNoteId === undefined)
    ) {
      continue;
    }

    const positions = findOccurrences(text, mark.text);
    const requested = positions[(mark.occurrence ?? 1) - 1];
    const candidates =
      requested === undefined ? positions : [requested, ...positions];
    const start = candidates.find(
      (position) =>
        !accepted.some(
          (span) =>
            position < span.end && position + mark.text.length > span.start,
        ),
    );

    if (start === undefined) {
      continue;
    }

    accepted.push({
      start,
      end: start + mark.text.length,
      kind: mark.kind,
      ...(skillId === undefined ? {} : { skillId }),
      ...(registerNoteId === undefined ? {} : { registerNoteId }),
      explanationPtBr: mark.explanationPtBr,
    });
  }

  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Limpa o que depende do texto final e dos ids dados à IA: destaque de
 * gramática só de skill-alvo, com exemplos que ainda estão no texto; nota
 * de registro com id desconhecido perde o id (a explicação continua útil);
 * vocabulário sem repetição.
 */
export function sanitizeSupporting(
  content: Pick<
    MaterialContent,
    'text' | 'grammarSpotlight' | 'registerNotes' | 'vocabulary'
  >,
  allowed: AllowedRefs,
): Pick<MaterialContent, 'grammarSpotlight' | 'registerNotes' | 'vocabulary'> {
  const text = normalizeForMatch(content.text);
  const seenTerms = new Set<string>();

  return {
    grammarSpotlight: content.grammarSpotlight
      .filter((entry) => allowed.skillIds.has(entry.skillId))
      .map((entry) => ({
        ...entry,
        examplesFromText: entry.examplesFromText.filter((example) =>
          text.includes(normalizeForMatch(example)),
        ),
      })),
    registerNotes: content.registerNotes.map((note) => ({
      ...note,
      registerNoteId:
        note.registerNoteId !== null &&
        allowed.registerNoteIds.has(note.registerNoteId)
          ? note.registerNoteId
          : null,
    })),
    vocabulary: content.vocabulary.filter((entry) => {
      const key = normalizeForMatch(entry.term);
      if (key.length === 0 || seenTerms.has(key)) return false;
      seenTerms.add(key);
      return true;
    }),
  };
}
