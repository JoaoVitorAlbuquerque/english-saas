import { subscribeApiClientEvents } from '@english-saas/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../messages/pt-BR';

const PLAN_LABELS: Record<string, string> = {
  BASE: 'Base',
  PLUS: 'Plus',
};

/**
 * Paywall global: abre quando qualquer chamada de API devolve 403
 * `PLAN_REQUIRED`, ou quando alguma tela chama `openPaywall` direto (cadeado
 * do catálogo, sem passar por uma chamada de verdade).
 */
export function Paywall() {
  const navigate = useNavigate();
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

  function close() {
    setState(null);
  }

  function viewPlans() {
    close();
    navigate('/planos');
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {state?.requiredPlan
            ? `${t('paywall.titlePrefix')} ${PLAN_LABELS[state.requiredPlan] ?? state.requiredPlan}`
            : t('paywall.titleGeneric')}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {state?.message}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t('paywall.dismiss')}
          </Button>
          <Button onClick={viewPlans}>{t('paywall.viewPlans')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
