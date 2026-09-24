import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { EventBusService } from './event-bus.service';

/**
 * Comunicação entre módulos por evento. Para leitura síncrona, use o serviço
 * exportado pelo módulo dono do dado (ver CLAUDE.md → Convenções).
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      // Um handler que estoura não pode derrubar quem emitiu.
      ignoreErrors: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
