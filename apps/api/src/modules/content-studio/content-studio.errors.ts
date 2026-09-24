import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

import type { QaWarning } from './domain/qa-report';
import type { AudioTarget } from './domain/tts-plan';

/** Erros do content-studio. `code` em inglês, `message` em pt-BR. */

/** A QA achou bloqueador — a versão não pode ser aprovada assim. */
export class QaBlockersError extends AppException {
  constructor(warnings: readonly QaWarning[]) {
    super(
      'QA_BLOCKERS',
      `A revisão automática encontrou ${String(warnings.length)} problema(s) que precisam ser corrigidos antes de aprovar.`,
      HttpStatus.CONFLICT,
      {
        blockers: warnings.map((warning) => ({
          code: warning.code,
          message: warning.message,
          path: warning.path ?? null,
        })),
      },
    );
  }
}

/** Falta áudio. Publicar assim deixaria a lição muda para o aluno. */
export class MissingAudioError extends AppException {
  constructor(targets: readonly AudioTarget[]) {
    super(
      'MISSING_AUDIO',
      `${String(targets.length)} trecho(s) ainda estão sem áudio. Gere a narração antes de publicar.`,
      HttpStatus.CONFLICT,
      { missing: targets.map((target) => target.ref) },
    );
  }
}

/** O rascunho pediu algo que não dá para atender. */
export class DraftRequestError extends AppException {
  constructor(message: string, details?: unknown) {
    super(
      'DRAFT_REQUEST_INVALID',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class DraftNotReadyError extends AppException {
  constructor(status: string) {
    super(
      'DRAFT_NOT_READY',
      `Este rascunho está em "${status}" e ainda não pode ser usado.`,
      HttpStatus.CONFLICT,
      { status },
    );
  }
}

export class TtsTextTooLongError extends AppException {
  constructor(limit: number, length: number) {
    super(
      'TTS_TEXT_TOO_LONG',
      'Um trecho é longo demais para virar áudio de uma vez.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { limit, length },
    );
  }
}
