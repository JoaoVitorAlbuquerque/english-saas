import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/**
 * Trava do fluxo editorial: recusar aprovação com bloqueador de QA e
 * publicação com áudio faltando.
 *
 * Mesmo mecanismo do `AccessPolicy` (token comum, ligação no AppModule,
 * falha fechada), contrato separado: aqui é regra editorial, não plano do
 * aluno. O curriculum (4) injeta; o content-studio (5) implementa.
 *
 * Efeito colateral (gerar áudio, gerar PDF) **não vem por aqui** — vem por
 * evento. Este contrato é só para travar.
 */
export const CONTENT_GATE = Symbol('CONTENT_GATE');

export interface ContentGate {
  /** Lance uma `AppException` para recusar a aprovação. */
  assertCanApprove(lessonVersionId: string): Promise<void>;

  /** Lance uma `AppException` para recusar a publicação. */
  assertCanPublish(lessonVersionId: string): Promise<void>;
}

class ContentGateMissingError extends AppException {
  constructor() {
    super(
      'CONTENT_GATE_MISSING',
      'A revisão editorial não está configurada, então nada pode ser aprovado ou publicado.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Sem o content-studio ligado, nada passa pela revisão — nunca o contrário. */
export class DenyAllContentGate implements ContentGate {
  assertCanApprove(): Promise<void> {
    return Promise.reject(new ContentGateMissingError());
  }

  assertCanPublish(): Promise<void> {
    return Promise.reject(new ContentGateMissingError());
  }
}
