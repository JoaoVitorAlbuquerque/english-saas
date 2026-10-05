import type { ContentStatus } from '@english-saas/shared';

import { apiFetch } from '../../http/fetch-client';
import {
  adminCharacterListSchema,
  adminCharacterSchema,
  adminCourseListSchema,
  adminErrorPatternPageSchema,
  adminItemPageSchema,
  adminItemSchema,
  adminLessonSchema,
  adminLessonSummaryListSchema,
  adminRegisterNotePageSchema,
  adminSkillPageSchema,
  adminUnitListSchema,
  adminUnitSchema,
  adminVersionSchema,
  createCharacterRequestSchema,
  createLessonRequestSchema,
  createUnitRequestSchema,
  draftSaveResultSchema,
  lessonPreviewSchema,
  reorderLessonsRequestSchema,
  reorderUnitsRequestSchema,
  saveDraftStepsRequestSchema,
  saveVersionMetaRequestSchema,
  updateCharacterRequestSchema,
  updateUnitRequestSchema,
  uploadedImageSchema,
  type AdminCharacter,
  type AdminCourse,
  type AdminErrorPatternPage,
  type AdminItem,
  type AdminItemPage,
  type AdminLesson,
  type AdminLessonSummary,
  type AdminRegisterNotePage,
  type AdminSkillPage,
  type AdminUnit,
  type AdminVersion,
  type CreateCharacterRequest,
  type CreateLessonRequest,
  type CreateUnitRequest,
  type DraftSaveResult,
  type LessonPreview,
  type SaveDraftStepsRequest,
  type SaveVersionMetaRequest,
  type UnitAction,
  type UpdateCharacterRequest,
  type UpdateUnitRequest,
  type UploadedImage,
  type VersionAction,
} from './schemas';

const BASE = '/admin/curriculum';

function withQuery(
  path: string,
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const text = params.toString();

  return text === '' ? path : `${path}?${text}`;
}

// --- Estrutura ---

export async function listCourses(): Promise<AdminCourse[]> {
  return apiFetch(`${BASE}/courses`, { schema: adminCourseListSchema });
}

export async function listUnits(levelId?: string): Promise<AdminUnit[]> {
  return apiFetch(withQuery(`${BASE}/units`, { levelId }), {
    schema: adminUnitListSchema,
  });
}

export async function createUnit(input: CreateUnitRequest): Promise<AdminUnit> {
  return apiFetch(`${BASE}/units`, {
    method: 'POST',
    body: createUnitRequestSchema.parse(input),
    schema: adminUnitSchema,
  });
}

export async function updateUnit(
  id: string,
  input: UpdateUnitRequest,
): Promise<AdminUnit> {
  return apiFetch(`${BASE}/units/${id}`, {
    method: 'PATCH',
    body: updateUnitRequestSchema.parse(input),
    schema: adminUnitSchema,
  });
}

export async function transitionUnit(
  id: string,
  action: UnitAction,
): Promise<AdminUnit> {
  return apiFetch(`${BASE}/units/${id}/transition`, {
    method: 'POST',
    body: { action },
    schema: adminUnitSchema,
  });
}

/** `ids`: as unidades do nível, todas, na ordem nova. */
export async function reorderUnits(
  levelId: string,
  ids: string[],
): Promise<AdminUnit[]> {
  return apiFetch(`${BASE}/units/reorder`, {
    method: 'POST',
    body: reorderUnitsRequestSchema.parse({ levelId, ids }),
    schema: adminUnitListSchema,
  });
}

// --- Lição ---

export async function listLessons(
  unitId?: string,
): Promise<AdminLessonSummary[]> {
  return apiFetch(withQuery(`${BASE}/lessons`, { unitId }), {
    schema: adminLessonSummaryListSchema,
  });
}

export async function getLesson(id: string): Promise<AdminLesson> {
  return apiFetch(`${BASE}/lessons/${id}`, { schema: adminLessonSchema });
}

export async function createLesson(
  input: CreateLessonRequest,
): Promise<AdminLesson> {
  return apiFetch(`${BASE}/lessons`, {
    method: 'POST',
    body: createLessonRequestSchema.parse(input),
    schema: adminLessonSchema,
  });
}

