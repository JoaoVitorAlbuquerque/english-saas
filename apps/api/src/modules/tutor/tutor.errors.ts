import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do tutor. `code` em inglês, `message` em pt-BR. */

export class WrongStepTypeError extends AppException {
  constructor(expected: 'FREE_PRODUCTION' | 'ROLEPLAY') {
    super(
      'WRONG_STEP_TYPE',
      expected === 'FREE_PRODUCTION'
        ? 'Essa etapa não é de produção livre.'
        : 'Essa etapa não é de roleplay.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { expected },
    );
  }
}

export class RoleplayFinishedError extends AppException {
  constructor() {
    super(
      'ROLEPLAY_FINISHED',
      'Essa conversa já terminou. Dá uma olhada no resumo ou comece outra.',
      HttpStatus.CONFLICT,
    );
  }
}

export class RoleplayTurnInProgressError extends AppException {
  constructor() {
    super(
      'ROLEPLAY_TURN_IN_PROGRESS',
      'O personagem ainda está respondendo. Espera um pouquinho.',
      HttpStatus.CONFLICT,
    );
  }
}

export class VoiceDisabledError extends AppException {
  constructor() {
    super(
      'VOICE_DISABLED',
      'Enviar áudio ainda não está disponível. Por enquanto, escreve o texto.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InvalidAudioError extends AppException {
  constructor(maxBytes: number) {
    super(
      'INVALID_AUDIO',
      'Esse áudio não deu. Manda um MP3, M4A ou AAC de até alguns minutos.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { maxBytes },
    );
  }
}
