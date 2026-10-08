import { useAdminVersion, type AdminVersion } from '@english-saas/api-client';
import { LESSON_STEP_TYPE_LABELS } from '@english-saas/shared';
import { Button, Card, ErrorState, Skeleton } from '@english-saas/ui';
import { ArrowLeft, MessageSquare, PanelRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import {
  ApproveBlockedNote,
  PublishBlockedNote,
} from '../../studio/review/Guards';
import { ReviewProvider } from '../../studio/review/ReviewContext';
import { ReviewSidePanel } from '../../studio/review/ReviewSidePanel';
import { stepLabel } from '../../studio/review/useCommentsController';
import { useReviewWorkspace } from '../../studio/review/useReviewWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/StatusBadge';
import { EditorialActions } from '../Editorial';
import { MetaEditor } from './MetaEditor';
import { SaveIndicator } from './SaveIndicator';
import { StepEditor } from './StepEditors';
import { META_TAB, StepList } from './StepList';
import { useVersionEditorController } from './useVersionEditorController';

function EditorWorkspace({ version }: { version: AdminVersion }) {
  const controller = useVersionEditorController(version);
  const { state, validation } = controller;
  const activeStep = state.steps.find((step) => step.key === controller.active);
  const problems = validation.total;
  const qaSteps = useMemo(
    () =>
      state.steps.map((step) => ({ type: step.type, content: step.content })),
    [state.steps],
  );
  const review = useReviewWorkspace({
    versionId: version.id,
    status: controller.status,
    steps: qaSteps,
    savedAt: controller.autosave.state.savedAt,
    revealPanel: controller.showPanel,
  });
  const jumps = {
    onJumpStep: controller.jumpToIssue,
    onJumpMeta: controller.jumpToMeta,
  };
  const activeOrder = activeStep ? state.steps.indexOf(activeStep) : -1;
  const openOnStep =
    activeOrder >= 0
      ? (review.context.openByStep[String(activeOrder)] ?? 0)
      : 0;

  return (
    <ReviewProvider value={review.context}>
      <div className="space-y-4">
        <Link
          to={`/conteudo/licoes/${version.lesson.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('editor.back')}
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl text-ink">
                {t('editor.heading', { version: version.version })}
              </h1>
              <StatusBadge status={controller.status} />
            </div>
            <p className="truncate text-sm text-muted">
              {state.meta.title}{' '}
              <span className="font-mono text-xs">· {version.lesson.slug}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveIndicator
              state={controller.autosave.state}
              readOnly={controller.readOnly}
              unsavedFields={controller.unsavedFields}
              onRetry={controller.autosave.retry}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={controller.previewOpen}
              leftIcon={<PanelRight className="size-4" aria-hidden="true" />}
              onClick={controller.togglePreview}
            >
              {controller.previewOpen
                ? t('editor.preview.hide')
                : t('editor.preview.show')}
            </Button>
          </div>
        </header>

        {controller.status === 'PUBLISHED' ||
        controller.status === 'ARCHIVED' ? (
          <Card role="note" className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              {controller.status === 'PUBLISHED'
                ? t('editor.readOnly.published')
                : t('editor.readOnly.archived')}
            </p>
            <Button
              size="sm"
              isLoading={controller.isCreatingVersion}
              onClick={controller.createNextVersion}
            >
              {t('editor.readOnly.action')}
            </Button>
            {controller.newVersionError ? (
              <p role="alert" className="w-full text-sm text-error">
                {controller.newVersionError}
              </p>
            ) : null}
          </Card>
        ) : null}

        {controller.returnedToDraft ? (
          <Card role="status" className="text-sm text-ink">
            {t('editor.returnedToDraft')}
          </Card>
        ) : null}

        <EditorialActions
          versionId={version.id}
          versionNumber={version.version}
          status={controller.status}
          beforeAction={controller.autosave.flush}
          onTransitioned={controller.onTransitioned}
          stepTypes={state.steps.map((step) => step.type)}
          onJumpToIssue={controller.jumpToIssue}
          guards={{
            ...(review.approveBlocked
              ? {
                  approve: <ApproveBlockedNote qa={review.qa} jumps={jumps} />,
                }
              : {}),
            ...(review.publishBlocked
              ? {
                  publish: (
                    <PublishBlockedNote
                      audio={review.audio}
                      onOpenAudio={() => review.setTab('audio')}
                    />
                  ),
                }
              : {}),
          }}
        />

        <p
          role="status"
          aria-live="polite"
          className={problems > 0 ? 'text-sm text-error' : 'text-sm text-muted'}
        >
          {problems === 0
            ? t('editor.validation.ok')
            : problems === 1
              ? t('editor.validation.one')
              : t('editor.validation.many', { count: problems })}
        </p>

        <div
          className={
            controller.previewOpen
              ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
              : ''
          }
        >
          <div className="min-w-0 space-y-4">
            <StepList
              steps={state.steps}
              validation={validation}
              active={controller.active}
              readOnly={controller.readOnly}
              onSelect={controller.setActive}
              onMove={controller.moveStep}
              onRemove={controller.requestRemove}
              onAdd={controller.addStep}
            />

            <Card id="editor-panel" className="min-w-0 space-y-4">
              {controller.active === META_TAB || activeStep === undefined ? (
                <>
                  <h2 className="font-display text-xl text-ink">
                    {t('editor.tab.meta')}
                  </h2>
                  <MetaEditor
                    meta={state.meta}
                    errors={validation.meta}
                    readOnly={controller.readOnly}
                    onChange={controller.patchMeta}
                  />
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-xl text-ink">
                      {t('editor.step.title', {
                        position: activeOrder + 1,
                        type: LESSON_STEP_TYPE_LABELS[activeStep.type],
                      })}
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={
                        <MessageSquare className="size-4" aria-hidden="true" />
                      }
                      onClick={() =>
                        review.context.comment({
                          target: 'STEP',
                          ref: String(activeOrder),
                          label: stepLabel(activeOrder, qaSteps),
                        })
                      }
                    >
                      {openOnStep > 0
                        ? t('studio.comments.stepButtonCount', {
                            count: openOnStep,
                          })
                        : t('studio.comments.stepButton')}
                    </Button>
                  </div>
                  <StepEditor
                    key={activeStep.key}
                    type={activeStep.type}
                    content={activeStep.content}
                    issues={validation.steps[activeStep.key] ?? []}
                    readOnly={controller.readOnly}
                    characters={controller.characters}
                    onChange={(content) =>
                      controller.updateContent(activeStep.key, content)
                    }
                  />
                </>
              )}
            </Card>
          </div>

          {controller.previewOpen ? (
            <div className="min-w-0 xl:sticky xl:top-8">
              <ReviewSidePanel
                workspace={review}
                versionId={version.id}
                status={controller.status}
                level={state.meta.cefrLevel}
                steps={qaSteps}
                savedAt={controller.autosave.state.savedAt}
                jumps={jumps}
              />
            </div>
          ) : null}
        </div>

        <ConfirmDialog
          open={controller.removingStep !== null}
          title={t('editor.step.removeConfirm.title')}
          description={
            controller.removingStep
              ? t('editor.step.removeConfirm.description', {
                  position: controller.removingStep.position,
                  type: LESSON_STEP_TYPE_LABELS[controller.removingStep.type],
                })
              : ''
          }
          confirmLabel={t('editor.step.removeConfirm.action')}
          danger
          onConfirm={controller.confirmRemove}
          onCancel={controller.cancelRemove}
        />
      </div>
    </ReviewProvider>
  );
}

export function VersionEditor() {
  const { versionId = '' } = useParams();
  const version = useAdminVersion(versionId);

  if (version.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (version.isError) {
    return (
      <ErrorState
        title={t('editor.loadError')}
        description={version.error.message}
        onRetry={() => void version.refetch()}
      />
    );
  }

  // `key`: abrir outra versão começa um editor novo, sem estado da anterior.
  return <EditorWorkspace key={version.data.id} version={version.data} />;
}
