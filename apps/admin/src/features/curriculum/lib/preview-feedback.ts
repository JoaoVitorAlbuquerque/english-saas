import type { ItemFeedback } from '@english-saas/ui';

/**
 * "Ver gabarito" no preview da prática.
 *
 * O preview não chama a correção do servidor (não gasta nada nem grava
 * resposta): o gabarito sai direto do item do banco, que o editor pode ler
 * com a resposta. O resultado é o `ItemFeedback` que o modo `preview` dos
 * componentes de questão (F2) sabe desenhar — sempre "certo", porque o que se
 * mostra é a resposta certa.
 */

export type PreviewItem = {
  type: string;
  content: Record<string, unknown>;
  acceptedAnswers?: unknown;
  explanation: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function optionTexts(
  content: Record<string, unknown>,
  ids: string[],
): string[] {
  const options = Array.isArray(content.options) ? content.options : [];

  return ids.map((id) => {
    const option = options.find(
      (candidate): candidate is Record<string, unknown> =>
        isRecord(candidate) && candidate.id === id,
    );

    return typeof option?.text === 'string' ? option.text : id;
  });
}

function correctAnswerFor(item: PreviewItem): ItemFeedback['correctAnswer'] {
  switch (item.type) {
    case 'MULTIPLE_CHOICE':
    case 'LISTEN_CHOOSE':
    case 'READING_COMPREHENSION': {
      const optionIds = strings(item.content.correctOptionIds);

      return { optionIds, texts: optionTexts(item.content, optionIds) };
    }

    case 'MATCH': {
      const pairs = Array.isArray(item.content.pairs) ? item.content.pairs : [];

      return {
        pairs: pairs.flatMap((pair) =>
          isRecord(pair) &&
          typeof pair.left === 'string' &&
          typeof pair.right === 'string'
            ? [{ left: pair.left, right: pair.right }]
            : [],
        ),
      };
    }

    default: {
      // ORDER_WORDS, FILL_BLANK, TYPE_ANSWER, DICTATION, REGISTER_SWAP: a
      // resposta mora em `acceptedAnswers`, a primeira é a de referência.
      const accepted = strings(item.acceptedAnswers);

      return { text: accepted[0] ?? '' };
    }
  }
}

export function buildPreviewFeedback(item: PreviewItem): ItemFeedback {
  return {
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Gabarito',
    explanation: item.explanation ?? '',
    correctAnswer: correctAnswerFor(item),
  };
}
