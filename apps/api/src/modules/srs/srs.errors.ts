import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do srs. `code` em inglês, `message` em pt-BR. */

/** Corpo de ITEM num card de flashcard, ou vice-versa. */
export class ReviewCardKindMismatchError extends AppException {
  constructor(kind: string) {
    super(
      'REVIEW_CARD_KIND_MISMATCH',
      'O formato da resposta não bate com o tipo deste card.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { kind },
    );
  }
}
