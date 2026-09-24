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
