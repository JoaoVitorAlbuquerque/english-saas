export type GoogleProfile = {
  /** `sub` do Google: identificador estável da conta. */
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export type ExchangeCodeInput = {
  code: string;
  codeVerifier: string;
};

/**
 * Contrato do Google OAuth.
 *
 * Abstrato para o e2e conseguir rodar o fluxo inteiro sem sair para a
 * internet — mesma ideia do `LlmProvider` no módulo 2.
 */
export abstract class GoogleOAuthClient {
  /** Falso quando o client id/secret não estão configurados. */
  abstract get isConfigured(): boolean;

  abstract buildAuthorizationUrl(input: {
    state: string;
    codeChallenge: string;
  }): string;

  abstract exchangeCode(input: ExchangeCodeInput): Promise<GoogleProfile>;
}
