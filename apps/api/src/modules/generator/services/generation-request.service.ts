import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  GenerationKind,
  GenerationStatus,
  Prisma,
  type GenerationJob,
} from '@prisma/client';
import { Queue } from 'bullmq';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import type { CreditFeature } from 'src/modules/billing/domain/credits';

import {
  initialSteps,
  STEP_LABELS,
  stepsFor,
  type StepState,
} from '../domain/steps';
import { THEME_TOPIC_PT, type ThemeCategory } from '../domain/targets';
import {
  SuggestionNotFoundError,
  SuggestionsPendingError,
} from '../generator.errors';
import {
  INGEST_JOB,
  SUGGEST_JOB,
  TOPIC_JOB,
  type GenerationJobData,
} from '../jobs/generator-jobs';
import { IngestSources } from './ingest-sources';

export type Suggestion = {
  id: string;
  title: string;
  whyInteresting: string;
  wikipediaSearchQuery: string;
  category: ThemeCategory;
};

export type StoredSuggestions = { themes: string[]; items: Suggestion[] };

/** O assunto de um pedido TOPIC. `topic` é o interesse em pt-BR. */
export type ChosenTopic = {
  title: string;
  searchQuery: string;
  category: ThemeCategory;
  topic: string;
};

export type GenerationJobView = {
  id: string;
  kind: GenerationKind;
  status: GenerationStatus;
  message: string;
  steps: (StepState & { label: string })[];
  themes: string[];
  suggestions: Omit<Suggestion, 'wikipediaSearchQuery'>[];
  materialId: string | null;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

const REFUSED_MESSAGES: Record<string, string> = {
  INAPPROPRIATE:
    'Não dá para montar material com esse conteúdo: ele tem conteúdo impróprio. O crédito não foi cobrado.',
  CONTENT_NOT_ENGLISH:
    'Esse texto não parece estar em inglês. O crédito não foi cobrado — manda um conteúdo em inglês.',
};

const FAILED_MESSAGES: Record<string, string> = {
  SOURCE_NOT_FOUND:
    'Não achamos uma fonte confiável sobre esse assunto. O crédito voltou — tenta outro tema.',
  ARTICLE_UNAVAILABLE:
    'Não conseguimos ler essa página. O crédito voltou — copia o texto e cola aqui que funciona.',
  CONTENT_TOO_SHORT:
    'O texto é curto demais para virar material. O crédito voltou.',
  LEVEL_OUT_OF_RANGE:
    'Não conseguimos deixar o texto no seu nível desta vez. O crédito voltou — tenta de novo ou escolhe outro tema.',
};

const DEFAULT_FAILED =
  'Não conseguimos montar o material agora. O crédito voltou para você — tenta de novo daqui a pouco.';
const SUGGEST_FAILED =
  'Não conseguimos pensar em assuntos agora. Tenta de novo daqui a pouco.';

/**
 * O lado do request do generator: cria o pedido, reserva o crédito e
 * enfileira. Tudo que chama IA ou sai para a internet roda no job
 * (`GenerationPipelineService`); o app acompanha por `GET /generator/jobs/:id`.
 *
 * Sugerir assunto não cobra. Gerar material cobra na hora do pedido
 * (saldo insuficiente = 402 imediato); se nada for entregue, estorna.
 */
@Injectable()
export class GenerationRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: AiCreditService,
    private readonly ingestSources: IngestSources,
    @InjectQueue(QUEUES.GENERATOR) private readonly queue: Queue,
  ) {}

  async suggest(
    userId: string,
    input: { interestText: string; clientRequestId?: string | undefined },
  ): Promise<GenerationJobView> {
    return this.open(userId, {
      kind: GenerationKind.SUGGEST,
      steps: initialSteps(stepsFor('SUGGEST')),
      interestText: input.interestText,
      clientRequestId: input.clientRequestId,
      feature: null,
    });
  }

  async topic(
    userId: string,
    input: {
      suggestionId?: string | undefined;
      title?: string | undefined;
      surprise?: boolean | undefined;
      clientRequestId?: string | undefined;
    },
  ): Promise<GenerationJobView> {
    const existing = await this.byClientRequest(userId, input.clientRequestId);
    if (existing !== null) return existing;

    const surprise = input.surprise === true;
    const chosen = surprise
      ? null
      : input.suggestionId !== undefined
        ? await this.findSuggestion(userId, input.suggestionId)
        : titleTopic(input.title ?? '');

    return this.open(userId, {
      kind: GenerationKind.TOPIC,
      steps: initialSteps(stepsFor('TOPIC', { surprise })),
      chosen,
      clientRequestId: input.clientRequestId,
      feature: 'GENERATOR_TOPIC',
    });
  }

  async ingest(
    userId: string,
    input: {
      text?: string | undefined;
      url?: string | undefined;
      clientRequestId?: string | undefined;
    },
  ): Promise<GenerationJobView> {
    const existing = await this.byClientRequest(userId, input.clientRequestId);
    if (existing !== null) return existing;

    const ingestInput = { text: input.text ?? null, url: input.url ?? null };
    // Link de rede social sem transcrição, link inválido, texto curto:
    // 422 agora, sem cobrar nem enfileirar.
    this.ingestSources.assertAcceptable(ingestInput);

    return this.open(userId, {
      kind: GenerationKind.INGEST,
      steps: initialSteps(stepsFor('INGEST')),
      inputText: ingestInput.text,
      inputUrl: ingestInput.url,
      clientRequestId: input.clientRequestId,
      feature: 'GENERATOR_INGEST',
    });
  }

  async get(userId: string, id: string): Promise<GenerationJobView> {
    const row = await this.prisma.generationJob.findFirst({
      where: { id, userId },
    });

    if (row === null) {
      throw new NotFoundError('Não encontramos esse pedido.');
    }

    return toJobView(row);
  }

  private async open(
    userId: string,
    input: {
      kind: GenerationKind;
      steps: StepState[];
      interestText?: string | null;
      chosen?: ChosenTopic | null;
      inputText?: string | null;
      inputUrl?: string | null;
      clientRequestId?: string | undefined;
      feature: CreditFeature | null;
    },
  ): Promise<GenerationJobView> {
    const existing = await this.byClientRequest(userId, input.clientRequestId);
    if (existing !== null) return existing;

    const reservation =
      input.feature === null
        ? null
        : await this.credits.reserve(userId, input.feature);
    let row: GenerationJob;

    try {
      row = await this.prisma.generationJob.create({
        data: {
          userId,
          kind: input.kind,
          steps: input.steps as unknown as Prisma.InputJsonValue,
          interestText: input.interestText ?? null,
          ...(input.chosen == null
            ? {}
            : { chosen: input.chosen as unknown as Prisma.InputJsonValue }),
          inputText: input.inputText ?? null,
          inputUrl: input.inputUrl ?? null,
          creditReservationId: reservation?.reservationId ?? null,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
    } catch (error) {
      if (reservation !== null) {
        await this.credits.refund(
          reservation.reservationId,
          'duplicate_request',
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.clientRequestId !== undefined
      ) {
        const winner = await this.byClientRequest(
          userId,
          input.clientRequestId,
        );
        if (winner !== null) return winner;
      }

      throw error;
    }

    const data: GenerationJobData = { generationJobId: row.id };
    const name =
      input.kind === GenerationKind.SUGGEST
        ? SUGGEST_JOB
        : input.kind === GenerationKind.TOPIC
          ? TOPIC_JOB
          : INGEST_JOB;
    await this.queue.add(name, data, { jobId: `${name}-${row.id}` });

    return toJobView(row);
  }

  private async byClientRequest(
    userId: string,
    clientRequestId: string | undefined,
  ): Promise<GenerationJobView | null> {
    if (clientRequestId === undefined) {
      return null;
    }

    const row = await this.prisma.generationJob.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId } },
    });

    return row === null ? null : toJobView(row);
  }

  /** A sugestão escolhida, de um pedido de sugestões do próprio aluno. */
  private async findSuggestion(
    userId: string,
    suggestionId: string,
  ): Promise<ChosenTopic> {
    const rows = await this.prisma.generationJob.findMany({
      where: {
        userId,
        kind: GenerationKind.SUGGEST,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const row of rows) {
      const stored = row.suggestions as StoredSuggestions | null;
      const found = stored?.items.find((item) => item.id === suggestionId);

      if (found !== undefined) {
        return {
          title: found.title,
          searchQuery: found.wikipediaSearchQuery,
          category: found.category,
          topic: stored?.themes[0] ?? THEME_TOPIC_PT[found.category],
        };
      }
    }

    if (
      rows.some(
        (row) =>
          row.status === GenerationStatus.QUEUED ||
          row.status === GenerationStatus.RUNNING,
      )
    ) {
      throw new SuggestionsPendingError();
    }

    throw new SuggestionNotFoundError();
  }
}

/** Assunto digitado direto: vai só como busca na Wikipedia, nunca para a IA. */
function titleTopic(title: string): ChosenTopic {
  return {
    title: title.trim(),
    searchQuery: title.trim(),
    category: 'OTHER',
    topic: title.trim().toLowerCase().slice(0, 60),
  };
}

export function toJobView(row: GenerationJob): GenerationJobView {
  const steps = (row.steps as unknown as StepState[]).map((state) => ({
    ...state,
    label: STEP_LABELS[state.step],
  }));
  const stored = row.suggestions as StoredSuggestions | null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    message: messageFor(row, steps),
    steps,
    themes: stored?.themes ?? [],
    suggestions:
      row.kind === GenerationKind.SUGGEST
        ? (stored?.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            whyInteresting: item.whyInteresting,
            category: item.category,
          }))
        : [],
    materialId: row.materialId,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function messageFor(
  row: GenerationJob,
  steps: { status: string; label: string }[],
): string {
  switch (row.status) {
    case GenerationStatus.QUEUED:
      return 'Seu pedido está na fila. Já, já começa.';
    case GenerationStatus.RUNNING:
      return `${steps.find((step) => step.status === 'RUNNING')?.label ?? 'Trabalhando no seu pedido'}…`;
    case GenerationStatus.DONE:
      return row.kind === GenerationKind.SUGGEST
        ? 'Escolhe um dos assuntos — ou pede para a gente escolher.'
        : 'Seu material está pronto.';
    case GenerationStatus.REFUSED:
      return (
        REFUSED_MESSAGES[row.errorCode ?? ''] ??
        REFUSED_MESSAGES['INAPPROPRIATE'] ??
        ''
      );
    case GenerationStatus.FAILED:
      return row.kind === GenerationKind.SUGGEST
        ? SUGGEST_FAILED
        : (FAILED_MESSAGES[row.errorCode ?? ''] ?? DEFAULT_FAILED);
  }
}
