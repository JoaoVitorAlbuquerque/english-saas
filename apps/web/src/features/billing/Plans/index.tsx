import {
  ErrorState,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { PlanCard } from './PlanCard';
import { usePlansController } from './usePlansController';

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim, em um clique, a qualquer momento. O acesso do plano pago continua até o fim do período que você já pagou — nada é cobrado de novo depois disso.',
  },
  {
    question: 'Quais formas de pagamento vocês aceitam?',
    answer: 'Pix, boleto e cartão de crédito.',
  },
  {
    question: 'O conteúdo muda entre os planos?',
    answer:
      'Não. Lições, apostilas e trilhas são as mesmas para todo mundo — o que muda é quanto do catálogo está aberto e as ferramentas de IA exclusivas do Plus.',
  },
  {
    question: 'Dá para trocar de plano depois?',
    answer:
      'Sim. Assinar um plano maior enquanto você já tem um ativo vira um upgrade, com desconto proporcional do que sobrou na primeira cobrança.',
  },
];

export function Plans() {
  const {
    isLoading,
    isError,
    retry,
    period,
    onPeriodChange,
    free,
    base,
    plus,
    currentTier,
    subscribeTo,
  } = usePlansController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('plans.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl text-ink">{t('plans.title')}</h1>

      <Tabs
        value={period}
        onValueChange={(value) => onPeriodChange(value as typeof period)}
      >
        <TabsList>
          <TabsTrigger value="MONTHLY">{t('plans.monthly')}</TabsTrigger>
          <TabsTrigger value="YEARLY">{t('plans.yearly')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PlanCard
          tier="FREE"
          plan={free}
          isCurrent={currentTier === 'FREE'}
          onSubscribe={subscribeTo}
        />
        <PlanCard
          tier="BASE"
          plan={base}
          isCurrent={currentTier === 'BASE'}
          onSubscribe={subscribeTo}
        />
        <PlanCard
          tier="PLUS"
          plan={plus}
          isCurrent={currentTier === 'PLUS'}
          onSubscribe={subscribeTo}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">{t('plans.faqTitle')}</h2>
        {FAQ.map((item) => (
          <details
            key={item.question}
            className="rounded-xl border border-line bg-surface p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-ink">
              {item.question}
            </summary>
            <p className="mt-2 text-sm text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
