export type SendMailInput = {
  to: string;
  subject: string;
  /** Corpo em HTML. Texto para o aluno, sempre em pt-BR. */
  html: string;
  /** Alternativa em texto puro, para cliente que não renderiza HTML. */
  text?: string;
};

export type SendMailResult = {
  /** Id do provedor, quando há. Serve para rastrear entrega. */
  messageId?: string;
};

/**
 * Contrato de envio de e-mail.
 *
 * Os módulos dependem desta classe abstrata, nunca do Resend — trocar de
 * provedor não toca em ninguém.
 */
export abstract class MailService {
  abstract send(input: SendMailInput): Promise<SendMailResult>;
}
