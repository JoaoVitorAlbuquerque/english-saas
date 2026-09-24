import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenPurpose, OAuthProvider, type Role } from '@prisma/client';
import { compare, hash } from 'bcryptjs';

import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  AccountDeletedError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidTokenError,
  OAuthFailedError,
  OAuthNotConfiguredError,
  PasswordLoginUnavailableError,
  WeakPasswordError,
} from '../auth.errors';
import { checkPassword, normalizeEmail } from '../domain/password';
import { isSingleUseTokenUsable } from '../domain/refresh-token';
import {
  EMAIL_VERIFICATION_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  expiresIn,
  generateOpaqueToken,
  hashToken,
} from '../domain/tokens';
import { AuthMailService } from './auth-mail.service';
import { GoogleOAuthClient } from './google-oauth.client';
import { OAuthStateService } from './oauth-state.service';
import {
  RefreshTokenService,
  type SessionContext,
} from './refresh-token.service';

const BCRYPT_ROUNDS = 12;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerifiedAt: Date | null;
};

export type AuthSession = {
  user: AuthenticatedUser;
  accessToken: string;
  /** Fica só no cookie httpOnly — nunca no corpo da resposta. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly authMail: AuthMailService,
    private readonly google: GoogleOAuthClient,
    private readonly oauthState: OAuthStateService,
    private readonly events: EventBusService,
  ) {}

  // ---------------------------------------------------------------------
  // Cadastro e login por senha
  // ---------------------------------------------------------------------

  async signup(
    input: { name: string; email: string; password: string },
    context: SessionContext = {},
  ): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const passwordCheck = checkPassword(input.password, { email });

    if (!passwordCheck.valid) {
      throw new WeakPasswordError(passwordCheck.messages);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing !== null) {
      throw new EmailAlreadyInUseError();
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        passwordHash: await hash(input.password, BCRYPT_ROUNDS),
        // O perfil nasce junto, vazio: o onboarding só preenche.
        profile: { create: {} },
      },
      select: this.userSelect(),
    });

    await this.sendEmailVerification(user.id);

    this.events.emit(
      'user.registered',
      { userId: user.id, email: user.email, via: 'password' },
      { userId: user.id },
    );

    return this.startSession(user, context);
  }

  async signin(
    input: { email: string; password: string },
    context: SessionContext = {},
  ): Promise<AuthSession> {
    const email = normalizeEmail(input.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...this.userSelect(), passwordHash: true, deletedAt: true },
    });

    if (user === null) {
      // Gasta o mesmo tempo de um bcrypt real, para não dar para descobrir
      // por timing se o e-mail existe.
      await hash(input.password, BCRYPT_ROUNDS);
      throw new InvalidCredentialsError();
    }

    if (user.deletedAt !== null) {
      throw new AccountDeletedError();
    }

    if (user.passwordHash === null) {
      throw new PasswordLoginUnavailableError();
    }

    if (!(await compare(input.password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    return this.startSession(user, context);
  }

  // ---------------------------------------------------------------------
  // Sessão
  // ---------------------------------------------------------------------

  async refresh(
    presentedToken: string,
    context: SessionContext = {},
  ): Promise<AuthSession> {
    const rotated = await this.refreshTokens.rotate(presentedToken, context);

    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: { ...this.userSelect(), deletedAt: true },
    });

    if (user === null || user.deletedAt !== null) {
      await this.refreshTokens.revokeFamily(rotated.family);
      throw new AccountDeletedError();
    }

    return {
      user: this.toAuthenticatedUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: rotated.token,
      refreshTokenExpiresAt: rotated.expiresAt,
    };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken !== undefined) {
      await this.refreshTokens.revokeByToken(presentedToken);
    }
  }

  async logoutAll(userId: string): Promise<{ revoked: number }> {
    return { revoked: await this.refreshTokens.revokeAllForUser(userId) };
  }

  // ---------------------------------------------------------------------
  // Verificação de e-mail e recuperação de senha
  // ---------------------------------------------------------------------

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    if (user === null || user.emailVerifiedAt !== null) {
      return;
    }

    const token = await this.issueAuthToken(
      user.id,
      AuthTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_MINUTES,
    );

    await this.authMail.sendEmailVerification({
      to: user.email,
      name: user.name,
      token,
    });
  }

  /**
   * Reenvio pedido pelo aluno, que informa o e-mail em vez do id.
   * Silencioso quando a conta não existe: não confirmamos cadastros.
   */
  async resendEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, deletedAt: true },
    });

    if (user === null || user.deletedAt !== null) {
      return;
    }

    await this.sendEmailVerification(user.id);
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const record = await this.consumeAuthToken(
      token,
      AuthTokenPurpose.EMAIL_VERIFICATION,
    );

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });

    return { verified: true };
  }

  /**
   * Sempre responde igual, exista ou não a conta: descobrir quais e-mails
   * estão cadastrados não pode ser um efeito colateral desta rota.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, name: true, deletedAt: true },
    });

    if (user === null || user.deletedAt !== null) {
      return;
    }

    const token = await this.issueAuthToken(
      user.id,
      AuthTokenPurpose.PASSWORD_RESET,
      PASSWORD_RESET_TTL_MINUTES,
    );

    await this.authMail.sendPasswordReset({
      to: user.email,
      name: user.name,
      token,
    });
  }

  async resetPassword(input: {
    token: string;
    password: string;
  }): Promise<void> {
    const record = await this.consumeAuthToken(
      input.token,
      AuthTokenPurpose.PASSWORD_RESET,
    );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
      select: { email: true },
    });

    const passwordCheck = checkPassword(input.password, { email: user.email });

    if (!passwordCheck.valid) {
      throw new WeakPasswordError(passwordCheck.messages);
    }

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hash(input.password, BCRYPT_ROUNDS) },
    });

    // Trocar a senha derruba todas as sessões: é o ponto de uma troca.
    await this.refreshTokens.revokeAllForUser(record.userId);
  }

  // ---------------------------------------------------------------------
  // Google
  // ---------------------------------------------------------------------

  async buildGoogleAuthorizationUrl(): Promise<{
    url: string;
    state: string;
  }> {
    if (!this.google.isConfigured) {
      throw new OAuthNotConfiguredError();
    }

    const { state, codeChallenge } = await this.oauthState.create();

    return {
      url: this.google.buildAuthorizationUrl({ state, codeChallenge }),
      state,
    };
  }

  async signinWithGoogle(
    input: { code: string; state: string },
    context: SessionContext = {},
  ): Promise<AuthSession> {
    const codeVerifier = await this.oauthState.consume(input.state);

    if (codeVerifier === null) {
      throw new OAuthFailedError('unknown_or_expired_state');
    }

    const profile = await this.google.exchangeCode({
      code: input.code,
      codeVerifier,
    });

    if (!profile.emailVerified) {
      throw new OAuthFailedError('email_not_verified');
    }

    const user = await this.linkOrCreateGoogleUser(profile);

    return this.startSession(user, context);
  }

  private async linkOrCreateGoogleUser(profile: {
    providerAccountId: string;
    email: string;
    name: string;
  }): Promise<AuthenticatedUser & { deletedAt?: Date | null }> {
    const email = normalizeEmail(profile.email);

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
        },
      },
      select: { user: { select: { ...this.userSelect(), deletedAt: true } } },
    });

    if (linked !== null) {
      if (linked.user.deletedAt !== null) {
        throw new AccountDeletedError();
      }

      return linked.user;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { ...this.userSelect(), deletedAt: true },
    });

    // Conta criada antes por e-mail/senha: liga o Google nela em vez de
    // criar uma segunda conta para a mesma pessoa.
    if (existing !== null) {
      if (existing.deletedAt !== null) {
        throw new AccountDeletedError();
      }

      await this.prisma.oAuthAccount.create({
        data: {
          userId: existing.id,
          provider: OAuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
          email,
        },
      });

      // Quem entra pelo Google teve o e-mail confirmado por ele.
      if (existing.emailVerifiedAt === null) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: new Date() },
        });
      }

      return existing;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name: profile.name.trim(),
        emailVerifiedAt: new Date(),
        profile: { create: {} },
        oauthAccounts: {
          create: {
            provider: OAuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
            email,
          },
        },
      },
      select: this.userSelect(),
    });

    this.events.emit(
      'user.registered',
      { userId: created.id, email: created.email, via: 'google' },
      { userId: created.id },
    );

    return created;
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  private async startSession(
    user: AuthenticatedUser,
    context: SessionContext,
  ): Promise<AuthSession> {
    const issued = await this.refreshTokens.issue(user.id, context);

    return {
      user: this.toAuthenticatedUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: issued.token,
      refreshTokenExpiresAt: issued.expiresAt,
    };
  }

  private signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // A validade padrão vem do JwtModule; assinar sem override evita a
    // conversão do tipo template literal do jsonwebtoken em cada chamada.
    return this.jwt.signAsync(payload);
  }

  private async issueAuthToken(
    userId: string,
    purpose: AuthTokenPurpose,
    ttlMinutes: number,
  ): Promise<string> {
    // Um pedido novo invalida os anteriores do mesmo tipo.
    await this.prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateOpaqueToken();

    await this.prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: expiresIn(new Date(), ttlMinutes),
      },
    });

    return token;
  }

  private async consumeAuthToken(
    token: string,
    purpose: AuthTokenPurpose,
  ): Promise<{ userId: string }> {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        userId: true,
        purpose: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (record === null || record.purpose !== purpose) {
      throw new InvalidTokenError();
    }

    if (!isSingleUseTokenUsable(record, new Date())) {
      throw new InvalidTokenError();
    }

    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { userId: record.userId };
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
    } as const;
  }

  private toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
