import { Global, Logger, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { ConsoleMailService } from './console-mail.service';
import { MailService } from './mail.service';
import { ResendMailService } from './resend-mail.service';

/**
 * `auto` usa o Resend quando há `RESEND_API_KEY` e cai no console quando não
 * há — assim o ambiente local sobe sem conta de e-mail. Em produção defina
 * `MAIL_PROVIDER=resend` para que a falta da chave seja erro visível em vez
 * de e-mail sumindo no log.
 */
function resolveMailService(
  envService: EnvService,
  resend: ResendMailService,
  consoleMail: ConsoleMailService,
): MailService {
  const choice = envService.get('MAIL_PROVIDER');

  if (choice === 'resend') {
    return resend;
  }

  if (choice === 'console') {
    return consoleMail;
  }

  // Teste nunca manda e-mail de verdade, mesmo com a chave presente.
  if (envService.isTest) {
    return consoleMail;
  }

  if (!envService.has('RESEND_API_KEY')) {
    new Logger('MailModule').warn(
      'RESEND_API_KEY ausente — os e-mails vão para o console, não para o aluno',
    );
    return consoleMail;
  }

  return resend;
}

@Global()
@Module({
  providers: [
    ResendMailService,
    ConsoleMailService,
    {
      provide: MailService,
      inject: [EnvService, ResendMailService, ConsoleMailService],
      useFactory: resolveMailService,
    },
  ],
  exports: [MailService, ConsoleMailService],
})
export class MailModule {}
