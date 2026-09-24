import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { ITEM_STATS_JOB } from '../services/item-stats.service';

/**
 * Resposta gravada → recálculo da estatística do item, **em lote**.
 *
 * Um job por item, com `jobId` fixo e atraso: enquanto ele espera, as
 * respostas seguintes ao mesmo item caem no job que já existe (o BullMQ
 * ignora `add` com id repetido). Mil alunos respondendo a mesma questão num
 * minuto viram dois ou três recálculos, não mil updates na linha do item.
 *
 * Por isso o job some ao terminar (`removeOnComplete: true`): se ficasse
 * guardado, o id continuaria ocupado e o próximo lote nunca entraria.
 *
 * Resposta que chega **enquanto** o job roda pode ficar de fora da contagem
 * até a próxima resposta ao mesmo item. É uma defasagem de uma resposta,
 * não uma perda — o recálculo parte sempre das respostas gravadas.
 */
@Injectable()
export class LearningListener {
  constructor(
    @InjectQueue(QUEUES.LEARNING) private readonly queue: Queue,
    private readonly env: EnvService,
  ) {}

  @OnEvent('answer.submitted')
  async onAnswerSubmitted(
    event: DomainEvent<'answer.submitted'>,
  ): Promise<void> {
    const { itemId, isFirstTry } = event.payload;

    // Só a primeira tentativa entra na estatística; as outras não mudam nada.
    if (!isFirstTry) {
      return;
    }

    await this.queue.add(
      ITEM_STATS_JOB,
      { itemId },
      {
        // O BullMQ recusa ':' em id customizado.
        jobId: `${ITEM_STATS_JOB}-${itemId}`,
        delay: this.env.get('ITEM_STATS_DELAY_MS'),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
