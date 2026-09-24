import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { OAuthFailedError, OAuthNotConfiguredError } from '../auth.errors';
import {
  GoogleOAuthClient,
  type ExchangeCodeInput,
  type GoogleProfile,
} from './google-oauth.client';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenClaims = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  aud?: string;
};

/**
 * Cliente real do Google OAuth 2.0 (Authorization Code + PKCE).
 *
 * O `code_verifier` fica no servidor: somos cliente confidencial (temos o
 * secret), então guardar o verifier no Redis é mais seguro do que passá-lo
 * pelo browser. O PKCE continua valendo como defesa contra interceptação do
 * `code`.
 */
@Injectable()
export class GoogleOAuthService extends GoogleOAuthClient {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly envService: EnvService) {
    super();
  }

  get isConfigured(): boolean {
    return (
      this.envService.has('GOOGLE_CLIENT_ID') &&
      this.envService.has('GOOGLE_CLIENT_SECRET')
    );
  }

  buildAuthorizationUrl(input: {
    state: string;
    codeChallenge: string;
  }): string {
    const clientId = this.envService.get('GOOGLE_CLIENT_ID');

    if (clientId === undefined) {
      throw new OAuthNotConfiguredError();
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.envService.get('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account',
    });

    return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<GoogleProfile> {
    const clientId = this.envService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.envService.get('GOOGLE_CLIENT_SECRET');

    if (clientId === undefined || clientSecret === undefined) {
      throw new OAuthNotConfiguredError();
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.envService.get('GOOGLE_REDIRECT_URI'),
      }),
    });

    const body = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || body.id_token === undefined) {
      this.logger.warn(
        { status: response.status, reason: body.error },
        'Troca do código do Google falhou',
      );
      throw new OAuthFailedError(
        body.error ?? `http_${String(response.status)}`,
      );
    }

    return this.readIdToken(body.id_token, clientId);
  }

  /**
   * Lê as claims do `id_token`.
   *
   * A assinatura não é verificada aqui porque o token veio **direto** do
   * endpoint do Google, sobre TLS — é o caso em que a própria documentação do
   * Google dispensa a validação.
   * https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo
   *
   * O `aud` continua conferido: barra um token emitido para outro cliente.
   */
  private readIdToken(idToken: string, clientId: string): GoogleProfile {
    const payload = idToken.split('.')[1];

    if (payload === undefined) {
      throw new OAuthFailedError('malformed_id_token');
    }

    let claims: GoogleIdTokenClaims;

    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as GoogleIdTokenClaims;
    } catch {
      throw new OAuthFailedError('unreadable_id_token');
    }

    if (claims.aud !== clientId) {
      throw new OAuthFailedError('audience_mismatch');
    }

    if (claims.sub === undefined || claims.email === undefined) {
      throw new OAuthFailedError('missing_claims');
    }

    return {
      providerAccountId: claims.sub,
      email: claims.email,
      emailVerified:
        claims.email_verified === true || claims.email_verified === 'true',
      name: claims.name ?? claims.email.split('@')[0] ?? 'Aluno',
    };
  }
}
