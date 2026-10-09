import { Badge } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { Section } from '../../components/Section';
import { formatDateTime } from '../../lib/labels';
import { tierLabel } from '../../lib/plan-name';
import type { StudentProfileView } from '../useStudentProfileController';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento atrasado',
  CANCELED: 'Cancelada',
  EXPIRED: 'Encerrada',
};

const METHOD_LABELS: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de crédito',
};

export function SubscriptionSection({
  subscription,
}: {
  subscription: StudentProfileView['subscription'];
}) {
  const overview = subscription.data;
  const detail = overview?.subscription ?? null;

  return (
    <Section
      id="student-subscription"
      title={t('student.subscription.title')}
      isLoading={subscription.isLoading}
      error={subscription.error}
      onRetry={subscription.retry}
    >
      {overview ? (
        <div className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted">{t('student.subscription.tier')}</span>
            <Badge tone={overview.tier === 'FREE' ? 'muted' : 'accent'}>
              {tierLabel(overview.tier) ?? overview.tier}
            </Badge>
          </p>
          <p className="text-muted">{overview.message}</p>

          {detail === null ? (
            <p className="text-muted">{t('student.subscription.none')}</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">
                  {t('student.subscription.status')}
                </dt>
                <dd className="text-ink">
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  {t('student.subscription.price')}
                </dt>
                <dd className="text-ink">{detail.priceLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  {t('student.subscription.method')}
                </dt>
                <dd className="text-ink">
                  {METHOD_LABELS[detail.paymentMethod] ?? detail.paymentMethod}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  {t('student.subscription.accessUntil')}
                </dt>
                <dd className="text-ink">
                  {detail.accessUntil === null
                    ? '—'
                    : formatDateTime(detail.accessUntil)}
                </dd>
              </div>
              {detail.canceledAt ? (
                <div>
                  <dt className="text-xs text-muted">
                    {t('student.subscription.canceledAt')}
                  </dt>
                  <dd className="text-ink">
                    {formatDateTime(detail.canceledAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      ) : null}
    </Section>
  );
}
