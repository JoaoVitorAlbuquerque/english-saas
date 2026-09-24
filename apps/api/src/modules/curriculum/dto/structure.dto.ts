import {
  cefrLevelSchema,
  contentSlugSchema,
  mediaKindSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CONTENT_ACTIONS } from '../domain/versioning';

/** Entrada da autoria de estrutura: curso, nível, unidade, mídia, apostila. */

export class CreateCourseDto extends createZodDto(
  z.object({
    slug: contentSlugSchema,
    title: z.string().trim().min(2).max(160),
    language: z.string().trim().min(2).max(8).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
  }),
) {}

export class CreateLevelDto extends createZodDto(
  z.object({
    courseId: z.uuid(),
    cefrLevel: cefrLevelSchema,
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1_000).nullable().optional(),
    objectives: z.array(z.string().trim().min(2).max(300)).max(30).optional(),
    order: z.number().int().min(0),
  }),
) {}

export class UpdateLevelDto extends createZodDto(
  z.object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
    objectives: z.array(z.string().trim().min(2).max(300)).max(30).optional(),
    order: z.number().int().min(0).optional(),
  }),
) {}

export class CreateUnitDto extends createZodDto(
  z.object({
    levelId: z.uuid(),
    slug: contentSlugSchema,
    order: z.number().int().min(0),
    title: z.string().trim().min(2).max(160),
    synopsis: z.string().trim().max(1_000).nullable().optional(),
    coverAssetId: z.uuid().nullable().optional(),
    characterIds: z.array(z.uuid()).max(12).optional(),
  }),
) {}

export class UpdateUnitDto extends createZodDto(
  z.object({
    order: z.number().int().min(0).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    synopsis: z.string().trim().max(1_000).nullable().optional(),
    coverAssetId: z.uuid().nullable().optional(),
    characterIds: z.array(z.uuid()).max(12).optional(),
  }),
) {}

export class CreateCharacterDto extends createZodDto(
  z.object({
    slug: contentSlugSchema,
    name: z.string().trim().min(2).max(120),
    bio: z.string().trim().max(1_000).nullable().optional(),
    voiceId: z.string().trim().max(120).nullable().optional(),
    avatarAssetId: z.uuid().nullable().optional(),
  }),
) {}

export class UpdateCharacterDto extends createZodDto(
  z.object({
    name: z.string().trim().min(2).max(120).optional(),
    bio: z.string().trim().max(1_000).nullable().optional(),
    voiceId: z.string().trim().max(120).nullable().optional(),
    avatarAssetId: z.uuid().nullable().optional(),
  }),
) {}

export class RegisterMediaAssetDto extends createZodDto(
  z.object({
    kind: mediaKindSchema,
    /** Precisa estar sob `content/`. */
    storageKey: z.string().trim().min(3).max(1_024),
    mimeType: z.string().trim().min(3).max(160),
    sizeBytes: z.number().int().min(0).nullable().optional(),
    durationMs: z.number().int().min(0).nullable().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
) {}

export class CreateWorkbookDto extends createZodDto(
  z.object({
    unitId: z.uuid(),
    slug: contentSlugSchema,
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1_000).nullable().optional(),
    order: z.number().int().min(0),
    assetId: z.uuid(),
  }),
) {}

export class ContentActionDto extends createZodDto(
  z.object({ action: z.enum(CONTENT_ACTIONS) }),
) {}
