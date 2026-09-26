import { Injectable, Logger } from '@nestjs/common';
import { sendNotification, WebPushError } from 'web-push';

import { EnvService } from 'src/common/config/env.service';

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushResult =
  | { ok: true }
  /** `gone`: o navegador cancelou a inscrição (404/410) — apague. */
  | { ok: false; gone: boolean };

/**
 * Envio de Web Push atrás de uma classe abstrata: o canal não sabe se é a
 * biblioteca `web-push` ou o fake do teste.
 */
export abstract class WebPushSender {
  /** Chave VAPID pública, ou `null` se o push não está configurado. */
  abstract publicKey(): string | null;
  abstract send(target: PushTarget, payload: string): Promise<PushResult>;
}

@Injectable()
export class VapidWebPushSender extends WebPushSender {
  private readonly logger = new Logger(VapidWebPushSender.name);

  constructor(private readonly env: EnvService) {
    super();
  }

  publicKey(): string | null {
    return this.env.get('VAPID_PUBLIC_KEY') ?? null;
  }

  async send(target: PushTarget, payload: string): Promise<PushResult> {
    const publicKey = this.env.get('VAPID_PUBLIC_KEY');
    const privateKey = this.env.get('VAPID_PRIVATE_KEY');
    const subject = this.env.get('VAPID_SUBJECT');

    if (
      publicKey === undefined ||
      privateKey === undefined ||
      subject === undefined
    ) {
      return { ok: false, gone: false };
    }

    try {
      await sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        payload,
        {
          vapidDetails: { subject, publicKey, privateKey },
          // Lembrete de hoje não vale nada amanhã.
          TTL: 12 * 3600,
        },
      );
      return { ok: true };
    } catch (error) {
      const status = error instanceof WebPushError ? error.statusCode : null;
      // O endpoint é do navegador do aluno: não vai para o log.
      this.logger.warn({ status }, 'Falha ao enviar Web Push');
      return { ok: false, gone: status === 404 || status === 410 };
    }
  }
}

/** Fake de teste: guarda o que "enviou"; endpoint marcado como `gone` falha. */
@Injectable()
export class FakeWebPushSender extends WebPushSender {
  readonly sent: { endpoint: string; payload: unknown }[] = [];
  readonly goneEndpoints = new Set<string>();

  publicKey(): string | null {
    return 'fake-vapid-public-key';
  }

  async send(target: PushTarget, payload: string): Promise<PushResult> {
    if (this.goneEndpoints.has(target.endpoint)) {
      return Promise.resolve({ ok: false, gone: true });
    }

    this.sent.push({
      endpoint: target.endpoint,
      payload: JSON.parse(payload) as unknown,
    });
    return Promise.resolve({ ok: true });
  }

  reset(): void {
    this.sent.length = 0;
    this.goneEndpoints.clear();
  }
}
