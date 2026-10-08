import {
  AUDIO_ISSUE_KINDS,
  type AudioIssueKind,
  type AudioTarget,
} from '@english-saas/api-client';
import type { ContentStatus } from '@english-saas/shared';
import {
  AudioButton,
  Badge,
  Button,
  Checkbox,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@english-saas/ui';
import { RefreshCw } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import {
  canRegenerate,
  hasNarration,
  type AudioController,
  type SpeedChoice,
} from './useAudioController';

function TargetRow({
  target,
  controller,
  regenerable,
}: {
  target: AudioTarget;
  controller: AudioController;
  regenerable: boolean;
}) {
  const marking =
    controller.marking?.key === target.key ? controller.marking : null;
  const name = target.label ?? target.key;

  return (
    <li
      aria-label={`${name}: ${target.text}`}
      className="space-y-2 rounded-xl border border-line bg-surface p-3 text-sm"
    >
      <div className="flex items-start gap-3">
        {regenerable ? (
          <Checkbox
            label={
              <span className="sr-only">
                {t('studio.audio.select', { text: target.text })}
              </span>
            }
            checked={controller.selected.includes(target.key)}
            onCheckedChange={() => controller.toggleSelected(target.key)}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {target.kind === 'SCENE_LINE' ? (
              <span>{name}</span>
            ) : target.kind === 'ITEM' ? (
              <>
                <Badge tone="muted">{t('studio.audio.kind.item')}</Badge>
                <span className="truncate">{name}</span>
              </>
            ) : (
              <>
                <Badge tone="muted">{t('studio.audio.kind.note')}</Badge>
                <span className="font-mono">{name}</span>
              </>
            )}
          </p>
          <p lang="en" className="text-ink">
            {target.text}
          </p>
        </div>
        {target.audio ? (
          <AudioButton
            src={target.audio.url}
            label={t('studio.audio.listen', { text: target.text })}
          />
        ) : (
          <Badge tone="error">{t('studio.audio.missing')}</Badge>
        )}
      </div>

      {target.openIssues.length > 0 ? (
        <ul className="space-y-1" aria-label={t('studio.audio.issues')}>
          {target.openIssues.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-error/5 px-2 py-1 text-xs"
            >
              <Badge tone="error">
                {issue.audioIssue
                  ? t(`studio.audio.issue.${issue.audioIssue}`)
                  : t('studio.audio.issue.OTHER')}
              </Badge>
              {issue.body === '' ? null : (
                <span className="text-ink">{issue.body}</span>
              )}
              <button
                type="button"
                className="ml-auto text-accent underline"
                onClick={() => controller.resolveIssue(issue.id)}
              >
                {t('studio.audio.resolve')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {marking ? (
        <div
          role="group"
          aria-label={t('studio.audio.markTitle')}
          className="space-y-2 rounded-lg border border-line p-3"
        >
          <Select
            label={t('studio.audio.markKind')}
            value={marking.issue}
            onChange={(event) =>
              controller.changeMarking({
                issue: event.target.value as AudioIssueKind,
              })
            }
            options={AUDIO_ISSUE_KINDS.map((kind) => ({
              value: kind,
              label: t(`studio.audio.issue.${kind}`),
            }))}
          />
          <Input
            label={t('studio.audio.markNote')}
            value={marking.note}
            onChange={(event) =>
              controller.changeMarking({ note: event.target.value })
            }
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              isLoading={controller.isMarking}
              onClick={controller.submitMarking}
            >
              {t('studio.audio.markSave')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={controller.cancelMarking}
            >
              {t('studio.audio.markCancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('studio.audio.mark', { text: target.text })}
            onClick={() => controller.startMarking(target.key)}
          >
            {t('studio.audio.mark.short')}
          </Button>
          {regenerable ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={controller.generating || controller.isRequesting}
              aria-label={t('studio.audio.regenerateOne', {
                text: target.text,
              })}
              onClick={() => controller.regenerateOne(target.key)}
            >
              {t('studio.audio.regenerate.short')}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

/**
 * Revisão de áudio: ouvir cada fala gerada, marcar o que está errado e pedir
 * de novo. Só vale depois de aprovar — o TTS roda na aprovação — e o publicar
 * só passa com todos os áudios presentes.
 */
export function AudioPanel({
  controller,
  status,
}: {
  controller: AudioController;
  status: ContentStatus;
}) {
  if (!hasNarration(status)) {
    return (
      <div className="space-y-2">
        <h2 className="font-display text-lg text-ink">
          {t('studio.audio.title')}
        </h2>
        <p className="text-sm text-muted">{t('studio.audio.notYet')}</p>
      </div>
    );
  }

  const regenerable = canRegenerate(status);
  const done = controller.total - controller.pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-ink">
            {t('studio.audio.title')}
          </h2>
          {controller.data ? (
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-muted"
              data-testid="audio-progress"
            >
              {t('studio.audio.progress', {
                done,
                total: controller.total,
              })}
            </p>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          isLoading={controller.isRefreshing}
          leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          onClick={controller.refresh}
        >
          {t('studio.queue.refresh')}
        </Button>
      </div>

      {controller.pending > 0 ? (
        <p role="status" className="text-sm text-ink">
          {regenerable
            ? t('studio.audio.pending')
            : t('studio.audio.pendingLocked')}
        </p>
      ) : null}

      <p className="text-xs text-muted">{t('studio.audio.shared')}</p>

      {controller.actionError ? (
        <p role="alert" className="text-sm text-error">
          {controller.actionError}
        </p>
      ) : null}
      {controller.jobFailed !== null ? (
        <p role="alert" className="text-sm text-error">
          {t('studio.audio.failed')}
          {controller.jobFailed === '' ? '' : ` (${controller.jobFailed})`}
        </p>
      ) : null}

      {regenerable ? (
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('studio.audio.speed')}
            value={controller.speed}
            onChange={(event) =>
              controller.setSpeed(event.target.value as SpeedChoice)
            }
            options={[
              { value: 'normal', label: t('studio.audio.speed.normal') },
              { value: 'slow', label: t('studio.audio.speed.slow') },
            ]}
          />
          <Button
            variant="ghost"
            disabled={
              controller.selected.length === 0 ||
              controller.generating ||
              controller.isRequesting
            }
            isLoading={controller.generating}
            onClick={controller.regenerateSelected}
          >
            {controller.generating
              ? t('studio.audio.generating')
              : t('studio.audio.regenerateSelected', {
                  count: controller.selected.length,
                })}
          </Button>
        </div>
      ) : null}

      {controller.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('studio.audio.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.targets.length === 0 ? (
        <p className="text-sm text-muted">{t('studio.audio.empty')}</p>
      ) : (
        <ol className="space-y-2">
          {controller.targets.map((target) => (
            <TargetRow
              key={target.key}
              target={target}
              controller={controller}
              regenerable={regenerable}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
