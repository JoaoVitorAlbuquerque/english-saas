import { Global, Module } from '@nestjs/common';

import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.service';

/**
 * Os módulos injetam `StorageService` (a classe abstrata). A implementação
 * concreta é amarrada só aqui.
 */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: S3StorageService }],
  exports: [StorageService],
})
export class StorageModule {}
