import { useAdminItem, type Comment } from '@english-saas/api-client';
import { LESSON_STEP_TYPE_LABELS } from '@english-saas/shared';
import {
  Badge,
  Button,
  Checkbox,
  ErrorState,
  Select,
  Skeleton,
  Textarea,
} from '@english-saas/ui';
import { X } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import type { QaStep } from '../lib/qa-path';
import {
  aboutOf,
  encodeAbout,
  type CommentsController,
} from './useCommentsController';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function ItemAbout({ itemId }: { itemId: string }) {
  const item = useAdminItem(itemId);

  return (
    <span>
      {t('studio.comments.about.item')}
      {item.data ? `: ${item.data.prompt}` : ''}
    </span>
  );
}

function CommentRow({
  comment,
  steps,
  controller,
}: {
  comment: Comment;
  steps: readonly QaStep[];
  controller: CommentsController;
}) {
  const about = aboutOf(comment, steps);
  const resolved = (comment.resolvedAt ?? null) !== null;

  return (
    <li
      className={`rounded-xl border border-line p-3 text-sm ${
        resolved ? 'bg-ground text-muted' : 'bg-surface'
      }`}
    >
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {about.itemId === undefined ? (
          <span>{about.label}</span>
        ) : (
          <ItemAbout itemId={about.itemId} />
        )}
        {resolved ? (
          <Badge tone="ok">{t('studio.comments.resolved')}</Badge>
        ) : null}
      </p>
      <p className={`mt-1 whitespace-pre-wrap ${resolved ? '' : 'text-ink'}`}>
        {comment.body}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        <span>
          {comment.author?.name ?? t('studio.queue.unknownUser')} ·{' '}
          {dateFormat.format(new Date(comment.createdAt))}
        </span>
        {resolved ? null : (
          <button
            type="button"
            className="text-accent underline disabled:opacity-50"
            disabled={controller.resolvingId === comment.id}
            onClick={() => controller.resolve(comment.id)}
          >
            {t('studio.comments.resolve')}
          </button>
        )}
      </p>
    </li>
  );
}

/** Comentários da revisão, por etapa e por questão, com "resolver". */
export function CommentsPanel({
  controller,
  steps,
}: {
  controller: CommentsController;
  steps: readonly QaStep[];
}) {
  const { about } = controller;
  const options = [
    { value: 'VERSION', label: t('studio.comments.about.version') },
    ...steps.map((step, order) => ({
      value: `STEP:${String(order)}`,
      label: t('studio.comments.about.step', {
        n: order + 1,
        type: LESSON_STEP_TYPE_LABELS[step.type],
      }),
    })),
    ...(about.target === 'ITEM' && about.ref !== null
      ? [
          {
            value: encodeAbout(about),
            label:
              about.label === ''
                ? t('studio.comments.about.item')
                : about.label,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink">
        {t('studio.comments.title')}
      </h2>

      <form
        className="space-y-2"
        aria-label={t('studio.comments.new')}
        onSubmit={(event) => {
          event.preventDefault();
          controller.submit();
        }}
      >
        <Select
          label={t('studio.comments.about')}
          value={encodeAbout(about)}
          onChange={(event) => controller.chooseAbout(event.target.value)}
          options={options}
        />
        {about.target === 'ITEM' ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            {about.label === '' ? t('studio.comments.about.item') : about.label}
            <button
              type="button"
              aria-label={t('studio.comments.aboutClear')}
              className="rounded-full p-1 hover:bg-ground"
              onClick={controller.clearAbout}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </p>
        ) : null}
        <Textarea
          label={t('studio.comments.text')}
          rows={3}
          value={controller.text}
          onChange={(event) => controller.setText(event.target.value)}
          error={controller.textError ?? undefined}
        />
        {controller.serverError ? (
          <p role="alert" className="text-sm text-error">
            {controller.serverError}
          </p>
        ) : null}
        <Button type="submit" size="sm" isLoading={controller.isAdding}>
          {t('studio.comments.add')}
        </Button>
      </form>

      <Checkbox
        label={t('studio.comments.showResolved')}
        checked={controller.includeResolved}
        onCheckedChange={controller.setIncludeResolved}
      />

      {controller.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('studio.comments.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.comments.length === 0 ? (
        <p className="text-sm text-muted">{t('studio.comments.empty')}</p>
      ) : (
        <ul className="space-y-2" aria-label={t('studio.comments.list')}>
          {controller.comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              steps={steps}
              controller={controller}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
