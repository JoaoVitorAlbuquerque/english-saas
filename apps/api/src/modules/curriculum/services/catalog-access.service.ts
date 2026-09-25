import { Inject, Injectable } from '@nestjs/common';
import type { CefrLevel } from '@prisma/client';

import {
  ACCESS_POLICY,
  assertAllowed,
  planRequired,
  type AccessDecision,
  type AccessPolicy,
  type RequiredPlan,
} from 'src/common/access/access-policy';

import { CatalogService, type CatalogLesson } from './catalog.service';

export type LockInfo = { locked: boolean; requiredPlan: RequiredPlan | null };

function lockInfo(decision: AccessDecision): LockInfo {
  return decision.allowed
    ? { locked: false, requiredPlan: null }
    : { locked: true, requiredPlan: decision.requiredPlan };
}

/**
 * O catálogo visto por um aluno: o que o plano dele libera.
 *
 * Quem decide é a `AccessPolicy` (implementada pelo billing, ligada no
 * AppModule) — o módulo 4 só pergunta. A decisão entra **depois** do cache
 * do catálogo: o cache é compartilhado e nunca guarda trava de ninguém.
 *
 * Listagem não esconde nada: diz `locked` e `requiredPlan`. O que trava é
 * abrir a lição (etapas e mídia assinada) e baixar a apostila.
 */
@Injectable()
export class CatalogAccessService {
  constructor(
    private readonly catalog: CatalogService,
    @Inject(ACCESS_POLICY) private readonly policy: AccessPolicy,
  ) {}

  async lesson(userId: string, slug: string): Promise<CatalogLesson> {
    const lesson = await this.catalog.loadLesson(slug);
    const placement = (await this.catalog.unitPositions([lesson.unit.id])).get(
      lesson.unit.id,
    );

    assertAllowed(
      await this.policy.canAccessLesson(userId, {
        lessonId: lesson.id,
        unitId: lesson.unit.id,
        cefrLevel: lesson.level.cefrLevel,
        unitPosition: placement?.position ?? Number.MAX_SAFE_INTEGER,
      }),
    );

    return this.catalog.signLesson(lesson);
  }

  /** Para o player (6) e o tutor (12): 403 `PLAN_REQUIRED` se o plano não abre. */
  async assertLesson(userId: string, lessonId: string): Promise<void> {
    const placement = await this.catalog.lessonPlacement(lessonId);
    assertAllowed(await this.policy.canAccessLesson(userId, placement));
  }

  async units(
    userId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      level?: CefrLevel | undefined;
    },
  ) {
    const page = await this.catalog.listUnits(query);
    return { ...page, data: await this.decorateUnits(userId, page.data) };
  }

  async unit(userId: string, slug: string) {
    const [unit] = await this.decorateUnits(userId, [
      await this.catalog.findUnitBySlug(slug),
    ]);
    return unit;
  }

  async workbooks(userId: string, query: { level?: CefrLevel | undefined }) {
    const workbooks = await this.catalog.listWorkbooks(query);
    const decisions = await this.workbookDecisions(
      userId,
      workbooks.map((workbook) => workbook.unit.id),
    );

    return workbooks.map((workbook) => {
      const lock = lockInfo(
        decisions.get(workbook.unit.id) ?? planRequired('BASE'),
      );
      // Travada, a apostila aparece na lista mas sem o link assinado.
      return { ...workbook, ...lock, file: lock.locked ? null : workbook.file };
    });
  }

  async workbookFile(userId: string, workbookId: string) {
    const workbook = await this.catalog.findWorkbook(workbookId);
    assertAllowed(
      await this.policy.canDownloadWorkbook(userId, workbook.unitId),
    );

    return {
      id: workbook.id,
      file: await this.catalog.signAsset(workbook.asset),
    };
  }

  /** A regra é por unidade: uma decisão por unidade vale para as lições dela. */
  private async decorateUnits<
    T extends {
      id: string;
      level: { cefrLevel: CefrLevel };
      lessons: { id: string }[];
    },
  >(userId: string, units: T[]) {
    const positions = await this.catalog.unitPositions(
      units.map((unit) => unit.id),
    );

    return Promise.all(
      units.map(async (unit) => {
        const lock = lockInfo(
          await this.policy.canAccessLesson(userId, {
            lessonId: unit.lessons[0]?.id ?? '',
            unitId: unit.id,
            cefrLevel: unit.level.cefrLevel,
            unitPosition:
              positions.get(unit.id)?.position ?? Number.MAX_SAFE_INTEGER,
          }),
        );

        return {
          ...unit,
          ...lock,
          lessons: unit.lessons.map((lesson) => ({ ...lesson, ...lock })),
        };
      }),
    );
  }

  private async workbookDecisions(
    userId: string,
    unitIds: string[],
  ): Promise<Map<string, AccessDecision>> {
    const entries = await Promise.all(
      [...new Set(unitIds)].map(
        async (unitId) =>
          [
            unitId,
            await this.policy.canDownloadWorkbook(userId, unitId),
          ] as const,
      ),
    );

    return new Map(entries);
  }
}
