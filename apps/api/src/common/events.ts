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
