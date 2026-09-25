import type { CefrLevel } from '@prisma/client';

/**
 * Gancho da parte de escrita do nivelamento.
 *
 * A escrita é uma pergunta aberta, e quem corrige texto livre é o tutor
 * (12) — que vem depois deste módulo e não pode ser importado daqui. O
 * contrato mora no 8; o 12 fornece a implementação como provider global,
 * e o `PlacementService` injeta com `@Optional()`. (As travas de conteúdo
 * migraram para tokens com falha fechada em `src/common/access`; aqui a
 * ausência é legítima — sem tutor, o nivelamento só não tem escrita.)
 *
 * Sem implementação, o nivelamento termina sem escrita
 * (`writingStatus = NOT_OFFERED`) e o resultado não depende dela.
 */
export abstract class WritingAssessor {
  /**
   * Oferece a pergunta aberta ao aluno depois da parte objetiva.
   * Devolve `true` se a escrita ficou pendente de correção.
   */
  abstract requestPlacementWriting(input: {
    userId: string;
    placementId: string;
    level: CefrLevel;
  }): Promise<boolean>;
}
