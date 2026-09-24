import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  buildDomainEvent,
  type DomainEvent,
  type DomainEventName,
  type DomainEventPayloads,
} from 'src/common/events';

/**
 * Fachada tipada sobre o EventEmitter2.
 *
 * Os módulos emitem por aqui, nunca pelo emitter cru — assim o nome e o
 * payload do evento são conferidos em tempo de compilação contra o catálogo
 * de `src/common/events.ts`.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloads[TName],
    options: { userId?: string; occurredAt?: Date } = {},
  ): DomainEvent<TName> {
    const event = buildDomainEvent(name, payload, options);

    this.logger.debug({ event: name, userId: event.userId }, 'Evento emitido');
    this.emitter.emit(name, event);

    return event;
  }

  /**
   * Emissão que espera todos os handlers assíncronos terminarem. Use só
   * quando o resultado importa para o fluxo — o padrão é `emit`, que não
   * bloqueia.
   */
  async emitAsync<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloads[TName],
    options: { userId?: string; occurredAt?: Date } = {},
  ): Promise<DomainEvent<TName>> {
    const event = buildDomainEvent(name, payload, options);

    await this.emitter.emitAsync(name, event);

    return event;
  }
}