/** `ids`: as lições da unidade, todas, na ordem nova. */
export async function reorderLessons(
  unitId: string,
  ids: string[],
): Promise<AdminLessonSummary[]> {
  return apiFetch(`${BASE}/lessons/reorder`, {
    method: 'POST',
    body: reorderLessonsRequestSchema.parse({ unitId, ids }),
    schema: adminLessonSummaryListSchema,
  });
}

/** Abre a próxima versão, clonando a publicada. */
export async function createVersion(lessonId: string): Promise<AdminVersion> {
  return apiFetch(`${BASE}/lessons/${lessonId}/versions`, {
    method: 'POST',
    schema: adminVersionSchema,
  });
}

// --- Versão ---

export async function getVersion(id: string): Promise<AdminVersion> {
  return apiFetch(`${BASE}/lesson-versions/${id}`, {
    schema: adminVersionSchema,
  });
}

export async function saveVersionMeta(
  id: string,
  input: SaveVersionMetaRequest,
): Promise<AdminVersion> {
  return apiFetch(`${BASE}/lesson-versions/${id}`, {
    method: 'PUT',
    body: saveVersionMetaRequestSchema.parse(input),
    schema: adminVersionSchema,
  });
}

/**
 * Salvamento automático: grava as etapas **como estão** e devolve o que a
 * validação do servidor diria. Não recusa conteúdo incompleto.
 */
export async function saveDraftSteps(
  id: string,
  input: SaveDraftStepsRequest,
): Promise<DraftSaveResult> {
  return apiFetch(`${BASE}/lesson-versions/${id}/steps?draft=true`, {
    method: 'PUT',
    body: saveDraftStepsRequestSchema.parse(input),
    schema: draftSaveResultSchema,
  });
}

export async function transitionVersion(
  id: string,
  action: VersionAction,
): Promise<AdminVersion> {
  return apiFetch(`${BASE}/lesson-versions/${id}/${action}`, {
    method: 'POST',
    schema: adminVersionSchema,
  });
}

export async function getPreview(id: string): Promise<LessonPreview> {
  return apiFetch(`${BASE}/lesson-versions/${id}/preview`, {
    schema: lessonPreviewSchema,
  });
}

// --- Personagem e mídia ---

export async function listCharacters(): Promise<AdminCharacter[]> {
  return apiFetch(`${BASE}/characters`, { schema: adminCharacterListSchema });
}

export async function createCharacter(
  input: CreateCharacterRequest,
): Promise<AdminCharacter> {
  return apiFetch(`${BASE}/characters`, {
    method: 'POST',
    body: createCharacterRequestSchema.parse(input),
    schema: adminCharacterSchema,
  });
}

export async function updateCharacter(
  id: string,
  input: UpdateCharacterRequest,
): Promise<AdminCharacter> {
  return apiFetch(`${BASE}/characters/${id}`, {
    method: 'PATCH',
    body: updateCharacterRequestSchema.parse(input),
    schema: adminCharacterSchema,
  });
}

/** JPEG, PNG ou WebP até 2 MB; a API confere pelos bytes. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const body = new FormData();
  body.set('file', file);

  return apiFetch(`${BASE}/media-assets/upload`, {
    method: 'POST',
    body,
    schema: uploadedImageSchema,
  });
}

// --- Taxonomia e banco de questões ---

export async function listSkills(query: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<AdminSkillPage> {
  return apiFetch(withQuery(`${BASE}/skills`, query), {
    schema: adminSkillPageSchema,
  });
}

export async function listRegisterNotes(query: {
  cursor?: string;
  limit?: number;
}): Promise<AdminRegisterNotePage> {
  return apiFetch(withQuery(`${BASE}/register-notes`, query), {
    schema: adminRegisterNotePageSchema,
  });
}

export async function listErrorPatterns(query: {
  cursor?: string;
  limit?: number;
}): Promise<AdminErrorPatternPage> {
  return apiFetch(withQuery(`${BASE}/error-patterns`, query), {
    schema: adminErrorPatternPageSchema,
  });
}

export type AdminItemFilter = {
  status?: ContentStatus;
  level?: string;
  skillId?: string;
  cursor?: string;
  limit?: number;
};

export async function listItems(
  filter: AdminItemFilter,
): Promise<AdminItemPage> {
  return apiFetch(withQuery(`${BASE}/items`, filter), {
    schema: adminItemPageSchema,
  });
}

export async function getItem(id: string): Promise<AdminItem> {
  return apiFetch(`${BASE}/items/${id}`, { schema: adminItemSchema });
}
