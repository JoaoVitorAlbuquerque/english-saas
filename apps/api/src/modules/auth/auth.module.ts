import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';

import { EnvModule } from 'src/common/config/env.module';
import { EnvService } from 'src/common/config/env.service';
import { UsersModule } from 'src/modules/users/users.module';

import { AuthController } from './controllers/auth.controller';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthMailService } from './services/auth-mail.service';
import { AuthService } from './services/auth.service';
import { FakeGoogleOAuthService } from './services/fake-google-oauth.service';
import { GoogleOAuthClient } from './services/google-oauth.client';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { RefreshTokenService } from './services/refresh-token.service';

/**
 * Fake em teste, ou quando não há credencial do Google — assim o ambiente
 * local sobe sem projeto no Google Cloud e o e2e roda o fluxo inteiro sem
 * sair para a internet.
 */
function resolveGoogleClient(
  envService: EnvService,
  real: GoogleOAuthService,
  fake: FakeGoogleOAuthService,
): GoogleOAuthClient {
  if (envService.isTest || !real.isConfigured) {
    if (!envService.isTest) {
      new Logger('AuthModule').warn(
        'GOOGLE_CLIENT_ID/SECRET ausentes — o login com Google usa o cliente fake',
      );
    }

    return fake;
  }

  return real;
}

/**
 * Módulo 3 — auth.
 *
 * Access token de 15 minutos no header; refresh rotativo em cookie httpOnly,
 * protegido por CSRF double-submit. Os guards globais são registrados no
 * `AppModule` — aqui eles só são fornecidos.
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService): JwtModuleOptions => ({
        secret: envService.get('JWT_SECRET'),
        // O tipo do jsonwebtoken é um template literal ('15m', '7d', ...);
        // o env é string livre, então a conversão acontece aqui.
        signOptions: {
          expiresIn: envService.get(
            'JWT_EXPIRES_IN',
          ) as JwtModuleOptions['signOptions'] extends { expiresIn?: infer T }
            ? T
            : never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    AuthMailService,
    OAuthStateService,
    GoogleOAuthService,
    FakeGoogleOAuthService,
    {
      provide: GoogleOAuthClient,
      inject: [EnvService, GoogleOAuthService, FakeGoogleOAuthService],
      useFactory: resolveGoogleClient,
    },
    JwtAuthGuard,
    RolesGuard,
    CsrfGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
