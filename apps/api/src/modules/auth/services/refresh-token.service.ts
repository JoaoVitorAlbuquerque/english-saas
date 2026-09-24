import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import { SessionExpiredError } from '../auth.errors';
import {
  REFRESH_REJECT_MESSAGES,
  decideRefresh,
  refreshTokenExpiresAt,
} from '../domain/refresh-token';
import { generateOpaqueToken, hashToken } from '../domain/tokens';

export type SessionContext = {
  userAgent?: string | undefined;
  ip?: string | undefined;
};

export type IssuedRefreshToken = {
  token: string;
  expiresAt: Date;
  family: string;
};

/**
 * Ciclo de vida do refresh token.
 *
 * Guardamos só o hash. Cada uso queima o token e emite outro na mesma
 * família; um token já rotacionado reaparecendo derruba a família inteira.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  /** Primeira emissão da sessão: abre uma família nova. */
  async issue(
    userId: string,
    context: SessionContext = {},
    family: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken();
    const expiresAt = refreshTokenExpiresAt(
      new Date(),
      this.envService.get('REFRESH_TOKEN_TTL_DAYS'),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        family,
        expiresAt,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
      },
    });

    return { token, expiresAt, family };
  }

  /**
   * Troca o token apresentado por um novo.
   *
   * Roda numa transação: marcar o antigo como substituído e criar o novo tem
   * que acontecer junto, senão uma corrida deixaria dois tokens válidos.
   */
  async rotate(
    presentedToken: string,
    context: SessionContext = {},
  ): Promise<{ userId: string } & IssuedRefreshToken> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      select: {
        id: true,
        userId: true,
        family: true,
        expiresAt: true,
        revokedAt: true,
        replacedById: true,
      },
    });

    const decision = decideRefresh(stored, new Date());

    if (decision.action === 'reject') {
      if (decision.reason === 'REUSED' && decision.family !== undefined) {
        this.logger.warn(
          { family: decision.family },
          'Refresh token reutilizado — revogando a família inteira',
        );
        await this.revokeFamily(decision.family);
      }

      throw new SessionExpiredError(
        REFRESH_REJECT_MESSAGES[decision.reason],
        decision.reason,
      );
    }

    const token = generateOpaqueToken();
    const expiresAt = refreshTokenExpiresAt(
      new Date(),
      this.envService.get('REFRESH_TOKEN_TTL_DAYS'),
    );

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: decision.userId,
          tokenHash: hashToken(token),
          family: decision.family,
          expiresAt,
          userAgent: context.userAgent ?? null,
          ip: context.ip ?? null,
        },
        select: { id: true },
      });

      await tx.refreshToken.update({
        where: { id: decision.tokenId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
    });

    return {
      userId: decision.userId,
      token,
      expiresAt,
      family: decision.family,
    };
  }

  /** Logout: derruba só a sessão deste dispositivo (a família dele). */
  async revokeByToken(presentedToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      select: { family: true },
    });

    if (stored !== null) {
      await this.revokeFamily(stored.family);
    }
  }

  async revokeFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Derruba todas as sessões do usuário, em todos os dispositivos. */
  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return count;
  }

  /** Limpeza de tokens vencidos. Chamado pelo job diário. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    return count;
  }
}
