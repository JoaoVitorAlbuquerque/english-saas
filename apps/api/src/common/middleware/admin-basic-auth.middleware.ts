import basicAuth from 'express-basic-auth';
import type { RequestHandler } from 'express';

import type { EnvService } from '../config/env.service';

/**
 * Basic auth das rotas administrativas (`/admin/*`).
 *
 * Proteção provisória, enquanto não existe autenticação. Quando o módulo 3
 * (`auth`) chegar, troque isto por um guard de papel de administrador.
 */
export function adminBasicAuth(envService: EnvService): RequestHandler {
  return basicAuth({
    challenge: true,
    realm: 'english-saas admin',
    users: {
      [envService.get('BULL_BOARD_USER')]: envService.get(
        'BULL_BOARD_PASSWORD',
      ),
    },
  });
}
