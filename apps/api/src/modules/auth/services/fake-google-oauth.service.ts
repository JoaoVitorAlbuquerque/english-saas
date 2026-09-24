import { Injectable, Logger } from '@nestjs/common';

import { OAuthFailedError } from '../auth.errors';
import {
  GoogleOAuthClient,
  type ExchangeCodeInput,
  type GoogleProfile,
} from './google-oauth.client';

/**
 * Google falso, para teste e para o ambiente local sem credencial.
 *
 * O e2e registra o perfil que quer receber com `setProfile(code, profile)` e
 * roda o fluxo inteiro sem sair para a internet.
 */
@Injectable()
export class FakeGoogleOAuthService extends GoogleOAuthClient {
  private readonly logger = new Logger(FakeGoogleOAuthService.name);
  private readonly profiles = new Map<string, GoogleProfile>();

  constructor() {
    super();
    this.logger.warn(
      'Usando o cliente Google FAKE — nenhuma chamada real ao Google será feita',
    );
  }

  get isConfigured(): boolean {
    return true;
  }

  buildAuthorizationUrl(input: {
    state: string;
    codeChallenge: string;
  }): string {
    return `https://accounts.google.test/authorize?state=${input.state}&code_challenge=${input.codeChallenge}`;
  }

  setProfile(code: string, profile: GoogleProfile): void {
    this.profiles.set(code, profile);
  }

  reset(): void {
    this.profiles.clear();
  }

  async exchangeCode(input: ExchangeCodeInput): Promise<GoogleProfile> {
    const profile = this.profiles.get(input.code);

    if (profile === undefined) {
      throw new OAuthFailedError('unknown_code');
    }

    return await Promise.resolve(profile);
  }
}
