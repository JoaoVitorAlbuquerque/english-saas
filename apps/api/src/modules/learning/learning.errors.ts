import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do learning. `code` em inglês, `message` em pt-BR. */

/** A tentativa já foi concluída ou largada. */
export class AttemptClosedError extends AppException {
  constructor(status: string) {
    super(
      'ATTEMPT_CLOSED',
      'Esta tentativa já foi encerrada. Comece a lição de novo para continuar.',
      HttpStatus.CONFLICT,
      { status },
    );
  }
}

/** Concluir a prática sem responder as questões dela. */
export class PracticeIncompleteError extends AppException {
  constructor(unansweredItemIds: readonly string[]) {
    super(
      'PRACTICE_INCOMPLETE',
      `Ainda falta responder ${String(unansweredItemIds.length)} questão(ões) desta prática.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { unansweredItemIds },
    );
  }
}

/** Concluir a lição com etapa pendente. */
export class AttemptIncompleteError extends AppException {
  constructor(missingSteps: readonly number[]) {
    super(
      'ATTEMPT_INCOMPLETE',
      `Ainda falta concluir ${String(missingSteps.length)} etapa(s) desta lição.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { missingSteps },
    );
  }
}

/** A resposta não tem o formato do tipo da questão. */
export class InvalidAnswerResponseError extends AppException {
  constructor(reason: string) {
    super('INVALID_ANSWER_RESPONSE', reason, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/** A questão não faz parte da lição desta tentativa. */
export class ItemNotInAttemptError extends AppException {
  constructor() {
    super(
      'ITEM_NOT_IN_ATTEMPT',
      'Esta questão não faz parte da lição que você está fazendo.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
