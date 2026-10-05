import {
  issueMessage,
  lessonVersionMetaSchema,
  validateSteps,
  type LessonStepType,
} from '@english-saas/shared';

import {
  toStepPayload,
  type EditorMeta,
  type EditorState,
} from './editor-reducer';

/**
 * Validação ao vivo do editor — a **mesma** do servidor.
 *
 * Roda `validateSteps` e `lessonVersionMetaSchema` do `packages/shared` (a
 * API usa as mesmas funções ao gravar, enviar para revisão e publicar), e
 * reparte o resultado por campo: o erro aparece junto do campo, não numa
 * lista no fim da página.
 *
 * Nada aqui bloqueia a digitação nem o salvamento do rascunho.
 */

export type FieldIssue = { path: string; message: string };

export type EditorValidation = {
  /** Campo dos metadados → mensagem. */
  meta: Partial<Record<keyof EditorMeta, string>>;
  /** Problemas da lição inteira (sem etapa, etc.). */
  lesson: string[];
  /** Problemas de cada etapa, pela `key` da etapa. */
  steps: Record<string, FieldIssue[]>;
  /** Quantos erros há no total (metadados + lição + etapas). */
  total: number;
};

export function validateEditor(state: EditorState): EditorValidation {
  const meta: EditorValidation['meta'] = {};
  const metaResult = lessonVersionMetaSchema.safeParse(state.meta);

  if (!metaResult.success) {
    for (const issue of metaResult.error.issues) {
      const field = issue.path[0] as keyof EditorMeta | undefined;

      if (field !== undefined && meta[field] === undefined) {
        meta[field] = issueMessage(issue);
      }
    }
  }

  const lesson: string[] = [];
  const steps: Record<string, FieldIssue[]> = {};
  const result = validateSteps(toStepPayload(state.steps));

  if (!result.ok) {
    for (const issue of result.issues) {
      const step = state.steps[issue.order];

      if (issue.order < 0 || step === undefined) {
        lesson.push(issue.message);
      } else {
        (steps[step.key] ??= []).push({
          path: issue.path,
          message: issue.message,
        });
      }
    }
  }

  const total =
    Object.keys(meta).length +
    lesson.length +
    Object.values(steps).reduce((sum, list) => sum + list.length, 0);

  return { meta, lesson, steps, total };
}

export function hasErrors(validation: EditorValidation): boolean {
  return validation.total > 0;
}

/** Mensagens exatamente neste campo (`lines.2.text`). */
export function issuesAt(
  issues: readonly FieldIssue[] | undefined,
  path: string,
): string[] {
  return (issues ?? [])
    .filter((issue) => issue.path === path)
    .map((issue) => issue.message);
}

/** Mensagens deste campo e de tudo que está dentro dele (`lines.2` e `lines.2.spans.0`). */
export function issuesUnder(
  issues: readonly FieldIssue[] | undefined,
  prefix: string,
): FieldIssue[] {
  return (issues ?? []).filter(
    (issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`),
  );
}

/** `path('lines', 2, 'text')` → `lines.2.text`. */
export function path(...parts: (string | number)[]): string {
  return parts.map(String).join('.');
}

const SEGMENT_LABELS: Record<string, string> = {
  location: 'local',
  summary: 'resumo',
  characterIds: 'elenco',
  characterId: 'personagem',
  lines: 'fala',
  text: 'texto',
  standardText: 'estrutura gramatical',
  translation: 'tradução',
  spans: 'marcação',
  cards: 'card',
  title: 'título',
  bodyMd: 'texto do card',
  table: 'tabela',
  headers: 'cabeçalho',
  rows: 'linha',
  examples: 'exemplo',
  itemIds: 'questões',
  prompt: 'enunciado',
  helpers: 'ajuda',
  rubric: 'critério',
  description: 'descrição',
  goals: 'meta',
  scenario: 'cenário',
  maxTurns: 'máximo de turnos',
  takeaways: 'o que o aluno leva',
  skillId: 'skill',
  skillIds: 'skills',
  registerNoteId: 'nota de registro',
  minWords: 'mínimo de palavras',
};

/** Texto legível de um caminho de erro: `lines.2.spans.0` → "fala 3 › marcação 1". */
export function describePath(_type: LessonStepType, issuePath: string): string {
  if (issuePath === '' || issuePath === 'steps') {
    return 'etapa';
  }

  const parts = issuePath.split('.');
  const words: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] as string;
    const next = parts[index + 1];
    const label = SEGMENT_LABELS[part] ?? part;

    if (next !== undefined && /^\d+$/.test(next)) {
      words.push(`${label} ${String(Number(next) + 1)}`);
      index += 1;
    } else if (!/^\d+$/.test(part)) {
      words.push(label);
    }
  }

  return words.join(' › ');
}
