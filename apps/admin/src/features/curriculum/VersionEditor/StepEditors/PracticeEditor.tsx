import { useAdminItem, useAdminItems } from '@english-saas/api-client';
import {
  CEFR_LEVELS,
  CONTENT_STATUSES,
  ITEM_TYPE_LABELS,
  type ContentStatus,
  type PracticeContent,
} from '@english-saas/shared';
import { Badge, Button, Checkbox, Select } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';
import { ListControls } from '../../components/ListControls';
import { SkillPicker } from '../../components/SkillPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { moveItem, removeAt } from '../../lib/list-ops';
import type { StepContent } from '../../lib/step-content';
import { issuesAt, issuesUnder } from '../../lib/validation';
import type { StepEditorProps } from './types';

function PracticeItemRow({
  itemId,
  index,
  count,
  readOnly,
  onMove,
  onRemove,
}: {
  itemId: string;
  index: number;
  count: number;
  readOnly: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const item = useAdminItem(itemId);
  const label = t('practice.item', { n: index + 1 });

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <span className="w-6 shrink-0 text-center font-mono text-sm text-muted">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        {item.isPending ? (
          <p className="text-sm text-muted">{t('practice.loading')}</p>
        ) : item.isError ? (
          <p className="text-sm text-error">
            {t('practice.itemMissing', { id: itemId })}
          </p>
        ) : (
          <>
            <p className="truncate text-sm text-ink">{item.data.prompt}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="muted">{ITEM_TYPE_LABELS[item.data.type]}</Badge>
              <Badge tone="muted">{item.data.cefrLevel}</Badge>
              <StatusBadge status={item.data.status} />
            </div>
          </>
        )}
      </div>
      {readOnly ? null : (
        <ListControls
          label={label}
          index={index}
          count={count}
          onMove={onMove}
          onRemove={onRemove}
        />
      )}
    </li>
  );
}

const STATUS_FILTERS: ContentStatus[] = CONTENT_STATUSES.filter(
  (status) => status !== 'ARCHIVED',
);

function ItemPicker({
  chosen,
  onAdd,
}: {
  chosen: readonly string[];
  onAdd: (itemId: string) => void;
}) {
  const [status, setStatus] = useState<ContentStatus>('PUBLISHED');
  const [level, setLevel] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const items = useAdminItems({
    status,
    ...(level === '' ? {} : { level }),
    ...(skillId === null ? {} : { skillId }),
  });

  return (
    <section className="space-y-3 rounded-xl border border-dashed border-line p-3">
      <h4 className="text-sm font-medium text-ink">
        {t('practice.pick.title')}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t('practice.pick.level')}
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          options={[
            { value: '', label: t('practice.pick.levelAny') },
            ...CEFR_LEVELS.map((entry) => ({ value: entry, label: entry })),
          ]}
        />
        <Select
          label={t('practice.pick.status')}
          value={status}
          onChange={(event) => setStatus(event.target.value as ContentStatus)}
          options={STATUS_FILTERS.map((entry) => ({
            value: entry,
            label: t(`content.status.${entry}`),
          }))}
        />
      </div>
      <SkillPicker
        label={t('practice.pick.skill')}
        value={skillId}
        onChange={setSkillId}
      />

      {items.isPending ? (
        <p className="text-sm text-muted">{t('practice.pick.loading')}</p>
      ) : items.isError ? (
        <p role="alert" className="text-sm text-error">
          {t('practice.pick.error')}
        </p>
      ) : items.data.data.length === 0 ? (
        <p className="text-sm text-muted">{t('practice.pick.none')}</p>
      ) : (
        <ul
          aria-label={t('practice.pick.results')}
          className="max-h-64 space-y-1 overflow-y-auto"
        >
          {items.data.data.map((item) => {
            const added = chosen.includes(item.id);

            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-ground/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.prompt}</p>
                  <p className="text-xs text-muted">
                    {ITEM_TYPE_LABELS[item.type]} · {item.cefrLevel}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={added}
                  aria-label={t('practice.pick.add', { prompt: item.prompt })}
                  onClick={() => onAdd(item.id)}
                >
                  {added ? t('practice.pick.added') : '+'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PracticeEditor({
  content,
  onChange,
  issues,
  readOnly,
}: StepEditorProps) {
  const practice = content as unknown as PracticeContent;
  const itemIds = practice.itemIds;

  function update(patch: Partial<PracticeContent>): void {
    onChange({ ...content, ...patch } as StepContent);
  }

  return (
    <div className="space-y-4" data-field="itemIds">
      <section className="space-y-3">
        <h3 className="font-display text-lg text-ink">{t('practice.items')}</h3>
        {issuesUnder(issues, 'itemIds').length > 0 ? (
          <p className="text-sm text-error">
            {issuesUnder(issues, 'itemIds')[0]?.message}
          </p>
        ) : null}
        {itemIds.length === 0 ? (
          <p className="text-sm text-muted">{t('practice.empty')}</p>
        ) : (
          <ol className="space-y-2">
            {itemIds.map((itemId, index) => (
              <PracticeItemRow
                key={`${itemId}-${String(index)}`}
                itemId={itemId}
                index={index}
                count={itemIds.length}
                readOnly={readOnly}
                onMove={(delta) =>
                  update({ itemIds: moveItem(itemIds, index, delta) })
                }
                onRemove={() => update({ itemIds: removeAt(itemIds, index) })}
              />
            ))}
          </ol>
        )}
      </section>

      <Checkbox
        label={t('practice.shuffle')}
        checked={practice.shuffle === true}
        disabled={readOnly}
        onCheckedChange={(checked) => update({ shuffle: checked })}
        error={issuesAt(issues, 'shuffle')[0]}
      />

      {readOnly ? null : (
        <ItemPicker
          chosen={itemIds}
          onAdd={(itemId) => update({ itemIds: [...itemIds, itemId] })}
        />
      )}
    </div>
  );
}
