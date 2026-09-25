/**
 * Catálogo central dos eventos de domínio.
 *
 * Cada módulo que passa a emitir um evento acrescenta uma entrada em
 * `DomainEventPayloads`. O `EventBus` e os handlers derivam a tipagem daqui,
 * então emitir um evento inexistente, ou com payload errado, não compila.
 *
 * Nome do evento: `<módulo>.<fato no passado>` — `lesson.completed`,
 * `subscription.activated` (ver CLAUDE.md → Convenções).
 */

/** Envelope de todo evento que trafega pelo EventEmitter2. */
export type DomainEvent<
  TName extends DomainEventName = DomainEventName,
  TPayload = DomainEventPayloads[TName],
> = {
  name: TName;
  occurredAt: Date;
  /** Aluno a quem o fato pertence. Ausente em evento de sistema. */
  userId?: string;
  payload: TPayload;
};

/**
 * Mapa evento → payload.
 *
 * Hoje só o evento de infraestrutura que prova o caminho da fila ponta a
 * ponta. Os eventos de negócio entram com os módulos 3 em diante.
 */
export interface DomainEventPayloads {
  'infra.example_job.processed': {
    jobId: string;
    message: string;
    processedAt: string;
  };

  // --- módulo 3: auth / users / onboarding ---

  /** Conta criada. O e-mail ainda pode não estar verificado. */
  'user.registered': {
    userId: string;
    email: string;
    via: 'password' | 'google';
  };
  /**
   * Onboarding concluído: objetivos, disponibilidade e interesses salvos.
   * O planejador (10) e o nivelamento (8) escutam para montar o primeiro
   * cronograma e agendar o teste inicial.
   */
  'user.onboarded': {
    userId: string;
    goals: string[];
    weeklyMinutes: number;
    selfReportedLevel: string;
    interests: string[];
    targetDate: string | null;
  };
  /** Aluno pediu exclusão da conta. Soft delete já foi aplicado. */
  'user.deletion_requested': {
    userId: string;
    deletedAt: string;
    anonymizeAt: string;
  };
  /** Conta anonimizada em definitivo pelo job de carência. */
  'user.anonymized': { userId: string; anonymizedAt: string };

  // --- módulo 4: curriculum ---

  /**
   * Uma versão de lição entrou no ar e passou a ser o que o aluno vê.
   * O SRS (9) e o planejador (10) escutam para acrescentar o conteúdo novo
   * às trilhas; o modelo do aluno (7) para conhecer as skills cobertas.
   */
  'curriculum.lesson_published': {
    lessonId: string;
    lessonSlug: string;
    lessonVersionId: string;
    version: number;
    cefrLevel: string;
    targetSkillIds: string[];
    publishedAt: string;
  };

  /**
   * Um revisor aprovou a versão. O content-studio (5) escuta para sintetizar
   * o áudio — o editor precisa ouvir antes de deixar ir ao ar, e o publish é
   * recusado enquanto faltar fala sem áudio.
   */
  'curriculum.lesson_approved': {
    lessonId: string;
    lessonSlug: string;
    lessonVersionId: string;
    version: number;
    cefrLevel: string;
    approvedAt: string;
  };

  // --- módulo 5: content-studio ---

  /** Rascunho gerado e checado. Já existe conteúdo em DRAFT para revisar. */
  'content.draft_ready': {
    draftId: string;
    kind: string;
    lessonVersionId: string | null;
    createdItemCount: number;
    blockerCount: number;
    warningCount: number;
  };
  /** A geração falhou. O rascunho fica em FAILED com o código do erro. */
  'content.draft_failed': { draftId: string; kind: string; errorCode: string };
  /** Áudio de uma versão sintetizado (ou reaproveitado do cache). */
  'content.audio_generated': {
    lessonVersionId: string;
    generated: number;
    reused: number;
  };
  /** Apostila em PDF de uma unidade gerada. */
  'content.workbook_generated': {
    unitId: string;
    workbookId: string;
    sizeBytes: number;
  };

  // --- módulo 6: learning ---
  //
  // O que o aluno faz. O modelo do aluno (7) e o SRS (9) escutam daqui —
  // nenhum deles lê as tabelas do learning por fora.

  /** Tentativa nova. Retomar uma aberta não emite de novo. */
  'lesson.started': {
    attemptId: string;
    lessonId: string;
    lessonVersionId: string;
    version: number;
    source: string;
  };
  'lesson.step_completed': {
    attemptId: string;
    lessonId: string;
    stepIndex: number;
    stepType: string;
    timeSpentMs: number;
  };
  /**
   * Resposta corrigida. É o evento que alimenta mastery e erros
   * recorrentes (7) e a estatística do item (6, em lote).
   */
  'answer.submitted': {
    answerId: string;
    itemId: string;
    attemptId: string | null;
    context: string;
    skillIds: string[];
    isCorrect: boolean;
    score: number;
    errorPatterns: string[];
    /** Dificuldade do item na escala logit, no momento da resposta. */
    difficulty: number;
    isFirstTry: boolean;
    responseTimeMs: number;
    hintsUsed: number;
  };
  'lesson.completed': {
    attemptId: string;
    lessonId: string;
    lessonVersionId: string;
    source: string;
    xpEarned: number;
    durationMs: number;
    /** Questões respondidas e acertos de primeira. */
    answeredItems: number;
    correctFirstTries: number;
    currentStreak: number;
  };

  // --- módulo 7: learner-model ---

  /**
   * O modelo do aluno mudou. O SRS (9) e o planejador (10) escutam para
   * reagendar e remontar a agenda.
   */
  'learner.model_updated': {
    processedAnswers: number;
    skillIds: string[];
    errorPatternIds: string[];
    overallLevel: string;
  };

  // --- módulo 8: assessment ---

  /**
   * Nivelamento concluído. O learner-model (7) grava como ponto de partida;
   * o planejador (10) pula as `masteredSkillIds`.
   */
  'placement.completed': {
    placementId: string;
    overallLevel: string;
    theta: number;
    standardError: number;
    /** Competency → { theta, standardError, level, items }. */
    levelsByCompetency: Record<
      string,
      { theta: number; standardError: number; level: string; items: number }
    >;
    masteredSkillIds: string[];
    itemsAnswered: number;
    bankExhausted: boolean;
    completedAt: string;
  };
  /** Checkpoint de unidade concluído. Diagnóstico — não trava nada. */
  'checkpoint.completed': {
    checkpointId: string;
    unitId: string;
    result: string;
    score: number;
    reinforceSkillIds: string[];
    itemsAnswered: number;
  };
}

export type DomainEventName = keyof DomainEventPayloads & string;

/**
 * Monta o envelope de um evento. Função pura: o relógio entra por parâmetro
 * para o teste não depender do horário da máquina.
 */
export function buildDomainEvent<TName extends DomainEventName>(
  name: TName,
  payload: DomainEventPayloads[TName],
  options: { userId?: string; occurredAt?: Date } = {},
): DomainEvent<TName> {
  return {
    name,
    occurredAt: options.occurredAt ?? new Date(),
    ...(options.userId === undefined ? {} : { userId: options.userId }),
    payload,
  };
}
