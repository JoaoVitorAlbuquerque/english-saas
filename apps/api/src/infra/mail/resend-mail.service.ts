import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { EnvService } from 'src/common/config/env.service';

import {
  MailService,
  type SendMailInput,
  type SendMailResult,
} from './mail.service';

/**
 * Envio pelo Resend.
 *
 * O cliente nasce sob demanda: o Nest instancia este provider mesmo quando a
 * factory escolhe o console, e aí não há chave para dar.
 */
@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger(ResendMailService.name);
  private cachedClient: Resend | undefined;

  constructor(private readonly envService: EnvService) {
    super();
  }

  private get client(): Resend {
    if (this.cachedClient === undefined) {
      const apiKey = this.envService.get('RESEND_API_KEY');

      if (apiKey === undefined) {
        throw new Error('RESEND_API_KEY não está configurada.');
      }

      this.cachedClient = new Resend(apiKey);
    }

    return this.cachedClient;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const { data, error } = await this.client.emails.send({
      from: this.envService.get('MAIL_FROM'),
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text === undefined ? {} : { text: input.text }),
    });

    if (error) {
      // O destinatário não vai para o log: é dado pessoal.
      this.logger.error({ reason: error.name }, 'Resend recusou o envio');
      throw new Error(`Resend: ${error.message}`);
    }

    return data?.id === undefined ? {} : { messageId: data.id };
  }
}
