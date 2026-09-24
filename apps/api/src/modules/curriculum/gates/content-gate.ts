/**
 * Ponto de extensão do fluxo editorial.
 *
 * O módulo 4 não pode depender do 5 (ordem da tabela do CLAUDE.md), mas
 * precisa recusar uma aprovação quando a QA achou bloqueador e recusar um
 * publish quando falta áudio. A saída é esta: o contrato mora aqui, o
 * módulo 5 fornece a implementação como provider global, e o módulo 4
 * injeta **opcionalmente**.
 *
 * Sem o módulo 5 carregado, nada muda: a injeção vem `undefined` e o fluxo
 * roda como antes.
 *
 * Efeito colateral (gerar áudio, gerar PDF) **não vem por aqui** — vem por
 * evento. Este contrato é só para travar.
 */
export abstract class ContentGate {
  /** Lance uma `AppException` para recusar a aprovação. */
  abstract assertCanApprove(lessonVersionId: string): Promise<void>;

  /** Lance uma `AppException` para recusar a publicação. */
  abstract assertCanPublish(lessonVersionId: string): Promise<void>;
}
