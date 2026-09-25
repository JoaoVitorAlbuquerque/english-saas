import {
  ALLOWED,
  planRequired,
  type AccessDecision,
  type AccessPolicy,
  type RequiredPlan,
} from 'src/common/access/access-policy';

/**
 * Política de acesso explícita dos e2e: libera tudo, a não ser para quem o
 * teste mandar negar. As suítes que não são sobre plano não dependem do
 * billing para abrir a lição do seed; a suíte de acesso usa a real.
 */
export class FakeAccessPolicy implements AccessPolicy {
  private readonly denied = new Map<string, RequiredPlan>();

  deny(userId: string, requiredPlan: RequiredPlan = 'BASE'): void {
    this.denied.set(userId, requiredPlan);
  }

  reset(): void {
    this.denied.clear();
  }

  canAccessLesson(userId: string): Promise<AccessDecision> {
    return Promise.resolve(this.decide(userId));
  }

  canDownloadWorkbook(userId: string): Promise<AccessDecision> {
    return Promise.resolve(this.decide(userId));
  }

  private decide(userId: string): AccessDecision {
    const plan = this.denied.get(userId);
    return plan === undefined ? ALLOWED : planRequired(plan);
  }
}
