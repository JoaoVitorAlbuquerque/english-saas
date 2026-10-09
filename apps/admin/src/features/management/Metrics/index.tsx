import {
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { ContentTab } from './ContentTab';
import { CostsTab } from './CostsTab';
import { EngagementTab } from './EngagementTab';
import { PeriodFilter } from './PeriodFilter';
import { useMetricsController } from './useMetricsController';

export function Metrics() {
  const controller = useMetricsController();
  const { metrics } = controller;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-ink">{t('metrics.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('metrics.subtitle')}
        </p>
      </header>

      <PeriodFilter controller={controller} />

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">{t('metrics.loading')}</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('mgmt.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : metrics ? (
        <Tabs value={controller.tab} onValueChange={controller.setTab}>
          <TabsList aria-label={t('metrics.tabs')}>
            <TabsTrigger value="engajamento">
              {t('metrics.tab.engagement')}
            </TabsTrigger>
            <TabsTrigger value="conteudo">
              {t('metrics.tab.content')}
            </TabsTrigger>
            <TabsTrigger value="custos">{t('metrics.tab.costs')}</TabsTrigger>
          </TabsList>
          <TabsContent value="engajamento">
            <EngagementTab metrics={metrics} />
          </TabsContent>
          <TabsContent value="conteudo">
            <ContentTab metrics={metrics} />
          </TabsContent>
          <TabsContent value="custos">
            <CostsTab metrics={metrics} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
