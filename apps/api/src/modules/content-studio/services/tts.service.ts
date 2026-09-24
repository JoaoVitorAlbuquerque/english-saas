import { Injectable, Logger } from '@nestjs/common';
import { MediaKind, type Prisma } from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';

import { EnvService } from 'src/common/config/env.service';
import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { StorageService } from 'src/infra/storage/storage.service';
import {
  STORAGE_PREFIXES,
  buildStorageKey,
} from 'src/infra/storage/storage-keys';
import { TtsProvider } from 'src/infra/tts/tts.provider';

import { TtsTextTooLongError } from '../content-studio.errors';
import { audioHash } from '../domain/audio-hash';
import {
  missingAudio,
  planAudioTargets,
  registerNoteIdsInSteps,
  type AudioTarget,
} from '../domain/tts-plan';

export const TTS_GENERATE_JOB = 'tts-generate';

export type TtsResult = { generated: number; reused: number };

/**
 * Narração das lições.
 *
 * Roda **na aprovação**, não na publicação: o editor precisa ouvir antes de
 * deixar ir ao ar. E roda uma vez por fala, nunca por aluno — o áudio é
 * arquivo no bucket, não chamada em runtime.
 *
 * O reaproveitamento é por `hash(texto + voz + velocidade)`. Quando a lição
 * ganha uma versão nova e as falas são clonadas, a síntese não é refeita.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: TtsProvider,
    private readonly storage: StorageService,
    private readonly envService: EnvService,
    private readonly events: EventBusService,
  ) {}

  /** O que falta de áudio numa versão. Usado pela trava de publicação. */
  async pendingAudio(lessonVersionId: string): Promise<AudioTarget[]> {
    return missingAudio(await this.planFor(lessonVersionId));
  }

  async generateForVersion(lessonVersionId: string): Promise<TtsResult> {
    const targets = missingAudio(await this.planFor(lessonVersionId));
    const result: TtsResult = { generated: 0, reused: 0 };

    for (const target of targets) {
      const asset = await this.synthesizeOrReuse(target, result);

      await this.attach(lessonVersionId, target, asset.id);
    }

    this.events.emit('content.audio_generated', {
      lessonVersionId,
      generated: result.generated,
      reused: result.reused,
    });

    this.logger.log({ lessonVersionId, ...result }, 'Narração concluída');

    return result;
  }

  // -------------------------------------------------------------------

  private async planFor(lessonVersionId: string): Promise<AudioTarget[]> {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: {
        steps: {
          orderBy: { order: 'asc' },
          select: { type: true, content: true },
        },
      },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    const steps = version.steps as unknown as LessonStepInput[];

    const characterIds = [
      ...new Set(
        steps.flatMap((step) =>
          step.type === 'SCENE'
            ? step.content.lines.map((line) => line.characterId)
            : [],
        ),
      ),
    ];

    const itemIds = steps.flatMap((step) =>
      step.type === 'PRACTICE' ? step.content.itemIds : [],
    );

    const [characters, items, registerNotes] = await Promise.all([
      this.prisma.character.findMany({
        where: { id: { in: characterIds } },
        select: { id: true, voiceId: true },
      }),
      itemIds.length === 0
        ? Promise.resolve([])
        : this.prisma.item.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, type: true, content: true },
          }),
      this.prisma.registerNote.findMany({
        where: { id: { in: registerNoteIdsInSteps(steps) } },
        select: { id: true, spokenForm: true, audioAssetId: true },
      }),
    ]);

    return planAudioTargets({
      steps,
      voiceByCharacterId: Object.fromEntries(
        characters.map((character) => [character.id, character.voiceId]),
      ),
      items,
      registerNotes,
    });
  }

  private async synthesizeOrReuse(
    target: AudioTarget,
    result: TtsResult,
  ): Promise<{ id: string }> {
    const maxChars = this.envService.get('TTS_MAX_CHARS');

    if (target.text.length > maxChars) {
      throw new TtsTextTooLongError(maxChars, target.text.length);
    }

    const voiceId =
      target.voiceId === ''
        ? this.envService.get('TTS_DEFAULT_VOICE')
        : target.voiceId;
    const speakingRate = this.envService.get('TTS_SPEAKING_RATE_A1');
    const textHash = audioHash({ text: target.text, voiceId, speakingRate });

    const existing = await this.prisma.audioRendition.findUnique({
      where: { textHash_voiceId: { textHash, voiceId } },
      select: { assetId: true },
    });

    if (existing !== null) {
      result.reused += 1;

      return { id: existing.assetId };
    }

    const audio = await this.provider.synthesize({
      text: target.text,
      voiceId,
      speakingRate,
      ...(this.provider.capabilities.ssml
        ? { ssml: `<speak>${escapeSsml(target.text)}</speak>` }
        : {}),
    });

    const extension = audio.mimeType === 'audio/wav' ? 'wav' : 'mp3';
    const key = buildStorageKey(
      STORAGE_PREFIXES.CONTENT,
      'audio',
      this.provider.name,
      `${textHash.slice(0, 16)}.${extension}`,
    );

    await this.storage.putObject({
      key,
      body: audio.audio,
      contentType: audio.mimeType,
      // Conteúdo base é imutável: o hash está na chave.
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const asset = await this.prisma.mediaAsset.upsert({
      where: { storageKey: key },
      create: {
        kind: MediaKind.AUDIO,
        storageKey: key,
        mimeType: audio.mimeType,
        sizeBytes: audio.audio.byteLength,
        durationMs: audio.durationMs,
        meta: { provider: audio.provider, voiceId },
      },
      update: { durationMs: audio.durationMs },
      select: { id: true },
    });

    await this.prisma.audioRendition.upsert({
      where: { textHash_voiceId: { textHash, voiceId } },
      create: {
        textHash,
        voiceId,
        assetId: asset.id,
        provider: audio.provider,
        charCount: audio.charCount,
      },
      update: {},
    });

    result.generated += 1;

    return asset;
  }

  /** Grava o id do asset onde ele pertence: etapa, questão ou nota. */
  private async attach(
    lessonVersionId: string,
    target: AudioTarget,
    assetId: string,
  ): Promise<void> {
    if (
      target.kind === 'REGISTER_NOTE' &&
      target.registerNoteId !== undefined
    ) {
      await this.prisma.registerNote.update({
        where: { id: target.registerNoteId },
        data: { audioAssetId: assetId },
      });

      return;
    }

    if (target.kind === 'ITEM' && target.itemId !== undefined) {
      const item = await this.prisma.item.findUniqueOrThrow({
        where: { id: target.itemId },
        select: { content: true },
      });

      await this.prisma.item.update({
        where: { id: target.itemId },
        data: {
          content: {
            ...(item.content as Record<string, unknown>),
            audioAssetId: assetId,
          } as Prisma.InputJsonValue,
        },
      });

      return;
    }

    if (
      target.kind === 'SCENE_LINE' &&
      target.stepOrder !== undefined &&
      target.lineIndex !== undefined
    ) {
      const step = await this.prisma.lessonStep.findUnique({
        where: {
          lessonVersionId_order: {
            lessonVersionId,
            order: target.stepOrder,
          },
        },
        select: { id: true, content: true },
      });

      if (step === null) {
        return;
      }

      const content = step.content as {
        lines: Record<string, unknown>[];
      };
      const line = content.lines[target.lineIndex];

      if (line === undefined) {
        return;
      }

      line['audioAssetId'] = assetId;

      await this.prisma.lessonStep.update({
        where: { id: step.id },
        data: { content: content as unknown as Prisma.InputJsonValue },
      });
    }
  }
}

/** XML é XML: `&` e `<` quebram o SSML. */
function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
