import {
  Badge,
  Button,
  Card,
  ErrorState,
  Select,
  Skeleton,
} from '@english-saas/ui';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { EditorialActions } from '../Editorial';
import { StatusBadge } from '../components/StatusBadge';
import { VersionDiffView } from './VersionDiffView';
import { useLessonVersionsController } from './useLessonVersionsController';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function LessonVersions() {
  const controller = useLessonVersionsController();
  const versionOptions = controller.versions.map((version) => ({
    value: version.id,
    label: `v${String(version.version)} · ${t(`content.status.${version.status}`)}`,
  }));

  return (
    <div className="space-y-6">
      <Link
        to="/conteudo"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('lesson.back')}
      </Link>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : controller.error || controller.lesson === null ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error?.message}
          onRetry={controller.retry}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-ink">
                {controller.title}
              </h1>
              <p className="font-mono text-xs text-muted">
                {controller.lesson.slug}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="ghost"
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                isLoading={controller.isCreating}
                disabled={controller.openVersion !== undefined}
                onClick={controller.createVersion}
              >
                {t('lesson.newVersion')}
              </Button>
              <p className="max-w-xs text-right text-xs text-muted">
                {controller.openVersion
                  ? t('lesson.draftOpen', {
                      version: controller.openVersion.version,
                    })
                  : t('lesson.newVersionHint')}
              </p>
              {controller.createError ? (
                <p
                  role="alert"
                  className="max-w-xs text-right text-xs text-error"
                >
                  {controller.createError}
                </p>
              ) : null}
            </div>
          </header>

          <section aria-labelledby="versions-heading" className="space-y-3">
            <h2 id="versions-heading" className="font-display text-xl text-ink">
              {t('lesson.versions')}
            </h2>
            <ol className="flex flex-col gap-3">
              {controller.versions.map((version) => (
                <li key={version.id}>
                  <Card className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-ink">
                            {t('lesson.versionRow', {
                              version: version.version,
                            })}
                          </h3>
                          <StatusBadge status={version.status} />
                          {version.id ===
                          controller.lesson?.publishedVersionId ? (
                            <Badge tone="ok">{t('lesson.published')}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-ink">{version.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {t('lesson.createdAt', {
                            date: formatDate(version.createdAt),
                          })}
                          {version.approvedAt
                            ? ` · ${t('lesson.approvedAt', { date: formatDate(version.approvedAt) })}`
                            : ''}
                          {version.publishedAt
                            ? ` · ${t('lesson.publishedAt', { date: formatDate(version.publishedAt) })}`
                            : ''}
                        </p>
                      </div>
                      <Link
                        to={`/conteudo/versoes/${version.id}`}
                        aria-label={`${t('lesson.open')} ${t('lesson.versionRow', { version: version.version })}`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-ground"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        {t('lesson.open')}
                      </Link>
                    </div>
                    <EditorialActions
                      versionId={version.id}
                      versionNumber={version.version}
                      status={version.status}
                      size="sm"
                      stepTypes={version.steps.map((step) => step.type)}
                      editorHref={`/conteudo/versoes/${version.id}`}
                    />
                  </Card>
                </li>
              ))}
            </ol>
          </section>

          {controller.versions.length > 1 ? (
            <section aria-labelledby="compare-heading" className="space-y-3">
              <h2
                id="compare-heading"
                className="font-display text-xl text-ink"
              >
                {t('lesson.compare')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={t('lesson.compare.from')}
                  value={controller.compare.fromId ?? ''}
                  onChange={(event) =>
                    controller.compare.setFromId(event.target.value)
                  }
                  options={versionOptions}
                />
                <Select
                  label={t('lesson.compare.to')}
                  value={controller.compare.toId ?? ''}
                  onChange={(event) =>
                    controller.compare.setToId(event.target.value)
                  }
                  options={versionOptions}
                />
              </div>
              <Card>
                {controller.compare.diff ? (
                  <VersionDiffView diff={controller.compare.diff} />
                ) : (
                  <p className="text-sm text-muted">
                    {t('lesson.compare.pick')}
                  </p>
                )}
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
