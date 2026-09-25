import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do planner. `code` em inglês, `message` em pt-BR. */

/** Não existe "agenda do passado" — ela é gerada sob demanda, pro dia de hoje. */
export class AgendaDateMustBeTodayError extends AppException {
  constructor(today: string) {
    super(
      'AGENDA_DATE_MUST_BE_TODAY',
      `A agenda é sempre a de hoje (${today}) no seu fuso.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { today },
    );
  }
}
