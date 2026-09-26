import { Injectable } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import {
  verifyUnsubscribe,
  type UnsubscribableType,
} from '../domain/unsubscribe';
import { InvalidUnsubscribeTokenError } from '../notifications.errors';
import { PreferenceService } from './preference.service';

const LABELS: Record<UnsubscribableType, string> = {
  DAILY_REMINDER: 'o lembrete diário',
  REVIEW_BACKLOG: 'o aviso de revisões acumuladas',
  WEEKLY_SUMMARY: 'o resumo semanal',
};

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly env: EnvService,
    private readonly preferences: PreferenceService,
  ) {}

  async apply(
    token: string,
  ): Promise<{ type: UnsubscribableType; message: string }> {
    const parsed = verifyUnsubscribe(token, this.env.get('JWT_SECRET'));

    if (parsed === null) {
      throw new InvalidUnsubscribeTokenError();
    }

    try {
      await this.preferences.disableType(parsed.userId, parsed.type);
    } catch {
      // Conta apagada: o link não vale mais.
      throw new InvalidUnsubscribeTokenError();
    }

    return {
      type: parsed.type,
      message: `Pronto, você não vai mais receber ${LABELS[parsed.type]}. Dá para ligar de novo em Perfil → Notificações.`,
    };
  }
}
