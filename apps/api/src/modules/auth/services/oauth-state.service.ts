import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from 'src/infra/redis/redis.service';

/**
 * Guarda `state` e `code_verifier` do fluxo PKCE, no Redis.
 *
 * O `state` volta pelo browser; o `code_verifier` nunca sai daqui. Uso único
 * e TTL curto: o aluno tem 10 minutos para concluir o login no Google.
 */
@Injectable()
export class OAuthStateService {
  private static readonly TTL_SECONDS = 600;
  private static readonly PREFIX = 'oauth:google:state:';

  constructor(private readonly redis: RedisService) {}

  /** Cria o par state/verifier e devolve o challenge para a URL do Google. */
  async create(): Promise<{ state: string; codeChallenge: string }> {
    const state = randomBytes(24).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');

    await this.redis.client.set(
      `${OAuthStateService.PREFIX}${state}`,
      codeVerifier,
      'EX',
      OAuthStateService.TTL_SECONDS,
    );

    return {
      state,
      codeChallenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
    };
  }

  /**
   * Resgata o verifier e apaga o state na mesma operação.
   *
   * `getdel` é atômico: dois callbacks com o mesmo state, só um passa — o que
   * fecha a porta para replay.
   */
  async consume(state: string): Promise<string | null> {
    return this.redis.client.getdel(`${OAuthStateService.PREFIX}${state}`);
  }
}
