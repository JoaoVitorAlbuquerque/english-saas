import type { ItemType, LessonStepInput } from '@english-saas/shared';

/**
 * Extrai o inglês de uma lição, com o caminho de cada trecho.
 *
 * Serve a duas checagens: a de nível (junta tudo e conta palavra difícil) e
 * a revisão linguística por IA (manda trecho a trecho e recebe o caminho de
 * volta). Fazer as duas a partir da mesma extração garante que elas estão
 * olhando exatamente o mesmo conteúdo.
 *
 * O que **não** entra: enunciado, explicação e rubrica, que são pt-BR por
 * convenção do projeto — mandá-los para um checador de inglês só geraria
 * ruído.
 */

export type ContentSegment = {
  /** `scene.lines.2`, `items.0.options.1`. */
  path: string;
  english: string;
  /** Tradução pt-BR quando existe, para a revisão conferir o par. */
  portuguese?: string;
};

export type SegmentItem = {
  id: string;
  type: ItemType;
  content: unknown;
  acceptedAnswers: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pushText(
  into: ContentSegment[],
  path: string,
  english: unknown,
  portuguese?: unknown,
): void {
  if (typeof english !== 'string' || english.trim().length === 0) {
    return;
  }

  into.push({
    path,
    english,
    ...(typeof portuguese === 'string' && portuguese.trim().length > 0
      ? { portuguese }
      : {}),
  });
}

export function collectStepSegments(
  steps: readonly LessonStepInput[],
): ContentSegment[] {
  const segments: ContentSegment[] = [];

  for (const [stepIndex, step] of steps.entries()) {
    const base = `steps.${String(stepIndex)}`;

    if (step.type === 'SCENE') {
      for (const [lineIndex, line] of step.content.lines.entries()) {
        pushText(
          segments,
          `${base}.lines.${String(lineIndex)}`,
          line.text,
          line.translation,
        );

        if (line.standardText !== undefined) {
          pushText(
            segments,
            `${base}.lines.${String(lineIndex)}.standardText`,
            line.standardText,
          );
        }
      }
    }

    if (step.type === 'EXPLANATION_CARDS') {
      for (const [cardIndex, card] of step.content.cards.entries()) {
        for (const [exampleIndex, example] of card.examples.entries()) {
          pushText(
            segments,
            `${base}.cards.${String(cardIndex)}.examples.${String(exampleIndex)}`,
            example.text,
            example.translation,
          );
        }
      }
    }

    if (step.type === 'FREE_PRODUCTION') {
      for (const [helperIndex, helper] of step.content.helpers.entries()) {
        pushText(segments, `${base}.helpers.${String(helperIndex)}`, helper);
      }
    }

    if (step.type === 'ROLEPLAY' && step.content.openingLine !== undefined) {
      pushText(segments, `${base}.openingLine`, step.content.openingLine);
    }
  }

  return segments;
}

export function collectItemSegments(
  items: readonly SegmentItem[],
): ContentSegment[] {
  const segments: ContentSegment[] = [];

  for (const [index, item] of items.entries()) {
    const base = `items.${String(index)}`;
    const content = asRecord(item.content);

    const options = content['options'];

    if (Array.isArray(options)) {
      for (const [optionIndex, option] of options.entries()) {
        pushText(
          segments,
          `${base}.options.${String(optionIndex)}`,
          asRecord(option)['text'],
        );
      }
    }

    pushText(segments, `${base}.sentence`, content['sentence']);
    pushText(segments, `${base}.audioText`, content['audioText']);
    pushText(segments, `${base}.passage`, content['passage']);
    pushText(segments, `${base}.source`, content['source']);

    const tokens = content['tokens'];

    if (Array.isArray(tokens) && tokens.length > 0) {
      pushText(segments, `${base}.tokens`, tokens.map(String).join(' '));
    }

    for (const [answerIndex, answer] of item.acceptedAnswers.entries()) {
      pushText(
        segments,
        `${base}.acceptedAnswers.${String(answerIndex)}`,
        answer,
      );
    }
  }

  return segments;
}

export function englishOf(segments: readonly ContentSegment[]): string[] {
  return segments.map((segment) => segment.english);
}
