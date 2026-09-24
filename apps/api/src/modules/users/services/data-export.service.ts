import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DataExportStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import {
  STORAGE_PREFIXES,
  buildStorageKey,
} from 'src/infra/storage/storage-keys';
import { StorageService } from 'src/infra/storage/storage.service';

export const DATA_EXPORT_JOB = 'data-export';

export type DataExportJobData = { exportId: string; userId: string };

export type DataExportView = {
  id: string;
  status: DataExportStatus;
  createdAt: Date;
  expiresAt: Date | null;
  sizeBytes: number | null;
  /** URL assinada, só quando o arquivo está pronto e ainda vale. */
  downloadUrl: string | null;
};

/**
 * Portabilidade de dados (LGPD art. 18).
 *
 * O pedido entra numa fila — juntar tudo é lento demais para um request.
 * O arquivo vai para o bucket sob `exports/` e o aluno recebe uma URL
 * assinada com validade curta.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly envService: EnvService,
    @InjectQueue(QUEUES.USERS) private readonly queue: Queue,
  ) {}

  /** Enfileira um export e devolve o id para acompanhamento. */
  async request(userId: string): Promise<{ id: string }> {
    const created = await this.prisma.dataExport.create({
      data: { userId, status: DataExportStatus.PENDING },
      select: { id: true },
    });

    await this.queue.add(DATA_EXPORT_JOB, {
      exportId: created.id,
      userId,
    } satisfies DataExportJobData);

    return created;
  }

  /** Estado do export mais recente, com a URL assinada quando pronto. */
  async latest(userId: string): Promise<DataExportView | null> {
    const record = await this.prisma.dataExport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (record === null) {
      return null;
    }

    return this.toView(record);
  }

  async findById(userId: string, id: string): Promise<DataExportView> {
    const record = await this.prisma.dataExport.findFirst({
      where: { id, userId },
    });

    if (record === null) {
      throw new NotFoundError('Não encontramos este pedido de export.');
    }

    return this.toView(record);
  }

  /**
   * Junta todos os dados do aluno, grava no bucket e marca o export pronto.
   * Chamado pelo processor — nunca direto por um controller.
   */
  async run(input: DataExportJobData): Promise<void> {
    try {
      const payload = await this.collect(input.userId);
      const body = JSON.stringify(payload, null, 2);
      const key = buildStorageKey(
        STORAGE_PREFIXES.EXPORTS,
        'users',
        input.userId,
        `${input.exportId}.json`,
      );

      await this.storage.putObject({
        key,
        body,
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'no-store',
      });

      const ttlHours = this.envService.get('DATA_EXPORT_TTL_HOURS');

      await this.prisma.dataExport.update({
        where: { id: input.exportId },
        data: {
          status: DataExportStatus.READY,
          storageKey: key,
          sizeBytes: Buffer.byteLength(body, 'utf8'),
          expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1_000),
        },
      });
    } catch (error) {
      this.logger.error(
        { err: error, exportId: input.exportId },
        'Export de dados falhou',
      );

      await this.prisma.dataExport.update({
        where: { id: input.exportId },
        data: {
          status: DataExportStatus.FAILED,
          errorCode:
            error instanceof Error ? error.name : 'UNKNOWN_EXPORT_ERROR',
        },
      });

      throw error;
    }
  }

  /**
   * Tudo que guardamos sobre o aluno, em JSON legível.
   *
   * Cresce a cada módulo: quando `learning` e `srs` existirem, as tentativas
   * e os cartões de revisão entram aqui.
   */
  private async collect(userId: string): Promise<Record<string, unknown>> {
    const [user, profile, interests, consents, aiUsage] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.studentInterest.findMany({
        where: { userId },
        select: { topic: true, weight: true, source: true, createdAt: true },
      }),
      this.prisma.consent.findMany({
        where: { userId },
        select: {
          type: true,
          version: true,
          granted: true,
          grantedAt: true,
          revokedAt: true,
        },
      }),
      this.prisma.aiUsage.findMany({
        where: { userId },
        select: {
          feature: true,
          promptId: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format: 'english-saas/user-export@1',
      account: user,
      studentProfile: profile,
      interests,
      consents,
      aiUsage,
    };
  }

  private async toView(record: {
    id: string;
    status: DataExportStatus;
    createdAt: Date;
    expiresAt: Date | null;
    sizeBytes: number | null;
    storageKey: string | null;
  }): Promise<DataExportView> {
    const isDownloadable =
      record.status === DataExportStatus.READY &&
      record.storageKey !== null &&
      record.expiresAt !== null &&
      record.expiresAt.getTime() > Date.now();

    return {
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      sizeBytes: record.sizeBytes,
      downloadUrl:
        isDownloadable && record.storageKey !== null
          ? await this.storage.getSignedUrl(record.storageKey, {
              downloadFileName: 'meus-dados-english-saas.json',
            })
          : null,
    };
  }
}
