import type {
  CefrLevel,
  Competency,
  ContentStatus,
  ItemCalibrationFlag,
  ItemType,
  RegisterLevel,
  SkillType,
} from '@english-saas/shared';
import type { z } from 'zod';

import { apiFetch } from '../../http/fetch-client';
import { withQuery } from '../../http/with-query';
import {
  adminErrorPatternPageSchema,
  adminErrorPatternSchema,
  adminItemDetailSchema,
  adminItemPageSchema,
  adminRegisterNotePageSchema,
  adminRegisterNoteSchema,
  adminSkillPageSchema,
  adminSkillSchema,
  createErrorPatternRequestSchema,
  createItemRequestSchema,
  createRegisterNoteRequestSchema,
  createSkillRequestSchema,
  deprecateRequestSchema,
  flaggedItemPageSchema,
  itemStatsSchema,
  resolveFlaggedResultSchema,
  updateErrorPatternRequestSchema,
  updateItemRequestSchema,
  updateRegisterNoteRequestSchema,
  updateSkillRequestSchema,
  type AdminErrorPattern,
  type AdminErrorPatternPage,
  type AdminItemDetail,
  type AdminItemPage,
  type AdminRegisterNote,
  type AdminRegisterNotePage,
  type AdminSkill,
  type AdminSkillPage,
  type CreateErrorPatternRequest,
  type CreateItemRequest,
  type CreateRegisterNoteRequest,
  type CreateSkillRequest,
  type FlaggedItemPage,
  type ItemAction,
  type ItemStats,
  type UpdateErrorPatternRequest,
  type UpdateItemRequest,
  type UpdateRegisterNoteRequest,
  type UpdateSkillRequest,
} from './schemas';

const BASE = '/admin/curriculum';
const ASSESSMENT = '/admin/assessment';

type Page = { cursor?: string; limit?: number };

// --- Skills ---

export type SkillFilter = Page & {
  q?: string;
  level?: CefrLevel;
  competency?: Competency;
  type?: SkillType;
  includeDeprecated?: boolean;
};

export async function listSkills(
  filter: SkillFilter = {},
): Promise<AdminSkillPage> {
  return apiFetch(withQuery(`${BASE}/skills`, filter), {
    schema: adminSkillPageSchema,
  });
}

export async function createSkill(
  input: CreateSkillRequest,
): Promise<AdminSkill> {
  return apiFetch(`${BASE}/skills`, {
    method: 'POST',
    body: createSkillRequestSchema.parse(input),
    schema: adminSkillSchema,
  });
}

export async function updateSkill(
  id: string,
  input: UpdateSkillRequest,
): Promise<AdminSkill> {
  return apiFetch(`${BASE}/skills/${id}`, {
    method: 'PATCH',
    body: updateSkillRequestSchema.parse(input),
    schema: adminSkillSchema,
  });
}

/** Tira de circulação, sem renomear. A substituta é opcional. */
export async function deprecateSkill(
  id: string,
  replacedById?: string | null,
): Promise<AdminSkill> {
  return apiFetch(`${BASE}/skills/${id}/deprecate`, {
    method: 'POST',
    body: deprecateRequestSchema.parse({ replacedById: replacedById ?? null }),
    schema: adminSkillSchema,
  });
}

// --- Erros típicos ---

export type ErrorPatternFilter = Page & {
  q?: string;
  skillId?: string;
  includeDeprecated?: boolean;
};

export async function listErrorPatterns(
  filter: ErrorPatternFilter = {},
): Promise<AdminErrorPatternPage> {
  return apiFetch(withQuery(`${BASE}/error-patterns`, filter), {
    schema: adminErrorPatternPageSchema,
  });
}

export async function createErrorPattern(
  input: CreateErrorPatternRequest,
): Promise<AdminErrorPattern> {
  return apiFetch(`${BASE}/error-patterns`, {
    method: 'POST',
    body: createErrorPatternRequestSchema.parse(input),
    schema: adminErrorPatternSchema,
  });
}

export async function updateErrorPattern(
  id: string,
  input: UpdateErrorPatternRequest,
): Promise<AdminErrorPattern> {
  return apiFetch(`${BASE}/error-patterns/${id}`, {
    method: 'PATCH',
    body: updateErrorPatternRequestSchema.parse(input),
    schema: adminErrorPatternSchema,
  });
}

export async function deprecateErrorPattern(
  id: string,
  replacedById?: string | null,
): Promise<AdminErrorPattern> {
  return apiFetch(`${BASE}/error-patterns/${id}/deprecate`, {
    method: 'POST',
    body: deprecateRequestSchema.parse({ replacedById: replacedById ?? null }),
    schema: adminErrorPatternSchema,
  });
}

