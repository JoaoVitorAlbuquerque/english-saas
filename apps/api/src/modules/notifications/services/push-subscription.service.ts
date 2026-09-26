import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UsersService } from 'src/modules/users/services/users.service';

import type {
  PushSubscriptionDto,
  PushUnsubscribeDto,
} from '../dto/notifications.dto';
import { PushUnavailableError } from '../notifications.errors';
import { WebPushChannel } from './channels';
import { PreferenceService } from './preference.service';
import { WebPushSender } from './web-push-sender';

/**
 * Inscrições de Web Push, uma por navegador. Ativar em Perfil →
 * Notificações é: o front pede permissão, chama `pushManager.subscribe`
 * com a chave pública e manda o resultado para cá.
 */
@Injectable()
export class PushSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WebPushSender,
    private readonly preferences: PreferenceService,
    private readonly users: UsersService,
    private readonly channel: WebPushChannel,
  ) {}

  publicKey(): { publicKey: string } {
    const key = this.sender.publicKey();
    if (key === null) throw new PushUnavailableError();
    return { publicKey: key };
  }

  async subscribe(userId: string, body: PushSubscriptionDto) {
    this.publicKey();

    // Mesmo navegador com outra conta logada: a inscrição passa a ser dela.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent ?? null,
      },
      update: {
        userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent ?? null,
      },
    });
    await this.preferences.setPushEnabled(userId, true);

    return this.preferences.view(userId);
  }

  async unsubscribe(userId: string, body: PushUnsubscribeDto) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint: body.endpoint },
    });

    return this.preferences.view(userId);
  }

  /** Push de teste: o aluno confere que o aviso chega neste navegador. */
  async test(userId: string): Promise<{ delivered: boolean }> {
    this.publicKey();
    const user = await this.users.findById(userId);

    const delivered = await this.channel.send(
      { userId, email: user.email, name: user.name },
      {
        type: 'TEST',
        title: 'Notificações ativadas',
        body: 'É assim que os lembretes do seu plano vão aparecer.',
        path: '/perfil/notificacoes',
      },
    );

    return { delivered };
  }
}
