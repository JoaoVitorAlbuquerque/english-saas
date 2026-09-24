import { Injectable } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { REQUIRED_CONSENTS } from '@english-saas/shared';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export type ConsentContext = {
  ip?: string | undefined;
  userAgent?: string | undefined;
};

export type ConsentView = {
  type: ConsentType;
  version: string;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  /** Falso quando o aluno aceitou uma versão antiga do documento. */
  upToDate: boolean;
};

/**
 * Registro de consentimentos LGPD.
 *
 * Cada aceite guarda a **versão do documento** e a data. Quando publicamos
 * uma versão nova, o aceite antigo continua no histórico e o aluno aparece
 * como pendente — nunca reescrevemos um consentimento já dado.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  /** Versão corrente de cada documento. */
  currentVersion(type: ConsentType): string {
    switch (type) {
      case ConsentType.TERMS:
        return this.envService.get('TERMS_VERSION');
      case ConsentType.PRIVACY_POLICY:
      case ConsentType.DATA_PERSONALIZATION:
      case ConsentType.MARKETING:
        return this.envService.get('PRIVACY_POLICY_VERSION');
    }
  }

  async recordSignupConsents(
    userId: string,
    input: ConsentContext & {
      dataPersonalization: boolean;
      marketing: boolean;
    },
  ): Promise<void> {
    await this.record(userId, ConsentType.TERMS, true, input);
    await this.record(userId, ConsentType.PRIVACY_POLICY, true, input);
    await this.record(
      userId,
      ConsentType.DATA_PERSONALIZATION,
      input.dataPersonalization,
      input,
    );
    await this.record(userId, ConsentType.MARKETING, input.marketing, input);
  }

  async record(
    userId: string,
    type: ConsentType,
    granted: boolean,
    context: ConsentContext = {},
  ): Promise<void> {
    const version = this.currentVersion(type);
    const now = new Date();

    await this.prisma.consent.upsert({
      where: { userId_type_version: { userId, type, version } },
      create: {
        userId,
        type,
        version,
        granted,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
      update: {
        granted,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
    });
  }

  /** Estado atual de cada tipo, com a versão mais recente que o aluno viu. */
  async listForUser(userId: string): Promise<ConsentView[]> {
    const rows = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return Object.values(ConsentType).map((type) => {
      const latest = rows.find((row) => row.type === type);
      const current = this.currentVersion(type);

      return {
        type,
        version: latest?.version ?? current,
        granted: latest?.granted ?? false,
        grantedAt: latest?.grantedAt ?? null,
        revokedAt: latest?.revokedAt ?? null,
        upToDate: latest !== undefined && latest.version === current,
      };
    });
  }

  /** Aceitou a versão corrente dos documentos obrigatórios? */
  async hasRequiredConsents(userId: string): Promise<boolean> {
    const views = await this.listForUser(userId);

    return REQUIRED_CONSENTS.every((required) =>
      views.some(
        (view) => view.type === required && view.granted && view.upToDate,
      ),
    );
  }
}
