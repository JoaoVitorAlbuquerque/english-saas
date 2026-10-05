import type { ContentStatus } from '@english-saas/shared';

/**
 * Fluxo editorial da versão — espelho de `nextStatus`/`isEditable`
 * (`apps/api/.../curriculum/domain/versioning.ts`). O front só decide **o que
 * mostrar**; quem decide de verdade é a API, e ela responde 409
 * `INVALID_CONTENT_TRANSITION` se os dois divergirem.
 *
 * ```
 * DRAFT ─enviar─▶ IN_REVIEW ─aprovar─▶ APPROVED ─publicar─▶ PUBLISHED
 *   ▲                 │                   │                     │
 *   └──── devolver ───┴──── devolver ─────┘                 arquivar
 * ```
 */

export type EditorialAction =
  'submit-for-review' | 'approve' | 'reject' | 'publish' | 'archive';

const TRANSITIONS: Record<
  EditorialAction,
  Partial<Record<ContentStatus, ContentStatus>>
> = {
  'submit-for-review': { DRAFT: 'IN_REVIEW' },
  approve: { IN_REVIEW: 'APPROVED' },
  reject: { IN_REVIEW: 'DRAFT', APPROVED: 'DRAFT' },
  publish: { APPROVED: 'PUBLISHED' },
  archive: {
    DRAFT: 'ARCHIVED',
    IN_REVIEW: 'ARCHIVED',
    APPROVED: 'ARCHIVED',
    PUBLISHED: 'ARCHIVED',
  },
};

export function nextVersionStatus(
  current: ContentStatus,
  action: EditorialAction,
): ContentStatus | null {
  return TRANSITIONS[action][current] ?? null;
}

/** Publicada e arquivada não se editam: só se abre uma versão nova. */
export function isEditableStatus(status: ContentStatus): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW' || status === 'APPROVED';
}

/** Ordem em que os botões aparecem: o caminho feliz primeiro. */
const ACTION_ORDER: EditorialAction[] = [
  'submit-for-review',
  'approve',
  'publish',
  'reject',
  'archive',
];

export function availableActions(status: ContentStatus): EditorialAction[] {
  return ACTION_ORDER.filter(
    (action) => nextVersionStatus(status, action) !== null,
  );
}

/** Publicar e arquivar tiram a versão da mão do editor: pedem confirmação. */
export function needsConfirmation(action: EditorialAction): boolean {
  return action === 'publish' || action === 'archive';
}

/** Quando editar uma versão de fora do rascunho a manda de volta para lá. */
export function statusAfterEdit(status: ContentStatus): ContentStatus {
  return status === 'IN_REVIEW' || status === 'APPROVED' ? 'DRAFT' : status;
}

// ---------------------------------------------------------------------------
// Erros do fluxo
// ---------------------------------------------------------------------------

export type StepIssueLike = { order: number; path: string; message: string };

export type EditorialProblem =
  | { kind: 'validation'; message: string; issues: StepIssueLike[] }
  | {
      kind: 'references';
      message: string;
      /** Tipo da referência → o que falta (`skills: ['grammar.x']`). */
      missing: Record<string, string[]>;
    }
  | {
      kind: 'qa';
      message: string;
      blockers: { code: string; message: string; path: string | null }[];
    }
  | { kind: 'audio'; message: string; missing: string[] }
  | { kind: 'draft-open'; message: string; version: number | null }
  | { kind: 'transition'; message: string }
  | { kind: 'other'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry : String(entry)))
    : [];
}

/**
 * Traduz o erro de uma ação editorial em algo que a tela sabe desenhar: uma
 * lista por etapa, o que falta referenciar, os bloqueadores da revisão
 * automática, o áudio que ainda não existe.
 */
export function describeEditorialError(error: {
  code: string;
  message: string;
  details?: unknown;
}): EditorialProblem {
  const details = isRecord(error.details) ? error.details : {};

  switch (error.code) {
    case 'CONTENT_VALIDATION_FAILED': {
      const issues = Array.isArray(details.issues)
        ? details.issues.flatMap((issue): StepIssueLike[] =>
            isRecord(issue) &&
            typeof issue.order === 'number' &&
            typeof issue.message === 'string'
              ? [
                  {
                    order: issue.order,
                    path: typeof issue.path === 'string' ? issue.path : '',
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
        const list = asStrings(value);

        if (list.length > 0 && key !== 'reason') {
          missing[key] = list;
        }
      }

      return { kind: 'references', message: error.message, missing };
    }

    case 'QA_BLOCKERS': {
      const blockers = Array.isArray(details.blockers)
        ? details.blockers.flatMap((blocker) =>
            isRecord(blocker) && typeof blocker.message === 'string'
              ? [
                  {
                    code: typeof blocker.code === 'string' ? blocker.code : '',
                    message: blocker.message,
                    path:
                      typeof blocker.path === 'string' ? blocker.path : null,
                  },
                ]
              : [],
          )
        : [];

      return { kind: 'qa', message: error.message, blockers };
    }

    case 'MISSING_AUDIO':
      return {
        kind: 'audio',
        message: error.message,
        missing: asStrings(details.missing),
      };

    case 'DRAFT_ALREADY_OPEN':
      return {
        kind: 'draft-open',
        message: error.message,
        version: typeof details.version === 'number' ? details.version : null,
      };

    case 'INVALID_CONTENT_TRANSITION':
      return { kind: 'transition', message: error.message };

    default:
      return { kind: 'other', message: error.message };
  }
}
