import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  type NotificationChannelKind,
  type NotificationPreference,
} from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';

import { NotificationNotDeliveredError } from '../notifications.errors';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  type OutgoingNotification,
  type Recipient,
} from './channels';

export type DeliveryOutcome = 'SENT' | 'DUPLICATE' | 'NO_CHANNEL';

/**
 * Entrega uma notificação pelos canais ligados, com envio único.
 *
 * A linha do `NotificationLog` é gravada **antes** de enviar: o `dedupKey`
 * único é a trava. Dois jobs (ou um retry) com a mesma chave — o segundo
 * perde na inserção e não manda nada. É isso que garante no máximo um
 * lembrete por dia. Se nenhum canal entregar, a linha sai e o job tenta de
 * novo.
 */
@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  async enabledChannels(
    prefs: NotificationPreference,
    only?: readonly NotificationChannelKind[],
  ): Promise<NotificationChannel[]> {
    const enabled: NotificationChannel[] = [];

    for (const channel of this.channels) {
      if (only !== undefined && !only.includes(channel.kind)) continue;
      if (await channel.isEnabledFor(prefs)) enabled.push(channel);
    }

    return enabled;
  }

  async deliver(input: {
    recipient: Recipient;
    channels: readonly NotificationChannel[];
    dedupKey: string;
    localDate: string;
    notification: OutgoingNotification;
  }): Promise<DeliveryOutcome> {
    if (input.channels.length === 0) {
      return 'NO_CHANNEL';
    }

    let logId: string;
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          userId: input.recipient.userId,
          type: input.notification.type,
          localDate: input.localDate,
          dedupKey: input.dedupKey,
          channels: [],
          status: 'SENT',
          title: input.notification.title,
        },
      });
      logId = log.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return 'DUPLICATE';
      }
      throw error;
    }

    const delivered: NotificationChannelKind[] = [];

    for (const channel of input.channels) {
      try {
        if (await channel.send(input.recipient, input.notification)) {
          delivered.push(channel.kind);
        }
      } catch (error) {
        this.logger.warn(
          {
            channel: channel.kind,
            type: input.notification.type,
            error: error instanceof Error ? error.message : 'unknown',
          },
          'Canal falhou ao entregar notificação',
        );
      }
    }

    if (delivered.length === 0) {
      await this.prisma.notificationLog.delete({ where: { id: logId } });
      throw new NotificationNotDeliveredError();
    }

    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { channels: delivered },
    });

    return 'SENT';
  }
}
