import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros das notificações. `code` em inglês, `message` em pt-BR. */

export class PushUnavailableError extends AppException {
  constructor() {
    super(
      'PUSH_UNAVAILABLE',
      'As notificações no navegador ainda não estão disponíveis. Por enquanto, os avisos vão por e-mail.',
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidUnsubscribeTokenError extends AppException {
  constructor() {
    super(
      'INVALID_UNSUBSCRIBE_TOKEN',
      'Esse link não é válido. Você pode ajustar os avisos em Perfil → Notificações.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ReminderHourInQuietTimeError extends AppException {
  constructor() {
    super(
      'REMINDER_HOUR_IN_QUIET_TIME',
      'O horário do lembrete cai dentro do horário silencioso. Escolha outro horário ou ajuste o silencioso.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Nenhum canal entregou: o job tenta de novo. */
export class NotificationNotDeliveredError extends AppException {
  constructor() {
    super(
      'NOTIFICATION_NOT_DELIVERED',
      'Não conseguimos entregar o aviso.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