// --- Notas de registro ---

export type RegisterNoteFilter = Page & {
  q?: string;
  level?: CefrLevel;
  register?: RegisterLevel;
  skillId?: string;
  includeDeprecated?: boolean;
};

export async function listRegisterNotes(
  filter: RegisterNoteFilter = {},
): Promise<AdminRegisterNotePage> {
  return apiFetch(withQuery(`${BASE}/register-notes`, filter), {
    schema: adminRegisterNotePageSchema,
  });
}

export async function createRegisterNote(
  input: CreateRegisterNoteRequest,
): Promise<AdminRegisterNote> {
  return apiFetch(`${BASE}/register-notes`, {
    method: 'POST',
    body: createRegisterNoteRequestSchema.parse(input),
    schema: adminRegisterNoteSchema,
  });
}

export async function updateRegisterNote(
  id: string,
  input: UpdateRegisterNoteRequest,
): Promise<AdminRegisterNote> {
  return apiFetch(`${BASE}/register-notes/${id}`, {
    method: 'PATCH',
    body: updateRegisterNoteRequestSchema.parse(input),
    schema: adminRegisterNoteSchema,
  });
}

export async function deprecateRegisterNote(
  id: string,
  replacedById?: string | null,
): Promise<AdminRegisterNote> {
  return apiFetch(`${BASE}/register-notes/${id}/deprecate`, {
    method: 'POST',
    body: deprecateRequestSchema.parse({ replacedById: replacedById ?? null }),
    schema: adminRegisterNoteSchema,
  });
}

// --- Itens ---

export type AdminItemFilter = Page & {
  status?: ContentStatus;
  level?: CefrLevel;
  skillId?: string;
  type?: ItemType;
  /** `HUMAN`, `AI_DRAFT` ou `AI_DRAFT_REVIEWED`. */
  source?: string;
  q?: string;
};

export async function listItems(
  filter: AdminItemFilter = {},
): Promise<AdminItemPage> {
  return apiFetch(withQuery(`${BASE}/items`, filter), {
    schema: adminItemPageSchema,
  });
}

export async function getItem(id: string): Promise<AdminItemDetail> {
  return apiFetch(`${BASE}/items/${id}`, { schema: adminItemDetailSchema });
}

export async function createItem(
  input: CreateItemRequest,
): Promise<AdminItemDetail> {
  return apiFetch(`${BASE}/items`, {
    method: 'POST',
    body: createItemRequestSchema.parse(input),
    schema: adminItemDetailSchema,
  });
}

/** Recusa mexer no enunciado de item publicado (409 `ITEM_IS_IMMUTABLE`). */
export async function updateItem(
  id: string,
  input: UpdateItemRequest,
): Promise<AdminItemDetail> {
  return apiFetch(`${BASE}/items/${id}`, {
    method: 'PATCH',
    body: updateItemRequestSchema.parse(input),
    schema: adminItemDetailSchema,
  });
}

/** A próxima versão do item, ligada a este. `input` é o que muda nela. */
export async function createItemRevision(
  id: string,
  input: UpdateItemRequest = {},
): Promise<AdminItemDetail> {
  return apiFetch(`${BASE}/items/${id}/revisions`, {
    method: 'POST',
    body: updateItemRequestSchema.parse(input),
    schema: adminItemDetailSchema,
  });
}

export async function transitionItem(
  id: string,
  action: ItemAction,
): Promise<AdminItemDetail> {
  return apiFetch(`${BASE}/items/${id}/${action}`, {
    method: 'POST',
    schema: adminItemDetailSchema,
  });
}

// --- Itens problemáticos e estatísticas (módulo 8) ---

export type FlaggedItemFilter = Page & {
  flag?: ItemCalibrationFlag;
  level?: CefrLevel;
  type?: ItemType;
};

export async function listFlaggedItems(
  filter: FlaggedItemFilter = {},
): Promise<FlaggedItemPage> {
  return apiFetch(withQuery(`${ASSESSMENT}/flagged-items`, filter), {
    schema: flaggedItemPageSchema,
  });
}

export async function getItemStats(itemId: string): Promise<ItemStats> {
  return apiFetch(`${ASSESSMENT}/items/${itemId}/stats`, {
    schema: itemStatsSchema,
  });
}

/** O editor viu e resolveu: o item sai da fila e o alerta some. */
export async function resolveFlaggedItem(
  itemId: string,
): Promise<z.infer<typeof resolveFlaggedResultSchema>> {
  return apiFetch(`${ASSESSMENT}/flagged-items/${itemId}/resolve`, {
    method: 'POST',
    schema: resolveFlaggedResultSchema,
  });
}
