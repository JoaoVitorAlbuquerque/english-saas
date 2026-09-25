import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';

import { ITEM_CALIBRATION_JOB } from '../services/calibration.service';

/**
 * Agenda a calibração semanal. `jobId` fixo: reiniciar a API não duplica o
 * agendamento.
 */
@Injectable()
export class CalibrationScheduler implements OnModuleInit {
  private readonly logger = new Logger(CalibrationScheduler.name);

  constructor(
    @InjectQueue(QUEUES.ASSESSMENT) private readonly queue: Queue,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Em teste o e2e chama o serviço direto.
    if (this.envService.isTest) {
      return;
    }

    await this.queue.add(
      ITEM_CALIBRATION_JOB,
      {},
      {
        // Toda segunda às 03:30.
        repeat: { pattern: '30 3 * * 1' },
        jobId: `${ITEM_CALIBRATION_JOB}-weekly`,
      },
    );

    this.logger.log('Calibração de itens agendada para segunda, 03:30');
  }
}
