import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

export class InvalidCredentialsError extends AppException {
  constructor() {
    // Mensagem igual para e-mail inexistente e senha errada, de propósito:
    // não entregamos quais e-mails têm conta aqui.
    super(
      'INVALID_CREDENTIALS',
      'E-mail ou senha incorretos.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class EmailAlreadyInUseError extends AppException {
  constructor() {
    super(
      'EMAIL_ALREADY_IN_USE',
      'Já existe uma conta com este e-mail.',
      HttpStatus.CONFLICT,
    );
  }
}

export class WeakPasswordError extends AppException {
  constructor(messages: string[]) {
    super(
      'WEAK_PASSWORD',
      messages[0] ?? 'Escolha uma senha mais forte.',
      HttpStatus.BAD_REQUEST,
      { problems: messages },
    );
  }
}

export class SessionExpiredError extends AppException {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super('SESSION_EXPIRED', message, HttpStatus.UNAUTHORIZED, { reason });
  }
}

export class InvalidTokenError extends AppException {
  constructor(message = 'Este link é inválido ou já expirou.') {
    super('INVALID_TOKEN', message, HttpStatus.BAD_REQUEST);
  }
}

export class CsrfTokenMismatchError extends AppException {
  constructor() {
    super(
      'CSRF_TOKEN_MISMATCH',
      'Não conseguimos validar a origem da requisição. Recarregue a página e tente de novo.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class OAuthNotConfiguredError extends AppException {
  constructor() {
    super(
      'OAUTH_NOT_CONFIGURED',
      'O login com Google não está disponível no momento.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class OAuthFailedError extends AppException {
  constructor(reason: string) {
    super(
      'OAUTH_FAILED',
      'Não conseguimos concluir o login com o Google. Tente de novo.',
      HttpStatus.UNAUTHORIZED,
      { reason },
    );
  }
}

export class AccountDeletedError extends AppException {
  constructor() {
    super('ACCOUNT_DELETED', 'Esta conta foi removida.', HttpStatus.FORBIDDEN);
  }
}

export class PasswordLoginUnavailableError extends AppException {
  constructor() {
    super(
      'PASSWORD_LOGIN_UNAVAILABLE',
      'Esta conta entra pelo Google. Use o botão "Entrar com Google".',
      HttpStatus.CONFLICT,
    );
  }
}
