import { Global, Logger, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { FakeTtsProvider } from './fake-tts.provider';
import { TtsProvider } from './tts.provider';

/**
 * Escolha do provedor de voz.
 *
 * Só existe o fake. Quando entrar um fornecedor de verdade, ele vira mais um
 * `case` aqui e mais um valor no enum de `TTS_PROVIDER` — nenhum chamador
 * muda, porque todos dependem de `TtsProvider`.
 */
@Global()
@Module({
  providers: [
    FakeTtsProvider,
    {
      provide: TtsProvider,
      inject: [EnvService, FakeTtsProvider],
      useFactory: (envService: EnvService, fake: FakeTtsProvider) => {
        const configured = envService.get('TTS_PROVIDER');
        const logger = new Logger('TtsModule');

        if (configured !== 'fake') {
          logger.warn(
            { configured },
            'Provedor de voz desconhecido — usando o fake',
          );
        }

        return fake;
      },
    },
  ],
  exports: [TtsProvider],
})
export class TtsModule {}
