import { Module } from '@nestjs/common';

import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';

import { AdminUsersController } from './controllers/admin-users.controller';
import { MeController } from './controllers/me.controller';
import { AnonymizationScheduler } from './jobs/anonymization.scheduler';
import { UsersProcessor } from './jobs/users.processor';
import { ConsentService } from './services/consent.service';
import { DataExportService } from './services/data-export.service';
import { UsersService } from './services/users.service';

/**
 * Módulo 3 — users.
 *
 * Dono das tabelas `users`, `student_profiles`, `student_interests`,
 * `consents` e `data_exports`. Os outros módulos leem esses dados pelo
 * `UsersService`, nunca com um findMany atravessado.
 */
@Module({
  imports: [registerQueue(QUEUES.USERS)],
  controllers: [MeController, AdminUsersController],
  providers: [
    UsersService,
    ConsentService,
    DataExportService,
    UsersProcessor,
    AnonymizationScheduler,
  ],
  exports: [UsersService, ConsentService, DataExportService],
})
export class UsersModule {}
