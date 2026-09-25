import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do assessment. `code` em inglês, `message` em pt-BR. */

export class PlacementTooSoonError extends AppException {
  constructor(nextAvailableAt: Date) {
    super(
      'PLACEMENT_TOO_SOON',
      `Você fez o teste de nível há pouco tempo. Dá para refazer a partir de ${nextAvailableAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      HttpStatus.CONFLICT,
      { nextAvailableAt: nextAvailableAt.toISOString() },
    );
  }
}

export class AssessmentClosedError extends AppException {
  constructor(status: string) {
    super(
      'ASSESSMENT_CLOSED',
      'Esta prova já foi encerrada.',
      HttpStatus.CONFLICT,
      { status },
    );
  }
}

/** Resposta a uma questão que não é a da vez. */
export class ItemNotCurrentError extends AppException {
  constructor(currentItemId: string | null) {
    super(
      'ITEM_NOT_CURRENT',
      'Esta não é a questão da vez. Responda a questão que está na tela.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { currentItemId },
    );
  }
}

export class NoItemsAvailableError extends AppException {
  constructor() {
    super(
      'NO_ITEMS_AVAILABLE',
      'Ainda não temos questões suficientes para montar esta prova.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
