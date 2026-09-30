import type { CreditsBalance } from '@english-saas/api-client';
import { Card } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { formatInTimeZone } from '../lib/format-date';

export type CreditsNoticeProps = {
  credits: CreditsBalance;
  cost: number;
  timeZone: string | undefined;
};

/**
 * 402 `INSUFFICIENT_AI_CREDITS`: quanto tem, quanto custa e quando renova —
 * a data exata vem da API (`nextGrantAt`), mostrada no fuso do aluno.
 */
export function CreditsNotice({ credits, cost, timeZone }: CreditsNoticeProps) {
  const isPlus = credits.tier === 'PLUS';

  return (
    <Card role="alert" className="flex flex-col gap-2 border-error/40">
      <p className="font-medium text-ink">{t('credits.insufficientTitle')}</p>
      <p className="text-sm text-muted">
        {t('credits.insufficientBody', { balance: credits.balance, cost })}{' '}
        {t('credits.renews', {
          date: formatInTimeZone(credits.nextGrantAt, timeZone, {
            withTime: true,
          }),
        })}
      </p>
      <Link
        to={isPlus ? '/minha-assinatura' : '/planos'}
        className="text-sm font-medium text-accent underline"
      >
        {isPlus ? t('credits.viewSubscription') : t('credits.viewPlans')}
      </Link>
    </Card>
  );
}
