import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { EnvService } from 'src/common/config/env.service';
import { ActiveUserId } from 'src/common/decorators/active-user-id.decorator';
import { IsPublic } from 'src/common/decorators/is-public.decorator';
import { ConsentService } from 'src/modules/users/services/consent.service';

import { SessionExpiredError } from '../auth.errors';
import {
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from '../auth.cookies';
import {
  ForgotPasswordDto,
  GoogleCallbackDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SigninDto,
  SignupDto,
  VerifyEmailDto,
} from '../dto/auth.dto';
import { CsrfGuard } from '../guards/csrf.guard';
import { AuthService, type AuthSession } from '../services/auth.service';

/** O que volta no corpo. O refresh token fica só no cookie. */
type SessionResponse = {
  user: AuthSession['user'];
  accessToken: string;
  /** Copie para o header `x-csrf-token` nas chamadas a /auth/refresh e /logout. */
  csrfToken: string;
};

/** Limite apertado nas rotas que aceitam senha ou disparam e-mail. */
const SENSITIVE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly consents: ConsentService,
    private readonly envService: EnvService,
  ) {}

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('signup')
  @ApiOperation({ summary: 'Cria a conta e já abre a sessão' })
  async signup(
    @Body() body: SignupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.authService.signup(body, this.context(request));

    await this.consents.recordSignupConsents(session.user.id, {
      dataPersonalization: body.acceptedDataPersonalization,
      marketing: body.acceptedMarketing,
      ...this.context(request),
    });

    return this.respondWithSession(response, session);
  }

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Entra com e-mail e senha' })
  async signin(
    @Body() body: SigninDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.authService.signin(body, this.context(request));

    return this.respondWithSession(response, session);
  }

  /**
   * Troca o refresh token do cookie por um access token novo.
   *
   * Pública para o guard de JWT (o access token já expirou quando o front
   * chega aqui), mas protegida pelo CSRF, já que depende do cookie.
   */
  @IsPublic()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotaciona a sessão usando o cookie de refresh' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const refreshToken = readRefreshCookie(request.cookies);

    if (refreshToken === undefined) {
      clearAuthCookies(response, this.envService);
      throw new SessionExpiredError(
        'Sua sessão expirou. Entre de novo.',
        'NO_COOKIE',
      );
    }

    try {
      const session = await this.authService.refresh(
        refreshToken,
        this.context(request),
      );

      return this.respondWithSession(response, session);
    } catch (error) {
      // Sessão inválida: o cookie não pode continuar no browser.
      clearAuthCookies(response, this.envService);
      throw error;
    }
  }

  @IsPublic()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra a sessão deste dispositivo' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(readRefreshCookie(request.cookies));
    clearAuthCookies(response, this.envService);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerra a sessão em todos os dispositivos' })
  async logoutAll(
    @ActiveUserId() userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ revoked: number }> {
    const result = await this.authService.logoutAll(userId);
    clearAuthCookies(response, this.envService);

    return result;
  }

  // -------------------------------------------------------------------
  // Verificação de e-mail e senha
  // -------------------------------------------------------------------

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma o e-mail pelo token recebido' })
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<{ verified: true }> {
    return this.authService.verifyEmail(body.token);
  }

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenvia o e-mail de confirmação' })
  async resendVerification(
    @Body() body: ResendVerificationDto,
  ): Promise<{ sent: true }> {
    await this.authService.resendEmailVerification(body.email);

    return { sent: true };
  }

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Envia o link de nova senha. Responde igual exista ou não a conta.',
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<{ sent: true }> {
    await this.authService.forgotPassword(body.email);

    return { sent: true };
  }

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define a nova senha e derruba as sessões' })
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ reset: true }> {
    await this.authService.resetPassword(body);
    clearAuthCookies(response, this.envService);

    return { reset: true };
  }

  // -------------------------------------------------------------------
  // Google
  // -------------------------------------------------------------------

  @IsPublic()
  @Get('google/url')
  @ApiOperation({
    summary: 'URL de autorização do Google. O front redireciona para ela.',
  })
  async googleUrl(): Promise<{ url: string; state: string }> {
    return this.authService.buildGoogleAuthorizationUrl();
  }

  @IsPublic()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Troca o code do Google pela nossa sessão',
  })
  async googleCallback(
    @Body() body: GoogleCallbackDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.authService.signinWithGoogle(
      body,
      this.context(request),
    );

    return this.respondWithSession(response, session);
  }

  // -------------------------------------------------------------------

  private respondWithSession(
    response: Response,
    session: AuthSession,
  ): SessionResponse {
    const csrfToken = setAuthCookies(response, this.envService, {
      refreshToken: session.refreshToken,
      expiresAt: session.refreshTokenExpiresAt,
    });

    return { user: session.user, accessToken: session.accessToken, csrfToken };
  }

  private context(request: Request): { userAgent?: string; ip?: string } {
    return {
      ...(request.headers['user-agent'] === undefined
        ? {}
        : { userAgent: request.headers['user-agent'].slice(0, 255) }),
      ...(request.ip === undefined ? {} : { ip: request.ip }),
    };
  }
}
