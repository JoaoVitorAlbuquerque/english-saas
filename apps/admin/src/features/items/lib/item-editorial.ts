import type { FieldIssue } from '../../curriculum/lib/validation';
import { fieldPathOf } from './item-validation';

/**
 * O que dá errado ao salvar ou mover um item no fluxo editorial, traduzido
 * em algo que a tela sabe desenhar. O fluxo em si (quais botões, em que
 * estado) é o mesmo da versão de lição: `lib/editorial.ts` do curriculum.
 */

export type ItemProblem =
  | { kind: 'validation'; message: string; issues: FieldIssue[] }
  | {
      kind: 'references';
      message: string;
      /** Tipo da referência → o que falta. */
      missing: Record<string, string[]>;
      reason: string | null;
    }
  | { kind: 'immutable'; message: string; fields: string[] }
  | { kind: 'in-use'; message: string; lessons: string[] }
  | { kind: 'transition'; message: string }
  | { kind: 'other'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry : String(entry)))
    : [];
}

export function describeItemError(error: {
  code: string;
  message: string;
  details?: unknown;
}): ItemProblem {
  const details = isRecord(error.details) ? error.details : {};

  switch (error.code) {
    case 'CONTENT_VALIDATION_FAILED': {
      const issues = Array.isArray(details.issues)
        ? details.issues.flatMap((issue): FieldIssue[] =>
            isRecord(issue) && typeof issue.message === 'string'
              ? [
                  {
                    // O servidor manda o caminho relativo ao conteúdo; o
                    // campo da tela é `content.<caminho>`.
                    path: fieldPathOf(
                      typeof issue.path === 'string' ? issue.path : '',
                    ),
                    message: issue.message,
                  },
                ]
              : [],
          )
        : [];

      return { kind: 'validation', message: error.message, issues };
    }

    case 'MISSING_REFERENCES': {
      const missing: Record<string, string[]> = {};

      for (const [key, value] of Object.entries(details)) {
        const list = strings(value);

        if (list.length > 0 && key !== 'reason') {
          missing[key] = list;
        }
      }

      return {
        kind: 'references',
        message: error.message,
        missing,
        reason: typeof details.reason === 'string' ? details.reason : null,
      };
    }

    case 'ITEM_IS_IMMUTABLE':
      return {
        kind: 'immutable',
        message: error.message,
        fields: strings(details.fields),
      };

    case 'ITEM_IN_USE':
      return {
        kind: 'in-use',
        message: error.message,
        lessons: strings(details.lessons),
      };

    case 'INVALID_CONTENT_TRANSITION':
      return { kind: 'transition', message: error.message };

    default:
      return { kind: 'other', message: error.message };
  }
}

/** Problemas de validação do servidor viram erro no campo, como os ao vivo. */
export function issuesOfProblem(problem: ItemProblem | null): FieldIssue[] {
  return problem?.kind === 'validation' ? problem.issues : [];
}
