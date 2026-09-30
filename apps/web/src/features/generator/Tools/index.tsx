import { Card, ErrorState, Skeleton } from '@english-saas/ui';
import { ClipboardPaste, Library, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from '../components/link-button';
import { PlusSample } from '../components/PlusSample';
import { useToolsController } from './useToolsController';

export function Tools() {
  const {
    isLoading,
    isError,
    retry,
    isPlus,
    balance,
    topicCost,
    ingestCost,
    pendingJobId,
  } = useToolsController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('tools.errorTitle')} onRetry={retry} />;
  }

  const materialsLink = (
    <Link
      to="/materiais"
      className="flex items-center gap-2 self-start text-sm font-medium text-accent underline"
    >
      <Library className="size-4" aria-hidden="true" />
      {t('tools.myMaterials')}
    </Link>
  );

  if (!isPlus) {
    return (
      <div className="flex flex-col gap-4">
        <PlusSample />
        {/* Material gerado continua do aluno depois de um downgrade. */}
        {materialsLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl text-ink">{t('tools.title')}</h1>
        <p className="text-sm text-muted">{t('tools.subtitle')}</p>
      </div>

      <Card className="flex items-center justify-between">
        <span className="text-sm text-muted">{t('tools.balance')}</span>
        <span className="font-mono text-lg text-ink">
          {balance} {t('tools.creditsUnit')}
        </span>
      </Card>

      {pendingJobId !== null ? (
        <Card className="flex items-center justify-between gap-3 border-accent/40 bg-accent/5">
          <span className="text-sm text-ink">{t('tools.pending.title')}</span>
          <Link
            to={`/ferramentas/pedidos/${pendingJobId}`}
            className="shrink-0 text-sm font-medium text-accent underline"
          >
            {t('tools.pending.resume')}
          </Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ToolCard
          to="/ferramentas/tema"
          icon={<Lightbulb className="size-6 text-accent" aria-hidden="true" />}
          title={t('tools.topic.title')}
          description={t('tools.topic.description')}
          cost={topicCost}
        />
        <ToolCard
          to="/ferramentas/colar"
          icon={
            <ClipboardPaste className="size-6 text-accent" aria-hidden="true" />
          }
          title={t('tools.ingest.title')}
          description={t('tools.ingest.description')}
          cost={ingestCost}
        />
      </div>

      {materialsLink}
    </div>
  );
}

function ToolCard({
  to,
  icon,
  title,
  description,
  cost,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  cost: number;
}) {
  return (
    <Card className="flex flex-col gap-3">
      {icon}
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="flex-1 text-sm text-muted">{description}</p>
      <p className="font-mono text-xs text-muted">
        {t('tools.cost', { cost })}
      </p>
      <Link to={to} className={LINK_BUTTON_CLASS}>
        {t('tools.start')}
      </Link>
    </Card>
  );
}
