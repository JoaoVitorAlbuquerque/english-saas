import { Injectable, Logger } from '@nestjs/common';

import {
  MailService,
  type SendMailInput,
  type SendMailResult,
} from './mail.service';

/**
 * Implementação de desenvolvimento: imprime no console em vez de enviar.
 *
 * Guarda as últimas mensagens em memória para os testes e2e conseguirem
 * pegar o link de verificação sem caixa de entrada nenhuma.
 */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger(ConsoleMailService.name);
  private static readonly MAX_KEPT = 50;

  readonly sent: (SendMailInput & { sentAt: Date })[] = [];

  async send(input: SendMailInput): Promise<SendMailResult> {
    this.sent.push({ ...input, sentAt: new Date() });

    if (this.sent.length > ConsoleMailService.MAX_KEPT) {
      this.sent.shift();
    }

    this.logger.log(
      `\n─── E-MAIL (dev) ───\nPara: ${input.to}\nAssunto: ${input.subject}\n\n${
        input.text ?? input.html
      }\n────────────────────`,
    );

    return await Promise.resolve({
      messageId: `console-${String(this.sent.length)}`,
    });
  }

  /** Último e-mail enviado para um destinatário. Só faz sentido em teste. */
  lastTo(email: string): (SendMailInput & { sentAt: Date }) | undefined {
    return [...this.sent].reverse().find((mail) => mail.to === email);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
