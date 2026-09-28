import { subscribeApiClientEvents } from '@english-saas/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';
import { useEffect, useState } from 'react';

import { t } from '../../messages/pt-BR';

const PLAN_LABELS: Record<string, string> = {
  BASE: 'Base',
  PLUS: 'Plus',
};

/**
 * Paywall simples: abre quando qualquer chamada de API devolve 403
 * `PLAN_REQUIRED`. Sem catálogo de planos nem checkout — isso é o F6.
 */
export function Paywall() {
  const [state, setState] = useState<{
    message: string;
    requiredPlan?: string;
  } | null>(null);

  useEffect(() => {
    return subscribeApiClientEvents((event) => {
      if (event.type === 'plan-required') {
        setState({
          message: event.error.message,
          requiredPlan: event.requiredPlan,
        });
      }
    });
  }, []);

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => !open && setState(null)}
    >
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {state?.requiredPlan
            ? `${t('paywall.titlePrefix')} ${PLAN_LABELS[state.requiredPlan] ?? state.requiredPlan}`
            : t('paywall.titleGeneric')}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {state?.message}
        </DialogDescription>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setState(null)}>{t('paywall.dismiss')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
