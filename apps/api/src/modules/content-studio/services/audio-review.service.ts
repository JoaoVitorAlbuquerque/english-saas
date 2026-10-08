import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { AssetUrlService } from 'src/modules/curriculum/services/asset-url.service';

import {
  AudioNotReadyError,
  UnknownAudioKeyError,
} from '../content-studio.errors';
import { missingAudio } from '../domain/tts-plan';
import { ReviewService } from './review.service';
import { TTS_REGENERATE_JOB, TtsService } from './tts.service';

/**
 * Revisão de áudio: ouvir cada fala gerada, marcar problema e pedir de novo.
 *
 * O áudio nasce na aprovação (módulo 5, TTS); esta é a leitura que o editor
 * usa para ouvir antes de publicar. Marcar problema é um comentário de alvo
 * AUDIO (ver `ReviewService`), então "resolver" é o mesmo do resto da revisão.
 */
@Injectable()
export class AudioReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tts: TtsService,
    private readonly review: ReviewService,
    private readonly assets: AssetUrlService,
    @InjectQueue(QUEUES.MEDIA) private readonly media: Queue,
  ) {}

  async list(lessonVersionId: string) {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: { status: true },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    const targets = await this.tts.plan(lessonVersionId);
    const issues = await this.review.openAudioIssues(lessonVersionId);

    const assetIds = targets.flatMap((target) =>
      target.assetId === null ? [] : [target.assetId],
    );
    const characterIds = targets.flatMap((target) =>
      target.characterId === undefined ? [] : [target.characterId],
    );
    const itemIds = targets.flatMap((target) =>
      target.itemId === undefined ? [] : [target.itemId],
    );

    const [assetRows, characters, items] = await Promise.all([
      assetIds.length === 0
        ? Promise.resolve([])
        : this.prisma.mediaAsset.findMany({
            where: { id: { in: assetIds } },
            select: {
              id: true,
              kind: true,
              storageKey: true,
              mimeType: true,
              durationMs: true,
            },
          }),
      characterIds.length === 0
        ? Promise.resolve([])
        : this.prisma.character.findMany({
            where: { id: { in: characterIds } },
            select: { id: true, name: true },
          }),
      itemIds.length === 0
        ? Promise.resolve([])
        : this.prisma.item.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, prompt: true },
          }),
    ]);

    const resolved = await this.assets.resolveMap(assetRows);
    const nameById = new Map(
      characters.map((character) => [character.id, character.name]),
    );
    const promptById = new Map(items.map((item) => [item.id, item.prompt]));

    return {
      versionStatus: version.status,
      total: targets.length,
      pending: missingAudio(targets).length,
      targets: targets.map((target) => {
        const asset =
          target.assetId === null ? undefined : resolved[target.assetId];

        return {
          key: target.key,
          kind: target.kind,
          text: target.text,
          label:
            target.characterId !== undefined
              ? (nameById.get(target.characterId) ?? null)
              : target.itemId !== undefined
                ? (promptById.get(target.itemId) ?? null)
                : (target.registerNoteId ?? null),
          stepOrder: target.stepOrder ?? null,
          lineIndex: target.lineIndex ?? null,
          itemId: target.itemId ?? null,
          registerNoteId: target.registerNoteId ?? null,
          audio:
            asset === undefined
              ? null
              : {
                  url: asset.url,
                  mimeType: asset.mimeType,
                  durationMs: asset.durationMs,
                },
          openIssues: (issues.get(target.key) ?? []).map((issue) => ({
            id: issue.id,
            audioIssue: issue.audioIssue,
            body: issue.body,
            createdAt: issue.createdAt,
          })),
        };
      }),
    };
  }

  async regenerate(
    lessonVersionId: string,
    keys: readonly string[],
    speakingRate?: number,
  ) {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: { status: true },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    if (version.status !== ContentStatus.APPROVED) {
      throw new AudioNotReadyError(version.status);
    }

    const known = new Set(
      (await this.tts.plan(lessonVersionId)).map((target) => target.key),
    );
    const unknown = keys.filter((key) => !known.has(key));

    if (unknown.length > 0) {
      throw new UnknownAudioKeyError(unknown);
    }

    const job = await this.media.add(TTS_REGENERATE_JOB, {
      lessonVersionId,
      keys: [...new Set(keys)],
      ...(speakingRate === undefined ? {} : { speakingRate }),
    });

    return { jobId: job.id ?? null, queue: QUEUES.MEDIA };
  }
}
