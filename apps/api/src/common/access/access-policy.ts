import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/**
 * Quem pode abrir o quê, pelo plano do aluno.
 *
 * O contrato mora aqui (comum) para o curriculum (4) e o learning (6)
 * perguntarem sem importar o billing (11). Quem implementa é o billing; o
 * AppModule faz a ligação por `AccessModule.forRoot`. Sem ligação, vale o
 * `DenyAllAccessPolicy`: falha fechada.
 */
export const ACCESS_POLICY = Symbol('ACCESS_POLICY');

export type RequiredPlan = 'BASE' | 'PLUS';

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'PLAN_REQUIRED'; requiredPlan: RequiredPlan };

export type LessonAccessInput = {
  lessonId: string;
  unitId: string;
  cefrLevel: string;
  /**
   * Posição da unidade entre as publicadas do nível, a partir de 0. Quem
   * sabe a ordem é o curriculum — assim a política não precisa ler o
   * catálogo.
   */
  unitPosition: number;
};

export interface AccessPolicy {
  canAccessLesson(
    userId: string,
    input: LessonAccessInput,
  ): Promise<AccessDecision>;
  canDownloadWorkbook(userId: string, unitId: string): Promise<AccessDecision>;
}

export const ALLOWED: AccessDecision = { allowed: true };

export function planRequired(requiredPlan: RequiredPlan): AccessDecision {
  return { allowed: false, reason: 'PLAN_REQUIRED', requiredPlan };
}

/** Sem política ligada, ninguém abre nada — nunca o contrário. */
export class DenyAllAccessPolicy implements AccessPolicy {
  canAccessLesson(): Promise<AccessDecision> {
    return Promise.resolve(planRequired('BASE'));
  }

  canDownloadWorkbook(): Promise<AccessDecision> {
    return Promise.resolve(planRequired('BASE'));
  }
}

export class PlanRequiredError extends AppException {
  constructor(requiredPlan: RequiredPlan) {
    super(
      'PLAN_REQUIRED',
      requiredPlan === 'PLUS'
        ? 'Esse conteúdo faz parte do plano Plus. Dá uma olhada nos planos para liberar.'
        : 'Esse conteúdo faz parte dos planos pagos. Dá uma olhada nos planos para liberar.',
      HttpStatus.FORBIDDEN,
      { requiredPlan },
    );
  }
}

/** Lança 403 `PLAN_REQUIRED` quando a decisão nega. */
export function assertAllowed(decision: AccessDecision): void {
  if (!decision.allowed) {
    throw new PlanRequiredError(decision.requiredPlan);
  }
}
