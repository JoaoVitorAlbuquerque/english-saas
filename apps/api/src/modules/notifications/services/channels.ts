import { Injectable } from '@nestjs/common';
import type {
  NotificationChannelKind,
  NotificationPreference,
  NotificationType,
} from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { MailService } from 'src/infra/mail/mail.service';

import type { NotificationContent } from '../domain/messages';
import {
  signUnsubscribe,
  type UnsubscribableType,
} from '../domain/unsubscribe';
import { WebPushSender } from './web-push-sender';

export type Recipient = { userId: string; email: string; name: string };

export type OutgoingNotification = NotificationContent & {
  type: NotificationType;
};

/**
 * Um canal de entrega. E-mail e Web Push hoje; push de app mobile entra
 * depois como mais uma implementação, sem mexer em quem decide o que mandar.
 */
export abstract class NotificationChannel {
  abstract readonly kind: NotificationChannelKind;
  /** O aluno ligou este canal (e ele está disponível)? */
  abstract isEnabledFor(prefs: NotificationPreference): Promise<boolean>;
  /** `true` se chegou a pelo menos um destino. */
  abstract send(
    recipient: Recipient,
    notification: OutgoingNotification,
  ): Promise<boolean>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

@Injectable()
export class EmailChannel extends NotificationChannel {
  readonly kind = 'EMAIL' as const;

  constructor(
    private readonly mail: MailService,
    private readonly env: EnvService,
  ) {
    super();
  }

  isEnabledFor(prefs: NotificationPreference): Promise<boolean> {
    return Promise.resolve(prefs.emailEnabled);
  }

  async send(
    recipient: Recipient,
    notification: OutgoingNotification,
  ): Promise<boolean> {
    const base = this.env.get('WEB_URL').replace(/\/+$/, '');
    const link = `${base}${notification.path}`;
    const unsubscribe =
      notification.type === 'TEST'
        ? null
        : `${base}/notificacoes/descadastrar?token=${signUnsubscribe(
            recipient.userId,
            notification.type as UnsubscribableType,
            this.env.get('JWT_SECRET'),
          )}`;
    const firstName = recipient.name.split(' ')[0] ?? recipient.name;

    await this.mail.send({
      to: recipient.email,
      subject: notification.title,
      text: [
        `Oi, ${firstName}.`,
        '',
        notification.body,
        '',
        link,
        ...(unsubscribe === null
          ? []
          : ['', `Para não receber mais este aviso: ${unsubscribe}`]),
      ].join('\n'),
      html: [
        `<p>Oi, ${escapeHtml(firstName)}.</p>`,
        `<p>${escapeHtml(notification.body)}</p>`,
        `<p><a href="${escapeHtml(link)}">Abrir</a></p>`,
        ...(unsubscribe === null
          ? []
          : [
              `<p style="font-size:12px;color:#666">Não quer mais este aviso? <a href="${escapeHtml(unsubscribe)}">Parar de receber</a>. As outras preferências ficam em Perfil → Notificações.</p>`,
            ]),
      ].join('\n'),
    });

    return true;
  }
}

@Injectable()
export class WebPushChannel extends NotificationChannel {
  readonly kind = 'WEB_PUSH' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WebPushSender,
  ) {
    super();
  }

  async isEnabledFor(prefs: NotificationPreference): Promise<boolean> {
    if (!prefs.pushEnabled || this.sender.publicKey() === null) {
      return false;
    }

    const count = await this.prisma.pushSubscription.count({
      where: { userId: prefs.userId },
    });
    return count > 0;
  }

  async send(
    recipient: Recipient,
    notification: OutgoingNotification,
  ): Promise<boolean> {
    const targets = await this.prisma.pushSubscription.findMany({
      where: { userId: recipient.userId },
    });
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.path,
      type: notification.type,
    });
    let delivered = false;

    for (const target of targets) {
      const result = await this.sender.send(target, payload);

      if (result.ok) {
        delivered = true;
        await this.prisma.pushSubscription.update({
          where: { id: target.id },
          data: { lastSuccessAt: new Date() },
        });
      } else if (result.gone) {
        // O navegador cancelou a inscrição: não adianta tentar de novo.
        await this.prisma.pushSubscription.deleteMany({
          where: { id: target.id },
        });
      }
    }

    return delivered;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
