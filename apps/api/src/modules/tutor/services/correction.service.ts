import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TutorCorrectionStatus,
  TutorInputSource,
  type TutorCorrection,
} from '@prisma/client';
import { Queue } from 'bullmq';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { StorageService } from 'src/infra/storage/storage.service';
import {
  buildStorageKey,
  STORAGE_PREFIXES,
} from 'src/infra/storage/storage-keys';
import { tutorCorrectionPrompt } from 'src/modules/ai/prompts/tutor-correction.prompt';
import { AiService } from 'src/modules/ai/services/ai.service';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import { CatalogAccessService } from 'src/modules/curriculum/services/catalog-access.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import {
  feedbackFromCorrection,
  sanitizeCorrection,
  type CorrectionOutput,
  type RubricCriterion,
} from '../domain/correction';
import {
  CORRECT_JOB,
  TRANSCRIBE_JOB,
  type CorrectionJobData,
} from '../jobs/tutor-jobs';
import { WrongStepTypeError } from '../tutor.errors';
import { SpeechToText } from './speech-to-text';

export type CreateCorrectionInput = {
  lessonId?: string | undefined;
  stepIndex?: number | undefined;
  text: string;
  clientRequestId?: string | undefined;
};

export type CorrectionView = {
  id: string;
  status: TutorCorrectionStatus;
  message: string;
  lessonId: string | null;
  stepIndex: number | null;
  source: TutorInputSource;
  text: string;
  result: CorrectionOutput | null;
  createdAt: Date;
  completedAt: Date | null;
};

const MESSAGES: Record<TutorCorrectionStatus, string> = {
  TRANSCRIBING: 'Estamos ouvindo o seu áudio. Já, já vem a correção.',
  QUEUED: 'Estamos corrigindo o seu texto. Leva alguns segundos.',
  DONE: 'Correção pronta.',
  REFUSED:
    'Não dá para corrigir esse texto: ele tem conteúdo impróprio. O crédito não foi cobrado.',
  FAILED:
    'Não conseguimos corrigir agora. O crédito voltou para você — tenta de novo daqui a pouco.',
};

/**
 * Correção de produção livre.
 *
 * O pedido reserva 1 crédito já no request (saldo insuficiente é 402 na
 * hora, sem job à toa) e só enfileira. O job chama a IA, confia apenas nos
 * ids que ela recebeu e emite `tutor.feedback`. Sem correção entregue
 * (falha ou conteúdo impróprio), o crédito volta.
 */
