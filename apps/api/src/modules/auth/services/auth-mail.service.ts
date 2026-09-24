import { Injectable } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { MailService } from 'src/infra/mail/mail.service';

/**
 * E-mails transacionais do módulo. Texto em pt-BR, direto e amigável.
 *
 * O link aponta sempre para o front (`WEB_URL`), nunca para a API: quem
 * mostra a tela de confirmação é o front.
 */
@Injectable()
export class AuthMailService {
  constructor(
    private readonly mail: MailService,
    private readonly envService: EnvService,
  ) {}

  async sendEmailVerification(input: {
    to: string;
    name: string;
    token: string;
  }): Promise<void> {
    const link = this.webLink('/auth/verify-email', input.token);
    const firstName = input.name.split(' ')[0] ?? input.name;

    await this.mail.send({
      to: input.to,
      subject: 'Confirme seu e-mail',
      text: [
        `Oi, ${firstName}!`,
        '',
        'Confirme seu e-mail para liberar sua conta:',
        link,
        '',
        'O link vale por 24 horas.',
        'Se não foi você que criou a conta, pode ignorar esta mensagem.',
      ].join('\n'),
      html: this.wrapHtml(`
        <p>Oi, ${escapeHtml(firstName)}!</p>
        <p>Confirme seu e-mail para liberar sua conta:</p>
        <p><a href="${link}">Confirmar meu e-mail</a></p>
        <p>O link vale por 24 horas.</p>
        <p>Se não foi você que criou a conta, pode ignorar esta mensagem.</p>
      `),
    });
  }

  async sendPasswordReset(input: {
    to: string;
    name: string;
    token: string;
  }): Promise<void> {
    const link = this.webLink('/auth/reset-password', input.token);
    const firstName = input.name.split(' ')[0] ?? input.name;

    await this.mail.send({
      to: input.to,
      subject: 'Criar uma nova senha',
      text: [
        `Oi, ${firstName}!`,
        '',
        'Você pediu para criar uma nova senha. Use o link abaixo:',
        link,
        '',
        'O link vale por 30 minutos e só funciona uma vez.',
        'Se não foi você, ignore esta mensagem: sua senha continua a mesma.',
      ].join('\n'),
      html: this.wrapHtml(`
        <p>Oi, ${escapeHtml(firstName)}!</p>
        <p>Você pediu para criar uma nova senha:</p>
        <p><a href="${link}">Criar nova senha</a></p>
        <p>O link vale por 30 minutos e só funciona uma vez.</p>
        <p>Se não foi você, ignore esta mensagem: sua senha continua a mesma.</p>
      `),
    });
  }

  async sendDataExportReady(input: {
    to: string;
    name: string;
    url: string;
    expiresInHours: number;
  }): Promise<void> {
    const firstName = input.name.split(' ')[0] ?? input.name;

    await this.mail.send({
      to: input.to,
      subject: 'Seus dados estão prontos para download',
      text: [
        `Oi, ${firstName}!`,
        '',
        'O arquivo com os seus dados ficou pronto:',
        input.url,
        '',
        `O link vale por ${String(input.expiresInHours)} horas.`,
      ].join('\n'),
      html: this.wrapHtml(`
        <p>Oi, ${escapeHtml(firstName)}!</p>
        <p>O arquivo com os seus dados ficou pronto:</p>
        <p><a href="${input.url}">Baixar meus dados</a></p>
        <p>O link vale por ${String(input.expiresInHours)} horas.</p>
      `),
    });
  }

  private webLink(path: string, token: string): string {
    const base = this.envService.get('WEB_URL').replace(/\/+$/, '');

    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }

  private wrapHtml(body: string): string {
    return `<div style="font-family:system-ui,sans-serif;line-height:1.5">${body}</div>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
