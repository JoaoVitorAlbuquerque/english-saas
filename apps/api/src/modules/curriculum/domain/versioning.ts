import type { ContentStatus } from '@english-saas/shared';

/**
 * Ciclo de vida do conteúdo autorado.
 *
 * ```
 * DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED ──publish──▶ PUBLISHED
 *   ▲                    │                    │                      │
 *   └────── edit ────────┴────── edit ────────┘                   archive
 *                                                                    │
 *                                                                 ARCHIVED
 * ```
 *
 * A regra que importa: **editar derruba a revisão**. Mexeu numa versão em
 * IN_REVIEW ou APPROVED, ela volta para DRAFT — o que foi aprovado deixou de
 * ser o que está ali. Publicado e arquivado não se editam: abre-se uma
 * versão nova.
 */

export const CONTENT_ACTIONS = [
  'submit',
  'approve',
  'reject',
  'publish',
  'archive',
] as const;

export type ContentAction = (typeof CONTENT_ACTIONS)[number];

const TRANSITIONS: Record<
  ContentAction,
  Partial<Record<ContentStatus, ContentStatus>>
> = {
  submit: { DRAFT: 'IN_REVIEW' },
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

/** Para onde a ação leva, ou `null` se ela não vale nesse estado. */
export function nextStatus(
  current: ContentStatus,
  action: ContentAction,
): ContentStatus | null {
  return TRANSITIONS[action][current] ?? null;
}

/** Conteúdo publicado ou arquivado não aceita edição no lugar. */
export function isEditable(status: ContentStatus): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW' || status === 'APPROVED';
}

/**
 * Status depois de uma edição. Revisão feita sobre conteúdo que mudou não
 * vale mais, então IN_REVIEW e APPROVED voltam para DRAFT.
 */
export function statusAfterEdit(current: ContentStatus): ContentStatus {
  return current === 'IN_REVIEW' || current === 'APPROVED' ? 'DRAFT' : current;
}

/** A edição apaga o carimbo de aprovação junto com o status. */
export function clearsApproval(current: ContentStatus): boolean {
  return statusAfterEdit(current) !== current;
}

/** Número da próxima versão de uma lição. */
export function nextVersionNumber(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/** Só APPROVED publica. Explícito porque é a trava do fluxo editorial. */
export function canPublish(status: ContentStatus): boolean {
  return nextStatus(status, 'publish') === 'PUBLISHED';
}
