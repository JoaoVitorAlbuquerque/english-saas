import { Injectable, Logger } from '@nestjs/common';
import { ContentStatus, MediaKind } from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';
import { createHash } from 'node:crypto';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { StorageService } from 'src/infra/storage/storage.service';
import {
  STORAGE_PREFIXES,
  buildStorageKey,
} from 'src/infra/storage/storage-keys';

import { renderWorkbookPdf, type WorkbookData } from './workbook-pdf';

export const WORKBOOK_PDF_JOB = 'workbook-pdf';

/**
 * Apostila em PDF de uma unidade.
 *
 * Só entra o que está **publicado** — a apostila é material do aluno, e
 * gerar PDF de rascunho seria vazar conteúdo não aprovado num arquivo que
 * ninguém mais controla depois de baixado.
 *
 * O `sourceHash` diz de qual conteúdo o PDF saiu; se ele muda, a apostila
 * está velha e vale regerar.
 */
@Injectable()
export class WorkbookService {
  private readonly logger = new Logger(WorkbookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventBusService,
  ) {}

  async generateForUnit(unitId: string): Promise<{ workbookId: string }> {
    const data = await this.collect(unitId);
    const sourceHash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    const pdf = await renderWorkbookPdf(data);
    const key = buildStorageKey(
      STORAGE_PREFIXES.CONTENT,
      'pdf',
      data.unitSlug,
      `${sourceHash.slice(0, 16)}.pdf`,
    );

    await this.storage.putObject({
      key,
      body: pdf,
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const asset = await this.prisma.mediaAsset.upsert({
      where: { storageKey: key },
      create: {
        kind: MediaKind.PDF,
        storageKey: key,
        mimeType: 'application/pdf',
        sizeBytes: pdf.byteLength,
        meta: { unitId, sourceHash },
      },
      update: { sizeBytes: pdf.byteLength },
      select: { id: true },
    });

    const slug = `${data.unitSlug}-workbook`;
    const workbook = await this.prisma.workbook.upsert({
      where: { slug },
      create: {
        unitId,
        slug,
        title: `Apostila — ${data.unitTitle}`,
        description: data.unitSynopsis,
        order: 0,
        assetId: asset.id,
        status: ContentStatus.PUBLISHED,
        generatedAt: new Date(),
        sourceHash,
      },
      update: {
        title: `Apostila — ${data.unitTitle}`,
        description: data.unitSynopsis,
        assetId: asset.id,
        status: ContentStatus.PUBLISHED,
        generatedAt: new Date(),
        sourceHash,
      },
      select: { id: true },
    });

    this.events.emit('content.workbook_generated', {
      unitId,
      workbookId: workbook.id,
      sizeBytes: pdf.byteLength,
    });

    this.logger.log({ unitId, sizeBytes: pdf.byteLength }, 'Apostila gerada');

    return { workbookId: workbook.id };
  }

  /** Junta o conteúdo publicado da unidade no formato que o PDF consome. */
  private async collect(unitId: string): Promise<WorkbookData> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        slug: true,
        title: true,
        synopsis: true,
        level: { select: { cefrLevel: true, title: true } },
        cast: {
          select: { character: { select: { name: true, bio: true } } },
        },
        lessons: {
          where: { publishedVersionId: { not: null } },
          orderBy: { order: 'asc' },
          select: {
            slug: true,
            publishedVersion: {
              select: {
                title: true,
                objective: true,
                steps: {
                  orderBy: { order: 'asc' },
                  select: { type: true, content: true },
                },
              },
            },
          },
        },
      },
    });

    if (unit === null) {
      throw new NotFoundError('Não encontramos esta unidade.');
    }

    const registerNoteIds = new Set<string>();

    const lessons = unit.lessons.flatMap((lesson) => {
      const version = lesson.publishedVersion;

      if (version === null) {
        return [];
      }

      const steps = version.steps as unknown as LessonStepInput[];

      for (const step of steps) {
        if (step.type === 'SUMMARY') {
          for (const id of step.content.registerNoteIds) {
            registerNoteIds.add(id);
          }
        }

        if (step.type === 'SCENE') {
          for (const line of step.content.lines) {
            for (const span of line.spans) {
              if (span.registerNoteId !== undefined) {
                registerNoteIds.add(span.registerNoteId);
              }
            }
          }
        }
      }

      const scene = steps.find((step) => step.type === 'SCENE');
      const cards = steps.find((step) => step.type === 'EXPLANATION_CARDS');
      const summary = steps.find((step) => step.type === 'SUMMARY');

      return [
        {
          title: version.title,
          objective: version.objective,
          scene:
            scene?.type === 'SCENE'
              ? {
                  location: scene.content.location,
                  lines: scene.content.lines.map((line) => ({
                    text: line.text,
                    standardText: line.standardText ?? null,
                    translation: line.translation,
                  })),
                }
              : null,
          cards:
            cards?.type === 'EXPLANATION_CARDS'
              ? cards.content.cards.map((card) => ({
                  title: card.title,
                  bodyMd: card.bodyMd,
                  table: card.table ?? null,
                  examples: card.examples.map((example) => ({
                    text: example.text,
                    translation: example.translation ?? null,
                  })),
                }))
              : [],
          takeaways:
            summary?.type === 'SUMMARY' ? summary.content.takeaways : [],
        },
      ];
    });

    const registerNotes = await this.prisma.registerNote.findMany({
      where: { id: { in: [...registerNoteIds] } },
      orderBy: { id: 'asc' },
      select: {
        spokenForm: true,
        standardForm: true,
        explanation: true,
        whenToAvoid: true,
      },
    });

    return {
      unitSlug: unit.slug,
      unitTitle: unit.title,
      unitSynopsis: unit.synopsis,
      levelTitle: unit.level.title,
      cefrLevel: unit.level.cefrLevel,
      characters: unit.cast.map((entry) => ({
        name: entry.character.name,
        bio: entry.character.bio,
      })),
      lessons,
      registerNotes: registerNotes.map((note) => ({
        spokenForm: note.spokenForm,
        standardForm: note.standardForm,
        explanation: note.explanation,
        whenToAvoid: note.whenToAvoid,
      })),
    };
  }
}
