import type { ItemType, LessonStepInput } from '@english-saas/shared';

import {
  matchesAnswer,
  normalizeAnswer,
} from 'src/modules/curriculum/domain/answer-normalization';

import { warn, type QaWarning } from './qa-report';

/**
 * Checagem de consistência interna da lição.
 *
 * O schema do módulo 4 garante a forma; aqui a gente confere o que só faz
 * sentido olhando as peças juntas:
 *
 * - toda skill-alvo é ensinada (aparece marcada) **e** medida (tem item);
 * - as peças de ORDER_WORDS realmente montam a resposta aceita;
 * - o número de lacunas de FILL_BLANK bate com o de respostas;
 * - a explicação cita a resposta certa.
 *
 * As duas primeiras da lista de item são as que mais pegam saída de IA: o
 * modelo gera uma frase-gabarito e embaralha peças que não são exatamente
 * as palavras dela.
 */

export type ConsistencyItem = {
  id: string;
  type: ItemType;
  prompt: string;
  content: unknown;
  acceptedAnswers: string[];
  explanation: string;
  skillIds: string[];
};

export type ConsistencyInput = {
  targetSkillIds: string[];
  steps: readonly LessonStepInput[];
  items: readonly ConsistencyItem[];
  /** Personagens que o pedido mandou usar na cena. */
  expectedCharacterIds?: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Skills marcadas em span de cena ou de exemplo de card. */
function skillsInSpans(steps: readonly LessonStepInput[]): Set<string> {
  const found = new Set<string>();

  for (const step of steps) {
    if (step.type === 'SCENE') {
      for (const line of step.content.lines) {
        for (const span of line.spans) {
          if (span.skillId !== undefined) {
            found.add(span.skillId);
          }
        }
      }
    }

    if (step.type === 'EXPLANATION_CARDS') {
      for (const card of step.content.cards) {
        for (const example of card.examples) {
          for (const span of example.spans) {
            if (span.skillId !== undefined) {
              found.add(span.skillId);
            }
          }
        }
      }
    }

    if (step.type === 'FREE_PRODUCTION') {
      for (const skillId of step.content.targetSkillIds) {
        found.add(skillId);
      }
    }

    if (step.type === 'SUMMARY') {
      for (const skillId of step.content.skillIds) {
        found.add(skillId);
      }
    }
  }

  return found;
}

/** ORDER_WORDS: as peças embaralhadas precisam montar a resposta. */
function checkOrderWords(item: ConsistencyItem, path: string): QaWarning[] {
  const tokens = asRecord(item.content)['tokens'];

  if (!Array.isArray(tokens)) {
    return [];
  }

  const assembled = tokens.map(String).join(' ');
  const fits = item.acceptedAnswers.some((answer) =>
    matchesAnswer(assembled, [answer]),
  );

  if (fits) {
    return [];
  }

  // Última chance: comparar os conjuntos de palavras, porque a ordem das
  // peças é justamente o que o aluno tem que descobrir.
  //
  // Normaliza a frase inteira, não peça por peça: `I'm` sozinho vira
  // `i am`, que são duas palavras — comparar contagem token a token daria
  // divergência onde não há.
  const fromTokens = normalizeAnswer(tokens.map(String).join(' '))
    .split(' ')
    .filter(Boolean)
    .sort();

  const anyAnswerMatches = item.acceptedAnswers.some((answer) => {
    const fromAnswer = normalizeAnswer(answer)
      .split(' ')
      .filter(Boolean)
      .sort();
    return (
      fromAnswer.length === fromTokens.length &&
      fromAnswer.every((word, index) => word === fromTokens[index])
    );
  });

  if (anyAnswerMatches) {
    return [];
  }

  return [
    warn(
      'ORDER_WORDS_TOKENS_MISMATCH',
      `As peças (${tokens.map(String).join(' / ')}) não montam nenhuma das respostas aceitas.`,
      path,
    ),
  ];
}

/** FILL_BLANK: uma resposta por lacuna. */
function checkFillBlank(item: ConsistencyItem, path: string): QaWarning[] {
  const sentence = asRecord(item.content)['sentence'];

  if (typeof sentence !== 'string') {
    return [];
  }

  const blanks = sentence.split('___').length - 1;

  if (blanks === item.acceptedAnswers.length) {
    return [];
  }

  return [
    warn(
      'FILL_BLANK_COUNT_MISMATCH',
      `A frase tem ${String(blanks)} lacuna(s) e ${String(item.acceptedAnswers.length)} resposta(s) aceita(s).`,
      path,
    ),
  ];
}

/** Escolha: gabarito existe e a explicação cita a alternativa certa. */
function checkChoice(item: ConsistencyItem, path: string): QaWarning[] {
  const content = asRecord(item.content);
  const options = Array.isArray(content['options'])
    ? (content['options'] as { id?: unknown; text?: unknown }[])
    : [];
  const correctIds = Array.isArray(content['correctOptionIds'])
    ? content['correctOptionIds'].map(String)
    : [];

  if (correctIds.length === 0 || options.length === 0) {
    return [warn('ITEM_WITHOUT_ANSWER', 'A questão não tem gabarito.', path)];
  }

  const correctTexts = options
    .filter((option) => correctIds.includes(String(option.id)))
    .map((option) => String(option.text));

  if (correctTexts.length === 0) {
    return [
      warn(
        'ITEM_WITHOUT_ANSWER',
        'O gabarito aponta para uma alternativa que não existe.',
        path,
      ),
    ];
  }

  const explanation = normalizeAnswer(item.explanation);
  const mentioned = correctTexts.some((text) => {
    const needle = normalizeAnswer(text);
    return needle.length > 0 && explanation.includes(needle);
  });

  if (mentioned) {
    return [];
  }

  return [
    warn(
      'ANSWER_EXPLANATION_MISMATCH',
      `A explicação não cita a alternativa certa ("${correctTexts.join('", "')}").`,
      path,
    ),
  ];
}

export function checkItemConsistency(
  item: ConsistencyItem,
  path: string,
): QaWarning[] {
  switch (item.type) {
    case 'ORDER_WORDS':
      return checkOrderWords(item, path);

    case 'FILL_BLANK':
      return checkFillBlank(item, path);

    case 'MULTIPLE_CHOICE':
    case 'LISTEN_CHOOSE':
    case 'READING_COMPREHENSION':
      return checkChoice(item, path);

    default:
      return [];
  }
}

export function checkConsistency(input: ConsistencyInput): QaWarning[] {
  const warnings: QaWarning[] = [];
  const marked = skillsInSpans(input.steps);
  const measured = new Set(input.items.flatMap((item) => item.skillIds));

  for (const skillId of input.targetSkillIds) {
    if (!marked.has(skillId)) {
      warnings.push(
        warn(
          'SKILL_NOT_IN_SPANS',
          `A skill "${skillId}" é alvo da lição mas não aparece marcada em nenhuma cena nem card.`,
          'targetSkills',
        ),
      );
    }

    if (!measured.has(skillId)) {
      warnings.push(
        warn(
          'SKILL_NOT_IN_ITEMS',
          `A skill "${skillId}" é alvo da lição mas nenhum item da prática mede ela.`,
          'targetSkills',
        ),
      );
    }
  }

  for (const [index, item] of input.items.entries()) {
    warnings.push(...checkItemConsistency(item, `items.${String(index)}`));
  }

  const scene = input.steps.find((step) => step.type === 'SCENE');

  if (scene?.type === 'SCENE' && input.expectedCharacterIds !== undefined) {
    const speaking = new Set(
      scene.content.lines.map((line) => line.characterId),
    );

    for (const characterId of input.expectedCharacterIds) {
      if (!speaking.has(characterId)) {
        warnings.push(
          warn(
            'CHARACTER_NOT_USED',
            'Um personagem pedido para a cena não tem nenhuma fala.',
            'scene.characterIds',
          ),
        );
      }
    }
  }

  return warnings;
}
