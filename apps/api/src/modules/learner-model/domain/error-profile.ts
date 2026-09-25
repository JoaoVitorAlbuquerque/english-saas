/**
 * Perfil de erros típicos.
 *
 * Para cada ErrorPattern, uma janela das últimas 30 **oportunidades** —
 * respostas a itens que poderiam revelar aquele erro — marcando se ele
 * apareceu. Contar só ocorrências, sem as oportunidades, confundiria "erra
 * sempre" com "praticou muito".
 *
 * Toda resposta conta aqui, **retentativa inclusive**: o erro que o aluno
 * digitou é real mesmo que ele esteja tentando de novo. (O theta, ao
 * contrário, só aprende com a primeira tentativa.)
 */

export const ERROR_WINDOW = 30;
export const RECURRING_MIN_OCCURRENCES = 3;
export const MAX_EXAMPLES = 3;

export type ErrorExample = {
  /** O que o aluno escreveu ou escolheu. Conteúdo do aluno. */
  text: string;
  /** A forma certa, quando o item tem uma. */
  correction: string | null;
  /** Item respondido; nulo quando o erro veio de produção livre (tutor). */
  itemId: string | null;
  at: string;
};

export type ErrorState = {
  recentOutcomes: boolean[];
  totalOccurrences: number;
  lastOccurredAt: Date | null;
  examples: ErrorExample[];
};

export function emptyErrorState(): ErrorState {
  return {
    recentOutcomes: [],
    totalOccurrences: 0,
    lastOccurredAt: null,
    examples: [],
  };
}

/** Registra uma oportunidade: o erro apareceu (`example`) ou não. */
export function recordOpportunity(
  state: ErrorState,
  outcome: { hit: boolean; at: Date; example?: ErrorExample | undefined },
): ErrorState {
  const recentOutcomes = [...state.recentOutcomes, outcome.hit].slice(
    -ERROR_WINDOW,
  );

  if (!outcome.hit) {
    return { ...state, recentOutcomes };
  }

  return {
    recentOutcomes,
    totalOccurrences: state.totalOccurrences + 1,
    lastOccurredAt: outcome.at,
    examples:
      outcome.example === undefined
        ? state.examples
        : [...state.examples, outcome.example].slice(-MAX_EXAMPLES),
  };
}

/** Quantas vezes o erro apareceu na janela. */
export function recentOccurrences(state: ErrorState): number {
  return state.recentOutcomes.filter(Boolean).length;
}

export function isRecurring(state: ErrorState): boolean {
  return recentOccurrences(state) >= RECURRING_MIN_OCCURRENCES;
}

/**
 * Que erros um item poderia revelar: os que o `errorPatternMap` dele mapeia
 * e os ligados às skills dele na taxonomia.
 */
export function opportunitiesOf(
  item: {
    errorPatternMap: Readonly<Record<string, string>>;
    skillIds: readonly string[];
  },
  errorPatternsBySkill: ReadonlyMap<string, readonly string[]>,
): string[] {
  const ids = new Set(Object.values(item.errorPatternMap));

  for (const skillId of item.skillIds) {
    for (const id of errorPatternsBySkill.get(skillId) ?? []) {
      ids.add(id);
    }
  }

  return [...ids].sort();
}

/**
 * O texto que o aluno mandou, para servir de exemplo real.
 *
 * Escolha vira o texto da alternativa escolhida; montagem vira a frase
 * montada. Ligar pares não tem frase — não vira exemplo.
 */
export function answerText(content: unknown, response: unknown): string | null {
  const value = asRecord(response);

  if (typeof value['text'] === 'string') {
    return value['text'].trim() || null;
  }

  if (Array.isArray(value['tokens'])) {
    return (
      value['tokens'].filter((token) => typeof token === 'string').join(' ') ||
      null
    );
  }

  if (Array.isArray(value['optionIds'])) {
    const options = asRecord(content)['options'];
    const chosen = new Set(value['optionIds']);
    const texts = Array.isArray(options)
      ? options.flatMap((option) => {
          const entry = asRecord(option);
          return chosen.has(entry['id']) && typeof entry['text'] === 'string'
            ? [entry['text']]
            : [];
        })
      : [];

    return texts.length > 0 ? texts.join(' / ') : null;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