@Injectable()
export class CorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly credits: AiCreditService,
    private readonly catalog: CatalogService,
    private readonly access: CatalogAccessService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
    private readonly storage: StorageService,
    private readonly speech: SpeechToText,
    private readonly events: EventBusService,
    @InjectQueue(QUEUES.TUTOR) private readonly queue: Queue,
  ) {}

  async create(
    userId: string,
    input: CreateCorrectionInput,
  ): Promise<CorrectionView> {
    return this.open(userId, input, { source: TutorInputSource.TEXT });
  }

  /** Voz: o áudio vai para o storage e a transcrição roda em job. */
  async createFromAudio(
    userId: string,
    input: Omit<CreateCorrectionInput, 'text'>,
    audio: { buffer: Buffer; mimeType: string; extension: string },
  ): Promise<CorrectionView> {
    const key = buildStorageKey(
      STORAGE_PREFIXES.UPLOADS,
      'tutor-audio',
      userId,
      `${crypto.randomUUID()}.${audio.extension}`,
    );
    await this.storage.putObject({
      key,
      body: audio.buffer,
      contentType: audio.mimeType,
    });

    return this.open(
      userId,
      { ...input, text: '' },
      { source: TutorInputSource.AUDIO, audioKey: key },
    );
  }

  async get(userId: string, correctionId: string): Promise<CorrectionView> {
    const row = await this.prisma.tutorCorrection.findFirst({
      where: { id: correctionId, userId },
    });

    if (row === null) {
      throw new NotFoundError('Não encontramos essa correção.');
    }

    return toView(row);
  }

  /** Job de voz: transcreve e segue exatamente o caminho do texto. */
  async transcribe(correctionId: string): Promise<{ status: string }> {
    const row = await this.prisma.tutorCorrection.findUnique({
      where: { id: correctionId },
    });

    if (
      row?.status !== TutorCorrectionStatus.TRANSCRIBING ||
      row.audioKey === null
    ) {
      return { status: 'SKIPPED' };
    }

    const audio = await this.storage.getObject(row.audioKey);
    const { text } = await this.speech.transcribe({
      audio,
      mimeType: audioMimeType(row.audioKey),
      languageHint: 'en',
    });

    await this.prisma.tutorCorrection.update({
      where: { id: row.id },
      data: { text, status: TutorCorrectionStatus.QUEUED },
    });
    await this.enqueue(CORRECT_JOB, row.id);

    return { status: 'TRANSCRIBED' };
  }

  async process(
    correctionId: string,
    now = new Date(),
  ): Promise<{ status: string }> {
    const row = await this.prisma.tutorCorrection.findUnique({
      where: { id: correctionId },
    });

    if (row?.status !== TutorCorrectionStatus.QUEUED) {
      return { status: 'SKIPPED' };
    }

    const step =
      row.lessonId === null || row.stepIndex === null
        ? null
        : await this.freeProductionStep(row.lessonId, row.stepIndex);
    const rubric: RubricCriterion[] =
      step?.content.rubric.map((criterion) => ({
        id: criterion.id,
        skillId: criterion.skillId ?? null,
        errorPatternId: criterion.errorPatternId ?? null,
      })) ?? [];
    const targetSkillIds = [
      ...new Set([
        ...(step?.targetSkillIds ?? []),
        ...(step?.content.targetSkillIds ?? []),
        ...rubric.flatMap((c) => (c.skillId === null ? [] : [c.skillId])),
      ]),
    ];

    const [snapshot, errorCatalog, targetSkills] = await Promise.all([
      this.profiles.getSnapshot(row.userId),
      this.taxonomy.activeErrorPatterns(),
      this.taxonomy.skillsByIds(targetSkillIds),
    ]);

    const { data } = await this.ai.run(
      tutorCorrectionPrompt,
      {
        text: row.text,
        task: step?.content.prompt ?? null,
        rubric:
          step?.content.rubric.map((criterion) => ({
            id: criterion.id,
            description: criterion.description,
            skillId: criterion.skillId ?? null,
            errorPatternId: criterion.errorPatternId ?? null,
          })) ?? [],
        targetSkills: targetSkills.map((skill) => ({
          id: skill.id,
          title: skill.title,
        })),
        learner: {
          level: snapshot.overallLevel.level,
          weakSkills: snapshot.weaknesses.skills.map((skill) => skill.title),
          knownErrors: snapshot.weaknesses.errorPatterns.map((error) => ({
            id: error.id,
            description: error.description,
          })),
          pastExamples: snapshot.weaknesses.errorPatterns.flatMap(
            (error) => error.examples,
          ),
        },
        errorCatalog,
      },
      { userId: row.userId },
    );

    const output = sanitizeCorrection(data, {
      errorPatternIds: new Set(errorCatalog.map((error) => error.id)),
      skillIds: new Set(targetSkillIds),
      rubricIds: new Set(rubric.map((criterion) => criterion.id)),
    });

    if (output.safety === 'INAPPROPRIATE') {
      await this.prisma.tutorCorrection.update({
        where: { id: row.id },
        data: { status: TutorCorrectionStatus.REFUSED, completedAt: now },
      });
      await this.refund(row, 'inappropriate');
      return { status: TutorCorrectionStatus.REFUSED };
    }

    await this.prisma.tutorCorrection.update({
      where: { id: row.id },
      data: {
        status: TutorCorrectionStatus.DONE,
        result: output as unknown as Prisma.InputJsonValue,
        completedAt: now,
      },
    });

    this.events.emit(
      'tutor.feedback',
      {
        feedbackId: row.id,
        source: 'CORRECTION',
        ...feedbackFromCorrection({ output, rubric }),
        at: now.toISOString(),
      },
      { userId: row.userId },
    );

    return { status: TutorCorrectionStatus.DONE };
  }

  /** Última tentativa do job falhou: a correção não sai, o crédito volta. */
  async fail(correctionId: string, errorCode: string): Promise<void> {
    const row = await this.prisma.tutorCorrection.findUnique({
      where: { id: correctionId },
    });

    if (row === null || row.status === TutorCorrectionStatus.DONE) {
      return;
    }

    await this.prisma.tutorCorrection.update({
      where: { id: row.id },
      data: { status: TutorCorrectionStatus.FAILED, errorCode },
    });
    await this.refund(row, 'job_failed');
  }

  private async open(
    userId: string,
    input: CreateCorrectionInput,
    origin: { source: TutorInputSource; audioKey?: string },
  ): Promise<CorrectionView> {
    if (input.clientRequestId !== undefined) {
      const existing = await this.prisma.tutorCorrection.findUnique({
        where: {
          userId_clientRequestId: {
            userId,
            clientRequestId: input.clientRequestId,
          },
        },
      });

      if (existing !== null) {
        return toView(existing);
      }
    }

    let lessonVersionId: string | null = null;

    if (input.lessonId !== undefined && input.stepIndex !== undefined) {
      await this.access.assertLesson(userId, input.lessonId);
      lessonVersionId = (
        await this.freeProductionStep(input.lessonId, input.stepIndex)
      ).lessonVersionId;
    }

    const reservation = await this.credits.reserve(userId, 'TUTOR_CORRECTION');
    let row: TutorCorrection;

    try {
      row = await this.prisma.tutorCorrection.create({
        data: {
          userId,
          lessonId: input.lessonId ?? null,
          lessonVersionId,
          stepIndex: input.stepIndex ?? null,
          text: input.text,
          source: origin.source,
          audioKey: origin.audioKey ?? null,
          status:
            origin.source === TutorInputSource.AUDIO
              ? TutorCorrectionStatus.TRANSCRIBING
              : TutorCorrectionStatus.QUEUED,
          creditReservationId: reservation.reservationId,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
    } catch (error) {
      // Dois envios do mesmo pedido ao mesmo tempo: o segundo devolve o primeiro.
      await this.credits.refund(reservation.reservationId, 'duplicate_request');

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.clientRequestId !== undefined
      ) {
        return this.getByClientId(userId, input.clientRequestId);
      }

      throw error;
    }

    await this.enqueue(
      origin.source === TutorInputSource.AUDIO ? TRANSCRIBE_JOB : CORRECT_JOB,
      row.id,
    );

    return toView(row);
  }

  private async getByClientId(
    userId: string,
    clientRequestId: string,
  ): Promise<CorrectionView> {
    const row = await this.prisma.tutorCorrection.findUniqueOrThrow({
      where: { userId_clientRequestId: { userId, clientRequestId } },
    });
    return toView(row);
  }

  private async freeProductionStep(lessonId: string, stepIndex: number) {
    const found = await this.catalog.publishedStep(lessonId, stepIndex);

    if (found.step.type !== 'FREE_PRODUCTION') {
      throw new WrongStepTypeError('FREE_PRODUCTION');
    }

    return { ...found, content: found.step.content };
  }

  private async enqueue(name: string, correctionId: string): Promise<void> {
    const data: CorrectionJobData = { correctionId };
    await this.queue.add(name, data, { jobId: `${name}-${correctionId}` });
  }

  private async refund(row: TutorCorrection, reason: string): Promise<void> {
    if (row.creditReservationId !== null) {
      await this.credits.refund(row.creditReservationId, reason);
    }
  }
}

/** Formatos que tocam em qualquer navegador, inclusive no Safari do iPhone. */
export const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

function audioMimeType(key: string): string {
  return AUDIO_TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream';
}

function toView(row: TutorCorrection): CorrectionView {
  return {
    id: row.id,
    status: row.status,
    message: MESSAGES[row.status],
    lessonId: row.lessonId,
    stepIndex: row.stepIndex,
    source: row.source,
    text: row.text,
    result: row.result as unknown as CorrectionOutput | null,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}
