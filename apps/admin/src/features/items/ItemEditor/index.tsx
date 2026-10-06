import { Button, Card, ErrorState, Skeleton } from '@english-saas/ui';
import { ArrowLeft, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../../curriculum/components/ConfirmDialog';
import { StatusBadge } from '../../curriculum/components/StatusBadge';
import { AcceptedAnswersEditor } from './AcceptedAnswersEditor';
import { ErrorPatternMapEditor } from './ErrorPatternMapEditor';
import { ItemEditorial } from './ItemEditorial';
import { ItemProblemPanel } from './ItemEditorial/ItemProblemPanel';
import { ItemMetaBottom, ItemMetaTop } from './ItemMetaForm';
import { ItemPreview } from './ItemPreview';
import { ItemStatsPanel } from './ItemStats';
import { TypeEditor } from './TypeEditors';
import { useItemEditorController } from './useItemEditorController';
import { hasTypedAnswer } from '@english-saas/shared';

function SaveStatus({
  dirty,
  isSaving,
  savedAt,
  issueCount,
}: {
  dirty: boolean;
  isSaving: boolean;
  savedAt: string | null;
  issueCount: number;
}) {
  const text = isSaving
    ? t('items.save.saving')
    : dirty
      ? t('items.save.dirty')
      : savedAt !== null
        ? t('items.save.savedAt', { time: savedAt })
        : t('items.save.clean');

  return (
    <p role="status" className="text-sm text-muted">
      {text}
      {issueCount > 0 ? (
        <span className="ml-2 text-error">
          {t('items.save.problems', { count: issueCount })}
        </span>
      ) : null}
    </p>
  );
}

function ItemEditorScreen({ itemId }: { itemId: string | null }) {
  const controller = useItemEditorController(itemId);

  if (controller.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (controller.loadError) {
    return (
      <ErrorState
        title={t('content.loadError')}
        description={controller.loadError.message}
        onRetry={controller.retry}
      />
    );
  }

  const { state, item } = controller;
  const title = controller.isNew
    ? t('items.editor.newTitle')
    : t('items.editor.editTitle');

  return (
    <div className="space-y-6">
      <Link
        to="/conteudo/questoes"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('items.editor.back')}
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          {item ? <StatusBadge status={item.status} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveStatus
            dirty={controller.dirty}
            isSaving={controller.isSaving}
            savedAt={controller.savedAt}
            issueCount={controller.issueCount}
          />
          <Button
            leftIcon={<Save className="size-4" aria-hidden="true" />}
            isLoading={controller.isSaving}
            disabled={!controller.isNew && !controller.dirty}
            onClick={() => void controller.save()}
          >
            {controller.isNew ? t('items.save.create') : t('content.save')}
          </Button>
        </div>
      </header>

      {item ? (
        <ItemEditorial
          item={item}
          beforeAction={controller.save}
          onTransitioned={controller.onTransitioned}
          onJumpToIssue={controller.jumpTo}
        />
      ) : null}

      {controller.returnedToDraft ? (
        <div
          role="status"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink"
        >
          {t('items.banner.returnedToDraft')}
          <button
            type="button"
            className="ml-3 text-accent underline"
            onClick={controller.dismissReturnedToDraft}
          >
            {t('editorial.problem.dismiss')}
          </button>
        </div>
      ) : null}

      {controller.problem ? (
        <ItemProblemPanel
          problem={controller.problem}
          onJumpToIssue={controller.jumpTo}
          onDismiss={controller.dismissProblem}
        />
      ) : null}

      {controller.frozen && item ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink">
            {item.status === 'ARCHIVED'
              ? t('items.banner.archived')
              : t('items.banner.published')}
          </p>
          {item.replacedById === null ? (
            <Button
              size="sm"
              isLoading={controller.isCreatingRevision}
              onClick={controller.makeRevision}
            >
              {t('items.revision.create')}
            </Button>
          ) : (
            <p className="text-sm text-muted">
              {t('items.revision.exists')}{' '}
              <Link
                to={`/conteudo/questoes/${item.replacedById}`}
                className="text-accent underline"
              >
                {t('items.revision.open')}
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {item?.replaces ? (
        <p className="text-sm text-muted">
          {t('items.revision.replaces')}{' '}
          <Link
            to={`/conteudo/questoes/${item.replaces}`}
            className="text-accent underline"
          >
            {t('items.revision.open')}
          </Link>
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card id={controller.panelId} className="space-y-6">
          <ItemMetaTop
            state={state}
            issues={controller.issues}
            frozen={controller.frozen}
            isNew={controller.isNew}
            onPatch={controller.patch}
            onType={controller.requestType}
          />

          <TypeEditor
            type={state.type}
            content={state.content}
            onChange={controller.setContent}
            issues={controller.issues}
            readOnly={controller.frozen}
            audioUrl={controller.audioUrl}
          />

          {hasTypedAnswer(state.type) ? (
            <AcceptedAnswersEditor
              answers={state.acceptedAnswers}
              onChange={controller.setAccepted}
              issues={controller.issues}
              readOnly={controller.frozen}
            />
          ) : null}

          <ErrorPatternMapEditor
            state={state}
            onAdd={controller.addMapRow}
            onChange={controller.setMapRow}
            onRemove={controller.removeMapRow}
            issues={controller.issues}
            readOnly={false}
          />

          <ItemMetaBottom
            state={state}
            issues={controller.issues}
            readOnly={false}
            onPatch={controller.patch}
          />
        </Card>

        <div className="space-y-6 xl:sticky xl:top-6">
          <Card className="space-y-3">
            <h2 className="font-display text-lg text-ink">
              {t('items.preview.title')}
            </h2>
            <ItemPreview state={state} audioUrl={controller.audioUrl} />
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-lg text-ink">
              {t('items.stats.title')}
            </h2>
            <ItemStatsPanel item={item} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={controller.pendingType !== null}
        title={t('items.type.confirm.title')}
        description={t('items.type.confirm.description')}
        confirmLabel={t('items.type.confirm.action')}
        danger
        onConfirm={controller.confirmType}
        onCancel={controller.cancelType}
      />
    </div>
  );
}

/** Nova questão (`/nova`) ou a ficha de uma existente. */
export function ItemEditor() {
  const { itemId } = useParams();

  // `key`: de uma questão para a outra (a revisão, por exemplo) a tela
  // recomeça do zero, com o formulário da questão nova.
  return <ItemEditorScreen key={itemId ?? 'nova'} itemId={itemId ?? null} />;
}
